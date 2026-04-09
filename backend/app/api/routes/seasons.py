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
    Message,
    Season,
    SeasonCreate,
    SeasonPublic,
    SeasonsPublic,
    SeasonUpdate,
)

router = APIRouter(prefix="/seasons", tags=["seasons"])


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