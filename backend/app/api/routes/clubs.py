import asyncio
import logging
import uuid
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import String, cast
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    SessionDep,
    get_current_active_superuser,
)
from app.core.config import settings
from app.models import (
    Club,
    ClubCreate,
    ClubPublic,
    ClubsPublic,
    ClubStatsPublic,
    ClubUpdate,
    LeagueStats,
    Match,
    Message,
    SeasonStats,
)
from app.services.ea_api import get_headers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clubs", tags=["clubs"])

# Shared AsyncClient – initialized once, reused across requests
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient()
    return _http_client


# Semaphore to cap concurrent EA API requests
_ea_semaphore = asyncio.Semaphore(settings.EA_API_CONCURRENCY_LIMIT)

# Hard limit on bulk payload size
BULK_MAX_CLUBS = 100


async def fetch_ea_id(club_name: str) -> str | None:
    # Remove extra spaces as requested
    cleaned_name = " ".join(club_name.split())
    encoded_name = quote(cleaned_name)
    url = f"https://proclubs.ea.com/api/nhl/clubs/search?platform=common-gen5&clubName={encoded_name}"

    async with _ea_semaphore:
        try:
            client = get_http_client()
            response = await client.get(url, headers=get_headers(), timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, dict):
                    # The response is { "clubId": { ... } }
                    return list(data.keys())[0]
        except httpx.RequestError as exc:
            logger.error("Network error fetching EA ID for %r: %s", club_name, exc)
        except Exception as exc:
            logger.error("Unexpected error fetching EA ID for %r: %s", club_name, exc)
    return None


