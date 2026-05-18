import asyncio
import logging
import random
from datetime import datetime, timezone

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import SessionLocal, engine
from app.models import (
    Match,
    Player,
    Scheduler,
    SchedulerActivity,
    Season,
    UnsavedMatch,
)

logger = logging.getLogger(__name__)

EA_API_URL = "https://proclubs.ea.com/api/nhl/clubs/matches"

USER_AGENTS = [
    # Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    # Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:151.0) Gecko/20100101 Firefox/151.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.4 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.4 Mobile/15E148 Safari/604.1",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
]


def get_headers():
    return {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "origin": "https://www.ea.com",
        "referer": "https://www.ea.com/",
        "user-agent": random.choice(USER_AGENTS),
        "Connection": "keep-alive",
        "Cache-Control": "max-age=0",
    }


async def save_players(
    session: Session,
    match_data: dict,
    processed_players: set[str],
    player_lock: asyncio.Lock,
):
    """
    Extract players from match data and save to DB if they don't exist.
    """
    players_data = match_data.get("players", {})
    if not isinstance(players_data, dict):
        return

    for _club_id, club_players in players_data.items():
        if not isinstance(club_players, dict):
            continue
        for p_ea_id, p_info in club_players.items():
            if not isinstance(p_info, dict):
                continue

            if not p_ea_id:
                continue

            async with player_lock:
                gamertag = p_info.get("playername")
                if not gamertag:
                    continue

                if not session.get(Player, p_ea_id):
                    new_player = Player(ea_id=p_ea_id, gamertag=gamertag)
                    session.add(new_player)
                    session.flush()

                processed_players.add(p_ea_id)


def save_players_sync(session: Session, match_data: dict):
    """
    Synchronous version of save_players to extract players from match data
    and save to DB if they don't exist.
    """
    players_data = match_data.get("players", {})
    if not isinstance(players_data, dict):
        return

    for _club_id, club_players in players_data.items():
        if not isinstance(club_players, dict):
            continue
        for p_ea_id, p_info in club_players.items():
            if not isinstance(p_info, dict):
                continue

            if not p_ea_id:
                continue

            gamertag = p_info.get("playername")
            if not gamertag:
                continue

            if not session.get(Player, p_ea_id):
                new_player = Player(ea_id=p_ea_id, gamertag=gamertag)
                session.add(new_player)
                session.flush()


def save_match_links(session: Session, match_data: dict, match_id: str):
    """
    Create MatchPlayerLink for every player in a valid Match.
    """
    from app.models import MatchPlayerLink, Player
    players_data = match_data.get("players", {})
    if not isinstance(players_data, dict):
        return

    for _club_id, club_players in players_data.items():
        if not isinstance(club_players, dict):
            continue
        for p_ea_id in club_players.keys():
            if not p_ea_id:
                continue
            
            # Ensure player exists before linking to avoid FK violation
            if not session.get(Player, p_ea_id):
                logger.warning(f"Skipping link for player {p_ea_id}: Player not found in DB")
                continue

            if not session.get(MatchPlayerLink, (match_id, p_ea_id)):
                new_link = MatchPlayerLink(match_id=match_id, player_ea_id=p_ea_id)
                session.add(new_link)


