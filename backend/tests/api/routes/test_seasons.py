from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import League, LeagueCreate, Season, SeasonCreate
from tests.utils.utils import random_lower_string


def test_create_season(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    name = random_lower_string()
    description = random_lower_string()
    data = {"name": name, "description": description, "league_id": str(league.id)}
    response = client.post(
        f"{settings.API_V1_STR}/seasons/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == name
    assert content["description"] == description
    assert content["league_id"] == str(league.id)
    assert "id" in content


def test_read_seasons(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    name = random_lower_string()
    season_in = SeasonCreate(name=name, league_id=league.id)
    season = Season.model_validate(season_in)
    db.add(season)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/seasons/?league_id={league.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 1
    assert any(s["name"] == name for s in content["data"])


def test_update_season(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    season_in = SeasonCreate(name=random_lower_string(), league_id=league.id)
    season = Season.model_validate(season_in)
    db.add(season)
    db.commit()
    db.refresh(season)

    new_name = random_lower_string()
    data = {"name": new_name}
    response = client.patch(
        f"{settings.API_V1_STR}/seasons/{season.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == new_name


def test_end_season(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    season_in = SeasonCreate(name=random_lower_string(), league_id=league.id)
    season = Season.model_validate(season_in)
    db.add(season)
    db.commit()
    db.refresh(season)

    assert season.end_date is None

    response = client.post(
        f"{settings.API_V1_STR}/seasons/{season.id}/end",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["end_date"] is not None


def test_delete_season(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    season_in = SeasonCreate(name=random_lower_string(), league_id=league.id)
    season = Season.model_validate(season_in)
    db.add(season)
    db.commit()
    db.refresh(season)

    response = client.delete(
        f"{settings.API_V1_STR}/seasons/{season.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Season deleted successfully"


def test_search_seasons(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    unique_name = "UniqueSeasonSearch" + random_lower_string()
    season = Season.model_validate(SeasonCreate(name=unique_name, league_id=league.id))
    db.add(season)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/seasons/?search={unique_name}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) == 1
    assert content["data"][0]["name"] == unique_name
