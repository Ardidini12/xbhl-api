from typing import Any
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import Player, PlayerPublic, PlayersPublic, Match, MatchPlayerLink

router = APIRouter(prefix="/players", tags=["players"])

POSITION_MAPPING = {
    "defenseMen": "Defense",
    "center": "Center",
    "leftWing": "LW",
    "rightWing": "RW",
    "goalie": "Goalie",
}

def get_most_frequent_position(session: SessionDep, ea_id: str) -> str | None:
    # 1. Find all matches for this player
    statement = (
        select(Match)
        .join(MatchPlayerLink, Match.match_id == MatchPlayerLink.match_id)
        .where(MatchPlayerLink.player_ea_id == ea_id)
    )
    matches = session.exec(statement).all()
    
    if not matches:
        return None
        
    positions = []
    for match in matches:
        # 2. Extract position from raw_data
        players_data = match.raw_data.get("players", {})
        for club_id, club_players in players_data.items():
            if ea_id in club_players:
                raw_pos = club_players[ea_id].get("position")
                if raw_pos:
                    # Map to readable name if possible
                    positions.append(POSITION_MAPPING.get(raw_pos, raw_pos))
                break
                
    if not positions:
        return None
        
    # 3. Find most common
    most_common = Counter(positions).most_common(1)
    return most_common[0][0] if most_common else None


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
    
    # Calculate most frequent position
    player_public = PlayerPublic.model_validate(player)
    player_public.most_frequent_position = get_most_frequent_position(session, ea_id)
    
    return player_public
