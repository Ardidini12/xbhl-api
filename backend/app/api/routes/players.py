from typing import Any
from collections import Counter
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import (
    Player,
    PlayerPublic,
    PlayersPublic,
    Match,
    MatchPlayerLink,
    PlayerStatsPublic,
    LeagueStats,
    SeasonStats,
)

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
        players_data = match.raw_data.get("players")
        if not isinstance(players_data, dict):
            continue
            
        for club_id, club_players in players_data.items():
            if not isinstance(club_players, dict):
                continue
                
            player_info = club_players.get(ea_id)
            if isinstance(player_info, dict):
                raw_pos = player_info.get("position")
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


@router.get("/{ea_id}/stats", response_model=PlayerStatsPublic)
def read_player_stats(
    *,
    session: SessionDep,
    ea_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get player statistics grouped by league and season.
    """
    player = session.get(Player, ea_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Efficiently query matches using the link table
    statement = (
        select(Match)
        .join(MatchPlayerLink, Match.match_id == MatchPlayerLink.match_id)
        .where(MatchPlayerLink.player_ea_id == ea_id)
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

    return PlayerStatsPublic(
        total_matches=total_matches,
        leagues=league_stats_list
    )
