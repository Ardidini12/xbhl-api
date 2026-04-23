import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import String, cast
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    SessionDep,
    get_current_active_superuser,
)
from app.models import (
    Club,
    ClubsPublic,
    Message,
    Season,
    SeasonCreate,
    SeasonPublic,
    SeasonsPublic,
    SeasonUpdate,
)

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/{id}/clubs", response_model=ClubsPublic)
def read_season_clubs(
    session: SessionDep,
    id: uuid.UUID,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve clubs for a specific season.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    clubs, count = crud.get_season_clubs(
        session=session, season_id=id, search=search, skip=skip, limit=limit
    )

    return ClubsPublic(data=clubs, count=count)


@router.post(
    "/{id}/clubs",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def add_clubs_to_season(
    *, session: SessionDep, id: uuid.UUID, club_ids: list[uuid.UUID] = Body(...)
) -> Any:
    """
    Add clubs to a season.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # We still want to check for missing clubs to raise 404 if requested.
    # The CRUD function could also do this, but keeping the check here for now.
    clubs = session.exec(select(Club).where(col(Club.id).in_(club_ids))).all()
    found_ids = {c.id for c in clubs}
    missing_ids = set(club_ids) - found_ids
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Clubs not found: {[str(mid) for mid in missing_ids]}",
        )

    added = crud.add_clubs_to_season(session=session, db_season=season, club_ids=club_ids)

    return Message(
        message=f"{added} club(s) added to season ({len(club_ids) - added} already present)"
    )


@router.delete(
    "/{id}/clubs",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def remove_clubs_from_season(
    *, session: SessionDep, id: uuid.UUID, club_ids: list[uuid.UUID] = Body(...)
) -> Any:
    """
    Remove clubs from a season.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    crud.remove_clubs_from_season(session=session, db_season=season, club_ids=club_ids)

    return Message(message="Clubs removed from season successfully")


@router.get("/", response_model=SeasonsPublic)
def read_seasons(
    session: SessionDep,
    league_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve seasons.
    """
    statement = select(Season)
    if league_id:
        statement = statement.where(Season.league_id == league_id)

    if search:
        search_filter = f"%{search}%"
        statement = statement.where(
            (col(Season.name).ilike(search_filter)) |
            (col(Season.description).ilike(search_filter)) |
            (cast(Season.start_date, String).ilike(search_filter)) |
            (cast(Season.end_date, String).ilike(search_filter))
        )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.offset(skip).limit(limit)
    seasons = session.exec(statement).all()

    return SeasonsPublic(data=seasons, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=SeasonPublic
)
def create_season(*, session: SessionDep, season_in: SeasonCreate) -> Any:
    """
    Create new season.
    """
    season = crud.create_season(session=session, season_in=season_in)
    return season


@router.get("/{id}", response_model=SeasonPublic)
def read_season(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get season by ID.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    return season


@router.patch(
    "/{id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=SeasonPublic,
)
def update_season(
    *, session: SessionDep, id: uuid.UUID, season_in: SeasonUpdate
) -> Any:
    """
    Update a season.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    season = crud.update_season(session=session, db_season=season, season_in=season_in)
    return season


@router.post(
    "/{id}/end",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=SeasonPublic,
)
def end_season(*, session: SessionDep, id: uuid.UUID) -> Any:
    """
    End a season (sets end_date to current date).
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    if season.end_date is not None:
        return season
    season.end_date = datetime.now(timezone.utc)
    session.add(season)
    session.commit()
    session.refresh(season)
    return season


@router.delete("/{id}", dependencies=[Depends(get_current_active_superuser)])
def delete_season(session: SessionDep, id: uuid.UUID) -> Message:
    """
    Delete a season.
    """
    season = session.get(Season, id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    session.delete(season)
    session.commit()
    return Message(message="Season deleted successfully")


@router.post("/bulk-delete", dependencies=[Depends(get_current_active_superuser)])
def bulk_delete_seasons(session: SessionDep, ids: list[uuid.UUID] = Body(...)) -> Message:
    """
    Delete multiple seasons.
    """
    for id in ids:
        season = session.get(Season, id)
        if season:
            session.delete(season)
    session.commit()
    return Message(message="Seasons deleted successfully")