@router.get("/", response_model=ClubsPublic)
def read_clubs(
    session: SessionDep, search: str | None = None, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve clubs.
    """
    statement = select(Club)
    if search:
        search_filter = f"%{search}%"
        statement = statement.where(
            (col(Club.name).ilike(search_filter))
            | (col(Club.ea_id).ilike(search_filter))
        )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    max_limit = 100
    limit = min(max(1, limit), max_limit)
    skip = max(0, skip)

    statement = statement.order_by(Club.name).offset(skip).limit(limit)
    clubs = session.exec(statement).all()

    return ClubsPublic(data=clubs, count=count)


@router.get("/{id}", response_model=ClubPublic)
def read_club(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get club by ID.
    """
    club = session.get(Club, id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club


@router.get("/{id}/stats", response_model=ClubStatsPublic)
def read_club_stats(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get club statistics grouped by league and season.
    """
    from app.models import MatchClubLink
    club = session.get(Club, id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    # Efficiently query matches using the link table
    statement = (
        select(Match)
        .join(MatchClubLink, Match.match_id == MatchClubLink.match_id)
        .where(MatchClubLink.club_id == id)
        .options(selectinload(Match.league), selectinload(Match.season))
    )
    matches = session.exec(statement).all()

    total_matches = len(matches)
    
    # Group by league and season
    leagues_dict: dict[uuid.UUID, dict[str, Any]] = {}
    
    for match in matches:
        l_id = match.league_id
        s_id = match.season_id
        
        if l_id not in leagues_dict:
            leagues_dict[l_id] = {
                "id": l_id,
                "name": match.league.name if match.league else "Unknown League",
                "count": 0,
                "seasons": {}
            }
        
        leagues_dict[l_id]["count"] += 1
        
        if s_id not in leagues_dict[l_id]["seasons"]:
            leagues_dict[l_id]["seasons"][s_id] = {
                "id": s_id,
                "name": match.season.name if match.season else "Unknown Season",
                "count": 0
            }
        
        leagues_dict[l_id]["seasons"][s_id]["count"] += 1

    # Convert to response model
    league_stats_list = []
    for l_id, l_data in leagues_dict.items():
        season_stats_list = [
            SeasonStats(id=s_id, name=s_data["name"], count=s_data["count"])
            for s_id, s_data in l_data["seasons"].items()
        ]
        league_stats_list.append(
            LeagueStats(
                id=l_id,
                name=l_data["name"],
                count=l_data["count"],
                seasons=season_stats_list
            )
        )

    return ClubStatsPublic(
        total_matches=total_matches,
        leagues=league_stats_list
    )


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=ClubPublic
)
async def create_club(*, session: SessionDep, club_in: ClubCreate) -> Any:
    """
    Create new club.
    """
    # Clean name
    club_in.name = " ".join(club_in.name.split())

    # Check if club already exists
    existing_club = session.exec(select(Club).where(Club.name == club_in.name)).first()
    if existing_club:
        raise HTTPException(
            status_code=400,
            detail="A club with this name already exists.",
        )

    # Fetch EA ID if not provided or even if provided (prompt says "anytime we save any clubs... we search for its ea id")
    ea_id = await fetch_ea_id(club_in.name)
    if ea_id:
        club_in.ea_id = ea_id

    club = crud.create_club(session=session, club_in=club_in)
    return club


@router.post(
    "/bulk",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
async def bulk_create_clubs(*, session: SessionDep, clubs_in: list[ClubCreate]) -> Any:
    """
    Create multiple clubs.
    """
    if len(clubs_in) > BULK_MAX_CLUBS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many clubs in a single request. Maximum allowed is {BULK_MAX_CLUBS}.",
        )

    async def process_club(club_in: ClubCreate):
        club_in.name = " ".join(club_in.name.split())
        ea_id = await fetch_ea_id(club_in.name)
        if ea_id:
            club_in.ea_id = ea_id
        return club_in

    # Process with bounded concurrency (semaphore already limits EA calls)
    processed_clubs = await asyncio.gather(*[process_club(c) for c in clubs_in])

    created_count = 0
    duplicates = []
    for club_in in processed_clubs:
        # Check if club already exists
        statement = select(Club).where(Club.name == club_in.name)
        existing_club = session.exec(statement).first()
        if not existing_club:
            db_obj = Club.model_validate(club_in)
            session.add(db_obj)
            created_count += 1
        else:
            duplicates.append(club_in.name)

    session.commit()

    msg = f"Successfully processed {len(clubs_in)} clubs. {created_count} new clubs created."
    if duplicates:
        msg += f" The following clubs already exist and were skipped: {', '.join(duplicates)}."

    return Message(message=msg)


@router.patch(
    "/{id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ClubPublic,
)
async def update_club(
    *, session: SessionDep, id: uuid.UUID, club_in: ClubUpdate
) -> Any:
    """
    Update a club.
    """
    db_club = session.get(Club, id)
    if not db_club:
        raise HTTPException(status_code=404, detail="Club not found")

    if club_in.name:
        normalized_new = " ".join(club_in.name.split())
        normalized_existing = " ".join(db_club.name.split())
        club_in.name = normalized_new
        # Re-fetch EA ID only when the normalized name actually changed
        if normalized_new != normalized_existing:
            ea_id = await fetch_ea_id(normalized_new)
            if ea_id:
                club_in.ea_id = ea_id

    club = crud.update_club(session=session, db_club=db_club, club_in=club_in)
    return club


@router.delete("/{id}", dependencies=[Depends(get_current_active_superuser)])
def delete_club(session: SessionDep, id: uuid.UUID) -> Message:
    """
    Delete a club.
    """
    club = session.get(Club, id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    session.delete(club)
    session.commit()
    return Message(message="Club deleted successfully")


@router.post("/bulk-delete", dependencies=[Depends(get_current_active_superuser)])
def bulk_delete_clubs(session: SessionDep, ids: list[uuid.UUID] = Body(...)) -> Message:
    """
    Delete multiple clubs, reporting which IDs were deleted and which were not found.
    """
    deleted_ids: list[str] = []
    not_found_ids: list[str] = []

    for id in ids:
        club = session.get(Club, id)
        if club:
            session.delete(club)
            deleted_ids.append(str(id))
        else:
            not_found_ids.append(str(id))

    session.commit()

    parts = [f"Deleted {len(deleted_ids)} club(s)."]
    if not_found_ids:
        parts.append(f"Not found: {', '.join(not_found_ids)}.")

    return Message(message=" ".join(parts))
