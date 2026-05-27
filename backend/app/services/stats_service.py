import uuid
import logging
from sqlmodel import Session, select
from app.models import Match, MatchPlayerStats, PlayerAggregateStats, League, Season

logger = logging.getLogger(__name__)

def get_or_create_aggregate(
    session: Session, 
    player_ea_id: str, 
    league_id: uuid.UUID | None = None, 
    season_id: uuid.UUID | None = None
) -> PlayerAggregateStats:
    statement = select(PlayerAggregateStats).where(
        PlayerAggregateStats.player_ea_id == player_ea_id,
        PlayerAggregateStats.league_id == league_id,
        PlayerAggregateStats.season_id == season_id
    )
    agg = session.exec(statement).first()
    if not agg:
        agg = PlayerAggregateStats(
            player_ea_id=player_ea_id,
            league_id=league_id,
            season_id=season_id
        )
        session.add(agg)
        session.flush()
    return agg

def update_aggregate(agg: PlayerAggregateStats, stats: MatchPlayerStats, multiplier: int):
    """
    multiplier: 1 for adding, -1 for subtracting
    """
    agg.games_played += (1 * multiplier)
    agg.wins += (stats.win * multiplier)
    agg.losses += (stats.loss * multiplier)
    agg.otl += (stats.otl * multiplier)
    
    agg.goals += (stats.skgoals * multiplier)
    agg.game_winning_goals += (stats.skgwg * multiplier)
    agg.assists += (stats.skassists * multiplier)
    agg.possession_seconds += (stats.skpossession * multiplier)
    agg.plus_minus += (stats.skplusmin * multiplier)
    agg.shots += (stats.skshots * multiplier)
    agg.shot_attempts += (stats.skshotattempts * multiplier)
    agg.deflections += (stats.skdeflections * multiplier)
    agg.passes += (stats.skpasses * multiplier)
    agg.pass_attempts += (stats.skpassattempts * multiplier)
    agg.saucer_passes += (stats.sksaucerpasses * multiplier)
    agg.hits += (stats.skhits * multiplier)
    agg.giveaways += (stats.skgiveaways * multiplier)
    agg.takeaways += (stats.sktakeaways * multiplier)
    agg.interceptions += (stats.skinterceptions * multiplier)
    agg.blocked_shots += (stats.skbs * multiplier)
    agg.penalty_minutes += (stats.skpim * multiplier)
    agg.penalties_drawn += (stats.skpenaltiesdrawn * multiplier)
    agg.penalty_clears += (stats.skpkclearzone * multiplier)
    agg.faceoffs_won += (stats.skfow * multiplier)
    agg.faceoffs_lost += (stats.skfol * multiplier)
    
    agg.sum_shot_pct += (stats.skshotpct * multiplier)
    agg.sum_shot_on_net_pct += (stats.skshotonnetpct * multiplier)
    agg.sum_pass_pct += (stats.skpasspct * multiplier)
    agg.sum_fo_pct += (stats.skfopct * multiplier)

def process_match_stats(session: Session, match_id: str, action: str = "add"):
    """
    Calculates and applies stats for all players in a match.
    action: "add" or "subtract"
    """
    multiplier = 1 if action == "add" else -1
    
    if action == "add":
        match = session.get(Match, match_id)
        if not match:
            return
        
        raw_data = match.raw_data
        players_data = raw_data.get("players", {})
        clubs_data = raw_data.get("clubs", {})
        
        # Determine if the match went into overtime (TOI > 60 minutes / 3600 seconds)
        max_toi = 0
        for club_players in players_data.values():
            for p_info in club_players.values():
                toi = int(p_info.get("toiseconds", 0))
                if toi > max_toi:
                    max_toi = toi
        is_overtime = max_toi > 3600

        for club_id, club_players in players_data.items():
            # Determine Win/Loss/OTL for this club based on score and overtime status
            club_info = clubs_data.get(club_id, {})
            score = int(club_info.get("score", 0))
            opp_score = int(club_info.get("opponentScore", 0))
            
            is_win = score > opp_score
            is_otl = not is_win and is_overtime
            is_loss = not is_win and not is_overtime
            
            for p_ea_id, p_info in club_players.items():
                if not p_ea_id or not isinstance(p_info, dict):
                    continue
                
                # 1. Create MatchPlayerStats (History Entry)
                stats = MatchPlayerStats(
                    match_id=match_id,
                    player_ea_id=p_ea_id,
                    position=p_info.get("position", "N/A"),
                    win=1 if is_win else 0,
                    loss=1 if is_loss else 0,
                    otl=1 if is_otl else 0,
                    skgoals=int(p_info.get("skgoals", 0)),
                    skgwg=int(p_info.get("skgwg", 0)),
                    skassists=int(p_info.get("skassists", 0)),
                    skpossession=int(p_info.get("skpossession", 0)),
                    skplusmin=int(p_info.get("skplusmin", 0)),
                    skshots=int(p_info.get("skshots", 0)),
                    skshotattempts=int(p_info.get("skshotattempts", 0)),
                    skshotpct=float(p_info.get("skshotpct", 0.0)),
                    skshotonnetpct=float(p_info.get("skshotonnetpct", 0.0)),
                    skdeflections=int(p_info.get("skdeflections", 0)),
                    skpasses=int(p_info.get("skpasses", 0)),
                    skpassattempts=int(p_info.get("skpassattempts", 0)),
                    skpasspct=float(p_info.get("skpasspct", 0.0)),
                    sksaucerpasses=int(p_info.get("sksaucerpasses", 0)),
                    skhits=int(p_info.get("skhits", 0)),
                    skgiveaways=int(p_info.get("skgiveaways", 0)),
                    sktakeaways=int(p_info.get("sktakeaways", 0)),
                    skinterceptions=int(p_info.get("skinterceptions", 0)),
                    skbs=int(p_info.get("skbs", 0)),
                    skpim=int(p_info.get("skpim", 0)),
                    skpenaltiesdrawn=int(p_info.get("skpenaltiesdrawn", 0)),
                    skpkclearzone=int(p_info.get("skpkclearzone", 0)),
                    skfow=int(p_info.get("skfow", 0)),
                    skfol=int(p_info.get("skfol", 0)),
                    skfopct=float(p_info.get("skfopct", 0.0)),
                )
                session.add(stats)
                
                # 2. Update Aggregates (Season, League, Career)
                for l_id, s_id in [
                    (match.league_id, match.season_id), # Season
                    (match.league_id, None),             # League Career
                    (None, None)                         # Overall Career
                ]:
                    agg = get_or_create_aggregate(session, p_ea_id, l_id, s_id)
                    update_aggregate(agg, stats, 1)
                    session.add(agg)

    elif action == "subtract":
        # Find history entries for this match
        statement = select(MatchPlayerStats).where(MatchPlayerStats.match_id == match_id)
        history_entries = session.exec(statement).all()
        
        match = session.get(Match, match_id)
        if not match:
            # If match record is already gone, we need to know its league/season
            # This shouldn't happen if we call subtract before delete
            return

        for stats in history_entries:
            p_ea_id = stats.player_ea_id
            
            # Update Aggregates (Season, League, Career)
            for l_id, s_id in [
                (match.league_id, match.season_id), # Season
                (match.league_id, None),             # League Career
                (None, None)                         # Overall Career
            ]:
                agg = get_or_create_aggregate(session, p_ea_id, l_id, s_id)
                update_aggregate(agg, stats, -1)
                session.add(agg)
            
            # Delete history entry
            session.delete(stats)
