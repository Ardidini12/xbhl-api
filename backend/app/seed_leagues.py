import logging
from sqlmodel import Session, select
from app.core.db import engine
from app.models import League, LeagueCreate
from app import crud

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_leagues() -> None:
    with Session(engine) as session:
        # Check if we already have leagues to avoid duplicates if run multiple times
        existing_leagues = session.exec(select(League)).first()
        if existing_leagues:
            logger.info("Leagues already exist, skipping seeding")
            return

        logger.info("Seeding 100 leagues")
        leagues = []
        for i in range(1, 101):
            league_in = LeagueCreate(
                name=f"League {i:03d}",
                description=f"Description for XBHL League {i:03d}"
            )
            leagues.append(League.model_validate(league_in))
        
        session.add_all(leagues)
        session.commit()
        logger.info("Successfully seeded 100 leagues")

if __name__ == "__main__":
    seed_leagues()
