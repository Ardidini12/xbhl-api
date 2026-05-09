import asyncio
import logging
import random
from datetime import datetime, timezone

import httpx
from sqlmodel import Session, select

from app.models import Club, Match, Scheduler, Season

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
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://www.ea.com',
        'referer': 'https://www.ea.com/',
        'user-agent': random.choice(USER_AGENTS),
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
    }

async def process_club_matches(
    client: httpx.AsyncClient,
    ea_id: str,
    scheduler: Scheduler,
    session: Session,
    semaphore: asyncio.Semaphore
) -> dict:
    async with semaphore:
        # Jitter to avoid bot detection (500ms - 1500ms)
        await asyncio.sleep(random.uniform(0.5, 1.5))
        
        params = {
            'matchType': 'club_private',
            'platform': 'common-gen5',
            'clubIds': ea_id
        }
        
        new_count = 0
        processed_count = 0
        errors = []

        try:
            response = await client.get(EA_API_URL, headers=get_headers(), params=params)
            response.raise_for_status()
            matches_data = response.json()

            if not isinstance(matches_data, list):
                return {"new": 0, "processed": 0, "errors": [f"Club {ea_id}: Unexpected format"]}

            for match_data in matches_data:
                raw_id = match_data.get('matchId')
                if not raw_id:
                    continue
                match_id = str(raw_id)
                processed_count += 1

                # 1. Deduplication check - ONLY check if match_id exists globally
                existing_match = session.get(Match, match_id)
                if existing_match:
                    continue

                # 2. Simplified Capture: If it's a new match for this club, save it.
                # We associate it with the current scheduler's league/season for now.
                new_match = Match(
                    match_id=match_id,
                    league_id=scheduler.league_id,
                    season_id=scheduler.season_id,
                    raw_data=match_data
                )
                session.add(new_match)
                new_count += 1

            session.commit()
        except Exception as e:
            session.rollback()
            errors.append(f"Club {ea_id}: {str(e)[:50]}")
            
        return {"new": new_count, "processed": processed_count, "errors": errors}

async def pull_ea_data(session: Session, scheduler: Scheduler) -> str:
    season = session.get(Season, scheduler.season_id)
    if not season:
        return f"Error: Season {scheduler.season_id} not found"

    clubs = season.clubs
    # We pull for every club in the season
    ea_ids = [club.ea_id for club in clubs if club.ea_id]

    if not ea_ids:
        summary = f"No clubs with EA ID found for season {scheduler.season_id}"
        scheduler.last_run_status = summary
        scheduler.last_run_at = datetime.now(timezone.utc)
        session.add(scheduler)
        session.commit()
        return summary

    total_new = 0
    total_processed = 0
    all_errors = []

    # Parallel workers (concurrency 5 to be safe but fast)
    semaphore = asyncio.Semaphore(5) 
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [
            process_club_matches(client, ea_id, scheduler, session, semaphore)
            for ea_id in ea_ids
        ]
        results = await asyncio.gather(*tasks)

    for res in results:
        total_new += res["new"]
        total_processed += res["processed"]
        all_errors.extend(res["errors"])

    summary = f"Success: {total_new} new matches from {total_processed} processed."
    if all_errors:
        summary += f" ({len(all_errors)} errors)"

    scheduler.last_run_at = datetime.now(timezone.utc)
    scheduler.last_run_status = summary
    session.add(scheduler)
    session.commit()
    return summary
