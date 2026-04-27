import asyncio
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Club, ClubCreate, League, LeagueCreate, Match, Scheduler, SchedulerCreate, Season, SeasonCreate
from app.services.ea_api import pull_ea_data


@pytest.mark.anyio
async def test_scheduler_pull_integration(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create a Test League
    league_in = LeagueCreate(name="Test Integration League", description="Test League for EA Pull")
    response = client.post(
        f"{settings.API_V1_STR}/leagues/",
        headers=superuser_token_headers,
        json=league_in.model_dump(mode="json"),
    )
    assert response.status_code == 200
    league_id = response.json()["id"]

    # 2. Create a Test Season
    season_in = SeasonCreate(name="Test Integration Season", league_id=league_id)
    response = client.post(
        f"{settings.API_V1_STR}/seasons/",
        headers=superuser_token_headers,
        json=season_in.model_dump(mode="json"),
    )
    assert response.status_code == 200
    season_id = response.json()["id"]

    # 3. Create Clubs and add to Season
    clubs_data = [
        ("VVHL PORTAGE MONEYSHOTS", "11929"),
        ("VVHL Southbeach Snipers", "137"),
        ("VVHL Angry Byrds", "22015"),
        ("VVHL Anbu Crusaders", "157692"),
        ("VVHL Back Alley Brawlers", "146580"),
        ("VVHL Big Dawgs", "158801"),
        ("VVHL Brick City Bruisers", "142628"),
        ("VVHL Crease Police", "55435"),
        ("VVHL Degenerates", "7781"),
        ("VVHL Dreadhounds", "73524"),
        ("VVHL Egg Farmers", "161660"),
        ("VVHL Invasion", "170478"),
        ("VVHL Iron Waltz", "168723"),
        ("VVHL Knights", "161395"),
        ("VVHL Mega Flowers", "148416"),
        ("VVHL Polar Titans", "167876"),
        ("VVHL Raptors", "97368"),
        ("VVHL Revolution", "161407"),
        ("VVHL Smoke Eaters", "56087"),
        ("VVHL Soul Reapers", "149300"),
    ]

    club_ids = []
    for name, ea_id in clubs_data:
        # Check if club exists first to avoid duplicates in case of re-run
        # Actually in tests 'db' fixture usually cleans up, but let's be safe or just create.
        # Use API to create so it follows the logic
        club_in = {"name": name, "ea_id": ea_id}
        resp = client.post(
            f"{settings.API_V1_STR}/clubs/",
            headers=superuser_token_headers,
            json=club_in,
        )
        assert resp.status_code == 200
        club_ids.append(resp.json()["id"])

    # Add clubs to season
    response = client.post(
        f"{settings.API_V1_STR}/seasons/{season_id}/clubs",
        headers=superuser_token_headers,
        json=club_ids,
    )
    assert response.status_code == 200

    # 4. Create Scheduler
    scheduler_in = {
        "league_id": league_id,
        "season_id": season_id,
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "start_time": "00:00:00",
        "end_time": "23:59:59",
        "interval_minutes": 1,
        "is_enabled": True
    }
    response = client.post(
        f"{settings.API_V1_STR}/schedulers/",
        headers=superuser_token_headers,
        json=scheduler_in,
    )
    assert response.status_code == 200
    scheduler_id = response.json()["id"]

    # 5. Trigger Pull (Manual call to service for testing)
    # We need to refresh the db session or get a new one to have the latest data
    db.expire_all()
    db_scheduler = db.get(Scheduler, scheduler_id)
    assert db_scheduler is not None

    print(f"Starting EA pull for {len(clubs_data)} clubs...")
    summary = await pull_ea_data(db, db_scheduler)
    print(f"EA pull completed: {summary}")

    # Verify last_run_status is updated
    db.refresh(db_scheduler)
    assert db_scheduler.last_run_status == summary
    assert "Success" in db_scheduler.last_run_status

    # 6. Verify matches are saved
    matches_statement = select(Match).where(Match.season_id == season_id)
    matches = db.exec(matches_statement).all()
    
    print(f"Found {len(matches)} matches saved for season {season_id}")
    assert len(matches) > 0
