import uuid
import pytest
import respx
import httpx
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Club, ClubCreate
from tests.utils.utils import random_lower_string

# ---------------------------------------------------------------------------
# Deterministic EA API mock
# ---------------------------------------------------------------------------
EA_MOCK_RESPONSES = {
    "Zambroneez": {"8501": {"clubName": "Zambroneez"}},
    "QCHL3s Canadien MTL": {"220": {"clubName": "QCHL3s Canadien MTL"}},
}

EA_BASE_URL = "https://proclubs.ea.com/api/nhl/clubs/search"


@pytest.fixture()
def mock_ea_api():
    """Intercept all EA Pro Clubs search requests and return deterministic data."""
    with respx.mock(assert_all_called=False) as mock:
        for club_name, payload in EA_MOCK_RESPONSES.items():
            from urllib.parse import quote
            encoded = quote(club_name)
            mock.get(
                f"{EA_BASE_URL}",
                params=None,
            ).mock(side_effect=_make_ea_handler(payload))

        # Catch-all: return empty object (no EA ID) for any other club
        mock.get(url__startswith=EA_BASE_URL).mock(
            return_value=httpx.Response(200, json={})
        )
        yield mock


def _make_ea_handler(payload):
    """Return a respx side_effect that checks the clubName param."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
    return handler


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_create_club(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    with respx.mock(assert_all_called=False) as mock:
        mock.get(url__startswith=EA_BASE_URL).mock(
            return_value=httpx.Response(200, json={"8501": {"clubName": "Zambroneez"}})
        )
        name = "Zambroneez"
        logo = "http://example.com/logo.png"
        data = {"name": name, "logo": logo}
        response = client.post(
            f"{settings.API_V1_STR}/clubs/",
            headers=superuser_token_headers,
            json=data,
        )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == name
    assert content["logo"] == logo
    assert content["ea_id"] == "8501"
    assert "id" in content


def test_create_club_with_big_name(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    with respx.mock(assert_all_called=False) as mock:
        mock.get(url__startswith=EA_BASE_URL).mock(
            return_value=httpx.Response(200, json={"220": {"clubName": "QCHL3s Canadien MTL"}})
        )
        name = "QCHL3s Canadien MTL"
        data = {"name": name}
        response = client.post(
            f"{settings.API_V1_STR}/clubs/",
            headers=superuser_token_headers,
            json=data,
        )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == name
    assert content["ea_id"] == "220"


def test_read_clubs(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    name = random_lower_string()
    club_in = ClubCreate(name=name)
    club = Club.model_validate(club_in)
    db.add(club)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/clubs/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 1
    assert any(club["name"] == name for club in content["data"])


def test_update_club(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    club_in = ClubCreate(name=random_lower_string())
    club = Club.model_validate(club_in)
    db.add(club)
    db.commit()
    db.refresh(club)

    with respx.mock(assert_all_called=False) as mock:
        mock.get(url__startswith=EA_BASE_URL).mock(
            return_value=httpx.Response(200, json={"8501": {"clubName": "Zambroneez"}})
        )
        new_name = "Zambroneez"
        data = {"name": new_name}
        response = client.patch(
            f"{settings.API_V1_STR}/clubs/{club.id}",
            headers=superuser_token_headers,
            json=data,
        )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == new_name
    assert content["ea_id"] == "8501"


def test_delete_club(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    club_in = ClubCreate(name=random_lower_string())
    club = Club.model_validate(club_in)
    db.add(club)
    db.commit()
    db.refresh(club)

    response = client.delete(
        f"{settings.API_V1_STR}/clubs/{club.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Club deleted successfully"


def test_bulk_create_clubs(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    with respx.mock(assert_all_called=False) as mock:
        mock.get(url__startswith=EA_BASE_URL).mock(
            return_value=httpx.Response(200, json={"8501": {"clubName": "Zambroneez"}})
        )
        data = [
            {"name": "Zambroneez"},
            {"name": "QCHL3s Canadien MTL"}
        ]
        response = client.post(
            f"{settings.API_V1_STR}/clubs/bulk",
            headers=superuser_token_headers,
            json=data,
        )
    assert response.status_code == 200
    content = response.json()
    assert "Successfully created 2 clubs" in content["message"]

    # Verify Zambroneez exists in DB with correct EA ID – search by name, not index
    response = client.get(
        f"{settings.API_V1_STR}/clubs/?search=Zambroneez",
        headers=superuser_token_headers,
    )
    clubs = response.json()["data"]
    zambroneez = next((c for c in clubs if c["name"] == "Zambroneez"), None)
    assert zambroneez is not None, "Zambroneez not found in response"
    assert zambroneez["ea_id"] == "8501"


def test_bulk_delete_clubs(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    c1 = Club.model_validate(ClubCreate(name=random_lower_string()))
    c2 = Club.model_validate(ClubCreate(name=random_lower_string()))
    db.add(c1)
    db.add(c2)
    db.commit()
    db.refresh(c1)
    db.refresh(c2)

    data = [str(c1.id), str(c2.id)]
    response = client.post(
        f"{settings.API_V1_STR}/clubs/bulk-delete",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert "Deleted 2 club(s)" in content["message"]
