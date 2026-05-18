
import uuid
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models import Player, Match, MatchPlayerLink, Season, League

def test_read_player_most_frequent_position(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    # Setup: Create League, Season, Player, Match
    league = League(name="Test League")
    db.add(league)
    db.commit()
    db.refresh(league)
    
    season = Season(name="Test Season", league_id=league.id)
    db.add(season)
    db.commit()
    db.refresh(season)
    
    player_ea_id = "test-ea-id"
    player = Player(ea_id=player_ea_id, gamertag="TestPlayer")
    db.add(player)
    
    # Match 1: Position center
    match1 = Match(
        match_id="match-1",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": {player_ea_id: {"position": "center"}}}}
    )
    db.add(match1)
    
    # Match 2: Position center
    match2 = Match(
        match_id="match-2",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": {player_ea_id: {"position": "center"}}}}
    )
    db.add(match2)
    
    # Match 3: Position goalie
    match3 = Match(
        match_id="match-3",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": {player_ea_id: {"position": "goalie"}}}}
    )
    db.add(match3)
    
    link1 = MatchPlayerLink(match_id=match1.match_id, player_ea_id=player_ea_id)
    link2 = MatchPlayerLink(match_id=match2.match_id, player_ea_id=player_ea_id)
    link3 = MatchPlayerLink(match_id=match3.match_id, player_ea_id=player_ea_id)
    db.add(link1)
    db.add(link2)
    db.add(link3)
    
    db.commit()
    
    response = client.get(
        f"/api/v1/players/{player_ea_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["ea_id"] == player_ea_id
    assert content["most_frequent_position"] == "Center"

def test_read_player_malformed_data(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    # Setup
    league = League(name="Test League Malformed")
    db.add(league)
    db.commit()
    db.refresh(league)
    
    season = Season(name="Test Season Malformed", league_id=league.id)
    db.add(season)
    db.commit()
    db.refresh(season)
    
    player_ea_id = "malformed-ea-id"
    player = Player(ea_id=player_ea_id, gamertag="MalformedPlayer")
    db.add(player)
    
    # Match 1: players is not a dict
    match1 = Match(
        match_id="match-malformed-1",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": "not-a-dict"}
    )
    db.add(match1)
    
    # Match 2: club_players is not a dict
    match2 = Match(
        match_id="match-malformed-2",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": ["not-a-dict"]}}
    )
    db.add(match2)

    # Match 3: player_info is not a dict
    match3 = Match(
        match_id="match-malformed-3",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": {player_ea_id: "not-a-dict"}}}
    )
    db.add(match3)
    
    # Match 4: valid data to ensure it still works
    match4 = Match(
        match_id="match-valid",
        league_id=league.id,
        season_id=season.id,
        raw_data={"players": {"club1": {player_ea_id: {"position": "leftWing"}}}}
    )
    db.add(match4)
    
    for mid in ["match-malformed-1", "match-malformed-2", "match-malformed-3", "match-valid"]:
        db.add(MatchPlayerLink(match_id=mid, player_ea_id=player_ea_id))
    
    db.commit()
    
    response = client.get(
        f"/api/v1/players/{player_ea_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["most_frequent_position"] == "LW"
