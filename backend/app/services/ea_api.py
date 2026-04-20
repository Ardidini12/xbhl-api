import logging
from datetime import datetime, timezone

import httpx
from sqlmodel import Session

from app.models import Match, Scheduler, Season

logger = logging.getLogger(__name__)

EA_API_URL = "https://proclubs.ea.com/api/nhl/clubs/matches"

HEADERS = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9,sq;q=0.8,hy;q=0.7',
    'origin': 'https://www.ea.com',
    'referer': 'https://www.ea.com/',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
}

async def pull_ea_data(session: Session, scheduler: Scheduler) -> None:
    # Get season for this scheduler
    season = session.get(Season, scheduler.season_id)
    if not season:
        logger.error(f"Season {scheduler.season_id} not found for scheduler {scheduler.id}")
        return

    # Use relationship to get clubs
    clubs = season.clubs
    ea_club_ids = [club.ea_id for club in clubs if club.ea_id]

    if not ea_club_ids:
        logger.info(f"No clubs with EA ID found for season {scheduler.season_id}")
        return

    async with httpx.AsyncClient(timeout=30.0) as client:
        for ea_id in ea_club_ids:
            params = {
                'matchType': 'club_private',
                'platform': 'common-gen5',
                'clubIds': ea_id
            }
            try:
                response = await client.get(EA_API_URL, headers=HEADERS, params=params)
                response.raise_for_status()
                matches_data = response.json()

                if not isinstance(matches_data, list):
                    logger.error(f"Unexpected response format from EA API for club {ea_id}")
                    continue

                for match_data in matches_data:
                    raw_id = match_data.get('matchId')
                    if raw_id is None or raw_id == '':
                        continue
                    match_id = str(raw_id)

                    # Check if match already exists
                    existing_match = session.get(Match, match_id)
                    if not existing_match:
                        new_match = Match(
                            match_id=match_id,
                            league_id=scheduler.league_id,
                            season_id=scheduler.season_id,
                            raw_data=match_data
                        )
                        session.add(new_match)
                        logger.info(f"Inserted new match {match_id} for league {scheduler.league_id}")
                    # else:
                    #     # Optional: Update existing match data if needed
                    #     existing_match.raw_data = match_data
                    #     session.add(existing_match)

                session.commit()
            except Exception as e:
                session.rollback()
                logger.error(f"Error fetching data for club {ea_id}: {e}")
                continue

    scheduler.last_run_at = datetime.now(timezone.utc)
    session.add(scheduler)
    session.commit()
