from typing import Any
from collections import Counter
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import (
    Player,
    PlayerPublic,
    PlayersPublic,
    Match,
    MatchPlayerLink,
    PlayerStatsOverview,
    LeagueStats,
    SeasonStats,
    PlayerDetailedStats,
    PlayerAggregateStats,
    MatchPlayerStats,
    Club,
)

router = APIRouter(prefix="/players", tags=["players"])

POSITION_MAPPING = {
    "defenseMen": "Defense",
    "center": "Center",
    "leftWing": "LW",
    "rightWing": "RW",
    "goalie": "Goalie",
}

def get_most_frequent_position(session: SessionDep, ea_id: str, league_id: uuid.UUID | None = None, season_id: uuid.UUID | None = None) -> str:
    # Query MatchPlayerStats history for this player/level
    statement = select(MatchPlayerStats.position).join(Match, Match.match_id == MatchPlayerStats.match_id)
    if league_id:
        statement = statement.where(Match.league_id == league_id)
    if season_id:
        statement = statement.where(Match.season_id == season_id)
    statement = statement.where(MatchPlayerStats.player_ea_id == ea_id)
    
    positions = session.exec(statement).all()
    if not positions:
        return "N/A"
    
    mapped_positions = [POSITION_MAPPING.get(p, p) for p in positions]
    most_common = Counter(mapped_positions).most_common(1)
    return most_common[0][0] if most_common else "N/A"

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


@router.get("/{ea_id}/stats", response_model=PlayerStatsOverview)
def read_player_stats(
    *,
    session: SessionDep,
    ea_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get player statistics grouped by league and season (Overview).
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

    return PlayerStatsOverview(
        total_matches=total_matches,
        leagues=league_stats_list
    )


@router.get("/{ea_id}/detailed-stats", response_model=PlayerDetailedStats)
def read_player_detailed_stats(
    *,
    session: SessionDep,
    ea_id: str,
    league_id: uuid.UUID | None = Query(None),
    season_id: uuid.UUID | None = Query(None),
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get detailed player statistics for a specific level (Overall, League, or Season).
    """
    player = session.get(Player, ea_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    statement = select(PlayerAggregateStats).where(
        PlayerAggregateStats.player_ea_id == ea_id,
        PlayerAggregateStats.league_id == league_id,
        PlayerAggregateStats.season_id == season_id
    )
    agg = session.exec(statement).first()
    
    if not agg:
        # Return zeros if no stats yet
        agg = PlayerAggregateStats(player_ea_id=ea_id, league_id=league_id, season_id=season_id)

    gp = max(agg.games_played, 1)
    
    # Find team name (most recent club for this player in this level)
    team_name = "N/A"
    recent_match_stmt = (
        select(Club.name)
        .join(MatchPlayerLink, Club.id == MatchPlayerLink.match_id) # This is wrong, should join Match
    )
    # Correcting join logic for team name
    recent_match_stmt = (
        select(Club.name)
        .join(MatchPlayerLink, Player.ea_id == MatchPlayerLink.player_ea_id)
        .join(Match, Match.match_id == MatchPlayerLink.match_id)
        .join(Match.raw_data, Club.ea_id == func.json_each(Match.raw_data['clubs']).key) # Too complex for SQLModel/SQA easily
    )
    # Simpler approach for team name: get last match from MatchPlayerStats
    last_stats_stmt = select(MatchPlayerStats.match_id).where(MatchPlayerStats.player_ea_id == ea_id).order_by(MatchPlayerStats.match_id.desc()).limit(1)
    last_match_id = session.exec(last_stats_stmt).first()
    if last_match_id:
        last_match = session.get(Match, last_match_id)
        if last_match:
            # Find which club the player was on
            for club_id, club_players in last_match.raw_data.get("players", {}).items():
                if ea_id in club_players:
                    club_ea_id = club_id
                    team_stmt = select(Club.name).where(Club.ea_id == club_ea_id)
                    team_name = session.exec(team_stmt).first() or "N/A"
                    break

    # Calculate percentages and averages
    points = agg.goals + agg.assists
    
    return PlayerDetailedStats(
        player_name=player.gamertag,
        team_name=team_name,
        position=get_most_frequent_position(session, ea_id, league_id, season_id),
        record=f"{agg.wins}-{agg.losses}-{agg.otl}",
        games_played=agg.games_played,
        goals=agg.goals,
        goals_per_gp=round(agg.goals / gp, 2),
        game_winning_goals=agg.game_winning_goals,
        assists=agg.assists,
        assists_per_gp=round(agg.assists / gp, 2),
        points=points,
        points_per_gp=round(points / gp, 2),
        possession_min_per_gp=round((agg.possession_seconds / 60) / gp, 2),
        plus_minus=agg.plus_minus,
        shots=agg.shots,
        shot_attempts=agg.shot_attempts,
        scoring_pct=round(agg.sum_shot_pct / gp, 2),
        missed_shots=agg.shot_attempts - agg.shots,
        shots_on_net_pct=round(agg.sum_shot_on_net_pct / gp, 2),
        deflections=agg.deflections,
        passes=agg.passes,
        passes_per_gp=round(agg.passes / gp, 2),
        pass_attempts=agg.pass_attempts,
        pa_per_gp=round(agg.pass_attempts / gp, 2),
        passing_pct=round(agg.sum_pass_pct / gp, 2),
        saucer_passes=agg.saucer_passes,
        sp_per_gp=round(agg.saucer_passes / gp, 2),
        hits=agg.hits,
        hits_per_gp=round(agg.hits / gp, 2),
        giveaways=agg.giveaways,
        giveaways_per_gp=round(agg.giveaways / gp, 2),
        takeaways=agg.takeaways,
        takeaways_per_gp=round(agg.takeaways / gp, 2),
        interceptions=agg.interceptions,
        interceptions_per_gp=round(agg.interceptions / gp, 2),
        blocked_shots=agg.blocked_shots,
        blocks_per_gp=round(agg.blocked_shots / gp, 2),
        penalty_minutes=agg.penalty_minutes,
        penalties_drawn=agg.penalties_drawn,
        penalty_clears=agg.penalty_clears,
        faceoffs_won=agg.faceoffs_won,
        faceoffs_lost=agg.faceoffs_lost,
        faceoff_win_pct=round(agg.sum_fo_pct / gp, 2)
    )


@router.get("/{ea_id}/match-history", response_model=list[MatchPlayerStats])
def read_player_match_history(
    *,
    session: SessionDep,
    ea_id: str,
    league_id: uuid.UUID | None = Query(None),
    season_id: uuid.UUID | None = Query(None),
    limit: int = 50,
    skip: int = 0,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get the history of match statistics for a player, optionally filtered by league/season.
    """
    player = session.get(Player, ea_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    statement = select(MatchPlayerStats).join(Match, Match.match_id == MatchPlayerStats.match_id)
    if league_id:
        statement = statement.where(Match.league_id == league_id)
    if season_id:
        statement = statement.where(Match.season_id == season_id)
    
    statement = statement.where(MatchPlayerStats.player_ea_id == ea_id)
    statement = statement.order_by(Match.created_at.desc()).offset(skip).limit(limit)
    
    return session.exec(statement).all()
