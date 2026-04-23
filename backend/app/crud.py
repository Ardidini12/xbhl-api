import uuid
from typing import Any, Sequence

from sqlmodel import Session, col, func, select

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


def get_season_clubs(
    *,
    session: Session,
    season_id: uuid.UUID,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[Sequence[Club], int]:
    statement = select(Club).join(Season.clubs).where(Season.id == season_id)
    if search:
        search_filter = f"%{search}%"
        statement = statement.where(
            (col(Club.name).ilike(search_filter)) |
            (col(Club.ea_id).ilike(search_filter))
        )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.order_by(Club.name).offset(skip).limit(limit)
    clubs = session.exec(statement).all()

    return clubs, count


def add_clubs_to_season(
    *, session: Session, db_season: Season, club_ids: list[uuid.UUID]
) -> int:
    clubs = session.exec(select(Club).where(col(Club.id).in_(club_ids))).all()
    found_ids = {c.id for c in clubs}
    missing_ids = set(club_ids) - found_ids
    if missing_ids:
        # We'll handle raising 404 in the route if needed,
        # but the crud function should probably focus on adding what it found.
        # Alternatively, we can pass the logic of "must find all" to the route.
        pass

    existing_ids = {c.id for c in db_season.clubs}
    added = 0
    for club in clubs:
        if club.id not in existing_ids:
            db_season.clubs.append(club)
            added += 1

    session.add(db_season)
    session.commit()
    session.refresh(db_season)
    return added


def remove_clubs_from_season(
    *, session: Session, db_season: Season, club_ids: list[uuid.UUID]
) -> None:
    db_season.clubs = [c for c in db_season.clubs if c.id not in club_ids]
    session.add(db_season)
    session.commit()
    session.refresh(db_season)
