from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Club,
    ClubCreate,
    ClubUpdate,
    League,
    LeagueCreate,
    LeagueUpdate,
    Season,
    SeasonCreate,
    SeasonUpdate,
    User,
    UserCreate,
    UserUpdate,
)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by running password verification even when user doesn't exist
        # This ensures the response time is similar whether or not the email exists
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def create_league(*, session: Session, league_in: LeagueCreate) -> League:
    db_obj = League.model_validate(league_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_league(*, session: Session, db_league: League, league_in: LeagueUpdate) -> Any:
    league_data = league_in.model_dump(exclude_unset=True)
    db_league.sqlmodel_update(league_data)
    session.add(db_league)
    session.commit()
    session.refresh(db_league)
    return db_league


def create_season(*, session: Session, season_in: SeasonCreate) -> Season:
    db_obj = Season.model_validate(season_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_season(*, session: Session, db_season: Season, season_in: SeasonUpdate) -> Any:
    season_data = season_in.model_dump(exclude_unset=True)
    db_season.sqlmodel_update(season_data)
    session.add(db_season)
    session.commit()
    session.refresh(db_season)
    return db_season


def create_club(*, session: Session, club_in: ClubCreate) -> Club:
    db_obj = Club.model_validate(club_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_club(*, session: Session, db_club: Club, club_in: ClubUpdate) -> Any:
    club_data = club_in.model_dump(exclude_unset=True)
    db_club.sqlmodel_update(club_data)
    session.add(db_club)
    session.commit()
    session.refresh(db_club)
    return db_club
