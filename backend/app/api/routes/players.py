from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import Player, PlayerPublic, PlayersPublic

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/", response_model=PlayersPublic)
def read_players(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve players.
    """
    statement = select(Player)
    if search:
        search_filter = f"%{search}%"
        statement = statement.where(
            (col(Player.gamertag).ilike(search_filter))
            | (col(Player.ea_id).ilike(search_filter))
        )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.order_by(Player.gamertag).offset(skip).limit(limit)
    players = session.exec(statement).all()

    return PlayersPublic(data=players, count=count)


@router.get("/{ea_id}", response_model=PlayerPublic)
def read_player(
    *,
    session: SessionDep,
    ea_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get player by EA ID.
    """
    player = session.get(Player, ea_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player