async def process_club_matches(
    client: httpx.AsyncClient,
    ea_id: str,
    scheduler: Scheduler,
    season_club_ea_ids: set[str],
    semaphore: asyncio.Semaphore,
    processed_players: set[str],  # Shared cache for this run
    player_lock: asyncio.Lock,
) -> dict:
    # Jitter to avoid bot detection (500ms - 1500ms) - outside semaphore to avoid throttling
    await asyncio.sleep(random.uniform(0.5, 1.5))

    async with semaphore:
        params = {
            "matchType": "club_private",
            "platform": "common-gen5",
            "clubIds": ea_id,
        }

        new_count = 0
        unsaved_count = 0
        processed_count = 0
        errors = []
        details = []

        with SessionLocal() as session:
            try:
                response = await client.get(
                    EA_API_URL, headers=get_headers(), params=params
                )
                response.raise_for_status()
                matches_data = response.json()
            except Exception as e:
                return {
                    "new": 0,
                    "unsaved": 0,
                    "processed": 0,
                    "errors": [f"Club {ea_id}: Request error: {str(e)[:100]}"],
                    "details": [],
                }

            if not isinstance(matches_data, list):
                return {
                    "new": 0,
                    "unsaved": 0,
                    "processed": 0,
                    "errors": [f"Club {ea_id}: Unexpected format"],
                    "details": [],
                }

            for match_data in matches_data:
                try:
                    raw_id = match_data.get("matchId")
                    if not raw_id:
                        continue
                    match_id = str(raw_id)
                    processed_count += 1

                    # 1. Global Deduplication: Check Match AND UnsavedMatch
                    if session.get(Match, match_id) or session.get(UnsavedMatch, match_id):
                        continue

                    # 2. Two-Club Verification
                    clubs_in_match = match_data.get("clubs", {})
                    match_club_ids = set(clubs_in_match.keys())
                    
                    # Intersect match clubs with our season clubs
                    matching_clubs = match_club_ids.intersection(season_club_ea_ids)
                    
                    if len(matching_clubs) >= 1:
                        # A. Persistent Player Save: Commit players first
                        await save_players(session, match_data, processed_players, player_lock)
                        session.commit()

                        # B. Persistent Match Save: Commit match independently
                        if len(matching_clubs) == len(match_club_ids) and len(matching_clubs) >= 2:
                            # Success: Both clubs are in our season
                            new_match = Match(
                                match_id=match_id,
                                league_id=scheduler.league_id,
                                season_id=scheduler.season_id,
                                raw_data=match_data,
                            )
                            session.add(new_match)
                            
                            # Create links only for confirmed Match
                            save_match_links(session, match_data, match_id)
                            
                            session.commit()
                            new_count += 1
                            details.append({"match_id": match_id, "status": "saved"})
                        elif len(matching_clubs) == 1:
                            # Partial: Only one club matches
                            unsaved_match = UnsavedMatch(
                                match_id=match_id,
                                league_id=scheduler.league_id,
                                season_id=scheduler.season_id,
                                scheduler_id=scheduler.id,
                                raw_data=match_data,
                                reason=f"Only one club in season: {list(matching_clubs)[0]}",
                            )
                            session.add(unsaved_match)
                            session.commit()
                            unsaved_count += 1
                            details.append({"match_id": match_id, "status": "unsaved", "reason": "single_club"})
                    else:
                        # None: Should rarely happen as we fetch by clubId, but for safety
                        details.append({"match_id": match_id, "status": "ignored", "reason": "no_clubs_match"})

                except Exception as e:
                    session.rollback()
                    errors.append(f"Club {ea_id}: Match {match_data.get('matchId', 'unknown')} error: {str(e)[:100]}")

        return {
            "new": new_count,
            "unsaved": unsaved_count,
            "processed": processed_count,
            "errors": errors,
            "details": details,
        }


async def pull_ea_data(session: Session, scheduler: Scheduler) -> str:
    # 1. Initialize Activity Log
    activity = SchedulerActivity(
        scheduler_id=scheduler.id,
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    try:
        season = session.get(Season, scheduler.season_id)
        if not season:
            summary = f"Error: Season {scheduler.season_id} not found"
            activity.status = "error"
            activity.summary = summary
            activity.finished_at = datetime.now(timezone.utc)
            session.add(activity)
            session.commit()
            return summary

        clubs = season.clubs
        season_club_ea_ids = {club.ea_id for club in clubs if club.ea_id}

        if not season_club_ea_ids:
            summary = f"No clubs with EA ID found for season {scheduler.season_id}"
            scheduler.last_run_status = summary
            scheduler.last_run_at = datetime.now(timezone.utc)
            activity.status = "success"
            activity.summary = summary
            activity.finished_at = datetime.now(timezone.utc)
            session.add(scheduler)
            session.add(activity)
            session.commit()
            return summary

        total_new = 0
        total_unsaved = 0
        total_processed = 0
        all_errors = []
        all_details = {}

        # Shared player cache for this run
        processed_players = set()
        player_lock = asyncio.Lock()

        # Parallel workers with configurable concurrency limit
        semaphore = asyncio.Semaphore(settings.EA_API_CONCURRENCY_LIMIT)

        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [
                process_club_matches(
                    client,
                    ea_id,
                    scheduler,
                    season_club_ea_ids,
                    semaphore,
                    processed_players,
                    player_lock,
                )
                for ea_id in season_club_ea_ids
            ]
            results = await asyncio.gather(*tasks)

        for i, res in enumerate(results):
            club_ea_id = list(season_club_ea_ids)[i]
            total_new += res["new"]
            total_unsaved += res["unsaved"]
            total_processed += res["processed"]
            all_errors.extend(res["errors"])
            all_details[club_ea_id] = {
                "new": res["new"],
                "unsaved": res["unsaved"],
                "processed": res["processed"],
                "errors": res["errors"],
                "matches": res["details"],
            }

        summary = f"Success: {total_new} saved, {total_unsaved} unsaved from {total_processed} processed."
        if all_errors:
            summary += f" ({len(all_errors)} errors)"

        # 2. Finalize Activity Log and Scheduler Status
        scheduler.last_run_at = datetime.now(timezone.utc)
        scheduler.last_run_status = summary
        
        activity.status = "success"
        activity.summary = summary
        activity.details = all_details
        activity.finished_at = datetime.now(timezone.utc)

        session.add(scheduler)
        session.add(activity)
        session.commit()
        return summary

    except Exception as e:
        logger.exception(f"Critical error in scheduler {scheduler.id}")
        summary = f"Critical Error: {str(e)[:255]}"
        activity.status = "error"
        activity.summary = summary
        activity.finished_at = datetime.now(timezone.utc)
        session.add(activity)
        session.commit()
        return summary
