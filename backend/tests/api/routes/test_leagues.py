from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import League, LeagueCreate, Season, SeasonCreate
from tests.utils.utils import random_lower_string


def test_create_league(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    name = random_lower_string()
    description = random_lower_string()
    data = {"name": name, "description": description}
    response = client.post(
        f"{settings.API_V1_STR}/leagues/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == name
    assert content["description"] == description
    assert "id" in content


def test_read_leagues(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    name = random_lower_string()
    league_in = LeagueCreate(name=name)
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/leagues/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 1
    assert any(league["name"] == name for league in content["data"])


def test_update_league(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    new_name = random_lower_string()
    data = {"name": new_name}
    response = client.patch(
        f"{settings.API_V1_STR}/leagues/{league.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == new_name


def test_delete_league(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    response = client.delete(
        f"{settings.API_V1_STR}/leagues/{league.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "League deleted successfully"


def test_bulk_delete_leagues(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    l1 = League.model_validate(LeagueCreate(name=random_lower_string()))
    l2 = League.model_validate(LeagueCreate(name=random_lower_string()))
    db.add(l1)
    db.add(l2)
    db.commit()
    db.refresh(l1)
    db.refresh(l2)

    data = [str(l1.id), str(l2.id)]
    response = client.post(
        f"{settings.API_V1_STR}/leagues/bulk-delete",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Leagues deleted successfully"


def test_search_leagues(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    unique_name = "UniqueLeagueSearch" + random_lower_string()
    league = League.model_validate(LeagueCreate(name=unique_name))
    db.add(league)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/leagues/?search={unique_name}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) == 1
    assert content["data"][0]["name"] == unique_name


def test_league_seasons_cascade_delete(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Create a league
    league_in = LeagueCreate(name=random_lower_string())
    league = League.model_validate(league_in)
    db.add(league)
    db.commit()
    db.refresh(league)

    # Create seasons for the league
    s1 = Season.model_validate(SeasonCreate(name=random_lower_string(), league_id=league.id))
    s2 = Season.model_validate(SeasonCreate(name=random_lower_string(), league_id=league.id))
    db.add(s1)
    db.add(s2)
    db.commit()
    db.refresh(s1)
    db.refresh(s2)

    season_ids = [s1.id, s2.id]

    # Verify seasons exist
    for sid in season_ids:
        assert db.get(Season, sid) is not None

    # Delete the league
    response = client.delete(
        f"{settings.API_V1_STR}/leagues/{league.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200

    # Verify seasons are deleted
    db.expire_all()
    for sid in season_ids:
        assert db.get(Season, sid) is None
