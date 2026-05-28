import uuid
from datetime import time
from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session

from app.models import Club, League, Match, Scheduler, Season
from app.services.ea_api import pull_ea_data


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
@patch("app.services.ea_api.SessionLocal")
async def test_pull_ea_data_simplified(mock_session_local, mock_get, db: Session):
    # Setup database state
    league = League(name="Test League", description="Test Description")
    db.add(league)
    db.commit()
    db.refresh(league)

    season = Season(id=uuid.uuid4(), name="Test Season", league_id=league.id)
    club1 = Club(id=uuid.uuid4(), name="Club 1", ea_id="101")
    club2 = Club(id=uuid.uuid4(), name="Club 2", ea_id="102")

    db.add(season)
    db.add(club1)
    db.add(club2)
    db.commit()

    # Link clubs to season
    from app.models import ClubSeasonLink

    db.add(ClubSeasonLink(club_id=club1.id, season_id=season.id))
    db.add(ClubSeasonLink(club_id=club2.id, season_id=season.id))
    db.commit()

    scheduler = Scheduler(
        id=uuid.uuid4(),
        league_id=league.id,
        season_id=season.id,
        days=["Wednesday"],
        start_time=time(0, 0),
        end_time=time(23, 59),
        is_enabled=True,
    )
    db.add(scheduler)
    db.commit()

    # Mock SessionLocal to return the test db session
    mock_session_local.return_value.__enter__.return_value = db

    # Mock EA API Response
    # Both clubs must be in the season for the match to be "saved"
    mock_match_1 = {
        "matchId": "any_match_123",
        "timestamp": 1234567890,
        "clubs": {"101": {}, "102": {}},  # Both clubs in our DB/season
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [mock_match_1]
    mock_response.raise_for_status = MagicMock()

    mock_get.return_value = mock_response

    summary = await pull_ea_data(db, scheduler)

    assert "1 saved" in summary

    # Verify match in DB
    saved_match = db.get(Match, "any_match_123")
    assert saved_match is not None
    assert saved_match.season_id == season.id
