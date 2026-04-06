import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.models import (
    League,
    LeagueCreate,
    LeaguePublic,
    LeagueUpdate,
    LeaguesPublic,
    Message,
)

router = APIRouter(prefix="/leagues", tags=["leagues"])


@router.get("/", response_model=LeaguesPublic)
def read_leagues(
    session: SessionDep, search: str | None = None, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve leagues.
    """
    statement = select(League)
    if search:
        search_filter = f"%{search}%"
        statement = statement.where(
            (col(League.name).ilike(search_filter)) |
            (col(League.description).ilike(search_filter))
        )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    max_limit = 100
    limit = min(max(1, limit), max_limit)
    skip = max(0, skip)
    
    statement = statement.order_by(League.id).offset(skip).limit(limit)
    leagues = session.exec(statement).all()

    return LeaguesPublic(data=leagues, count=count)


@router.get("/{id}", response_model=LeaguePublic)
def read_league(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get league by ID.
    """
    league = session.get(League, id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return league


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=LeaguePublic
)
def create_league(*, session: SessionDep, league_in: LeagueCreate) -> Any:
    """
    Create new league.
    """
    league = crud.create_league(session=session, league_in=league_in)
    return league


@router.patch(
    "/{id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=LeaguePublic,
)
def update_league(
    *, session: SessionDep, id: uuid.UUID, league_in: LeagueUpdate
) -> Any:
    """
    Update a league.
    """
    league = session.get(League, id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    league = crud.update_league(session=session, db_league=league, league_in=league_in)
    return league


@router.delete("/{id}", dependencies=[Depends(get_current_active_superuser)])
def delete_league(session: SessionDep, id: uuid.UUID) -> Message:
    """
    Delete a league.
    """
    league = session.get(League, id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    session.delete(league)
    session.commit()
    return Message(message="League deleted successfully")


@router.post("/bulk-delete", dependencies=[Depends(get_current_active_superuser)])
def bulk_delete_leagues(session: SessionDep, ids: list[uuid.UUID] = Body(...)) -> Message:
    """
    Delete multiple leagues.
    """
    for id in ids:
        league = session.get(League, id)
        if league:
            session.delete(league)
    session.commit()
    return Message(message="Leagues deleted successfully")
