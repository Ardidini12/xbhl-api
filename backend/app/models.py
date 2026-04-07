import uuid
from datetime import datetime, timezone

from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class LeagueBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on league creation
class LeagueCreate(LeagueBase):
    pass


# Properties to receive on league update
class LeagueUpdate(LeagueBase):
    name: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Link tables for many-to-many relationships
class ClubSeasonLink(SQLModel, table=True):
    club_id: uuid.UUID = Field(foreign_key="club.id", primary_key=True, ondelete="CASCADE")
    season_id: uuid.UUID = Field(foreign_key="season.id", primary_key=True, ondelete="CASCADE")


class ClubLeagueLink(SQLModel, table=True):
    club_id: uuid.UUID = Field(foreign_key="club.id", primary_key=True, ondelete="CASCADE")
    league_id: uuid.UUID = Field(foreign_key="league.id", primary_key=True, ondelete="CASCADE")


# Database model, database table inferred from class name
class League(LeagueBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    seasons: list["Season"] = Relationship(back_populates="league", cascade_delete=True)
    clubs: list["Club"] = Relationship(back_populates="leagues", link_model=ClubLeagueLink)


# Properties to return via API, id is always required
class LeaguePublic(LeagueBase):
    id: uuid.UUID
    created_at: datetime | None = None


class LeaguesPublic(SQLModel):
    data: list[LeaguePublic]
    count: int


# Season models
class SeasonBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    start_date: datetime | None = None
    end_date: datetime | None = None
    league_id: uuid.UUID


# Properties to receive on season creation
class SeasonCreate(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    league_id: uuid.UUID


# Properties to receive on season update
class SeasonUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Database model
class Season(SeasonBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    start_date: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    end_date: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    league_id: uuid.UUID = Field(foreign_key="league.id", nullable=False, ondelete="CASCADE", index=True)
    league: "League" = Relationship(back_populates="seasons")
    clubs: list["Club"] = Relationship(back_populates="seasons", link_model=ClubSeasonLink)


# Properties to return via API
class SeasonPublic(SeasonBase):
    id: uuid.UUID


class SeasonsPublic(SQLModel):
    data: list[SeasonPublic]
    count: int


# Club models
class ClubBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    logo: str | None = Field(default=None, max_length=255)
    ea_id: str | None = Field(default=None, max_length=255)


# Properties to receive on club creation
class ClubCreate(ClubBase):
    pass


# Properties to receive on club update
class ClubUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    logo: str | None = Field(default=None, max_length=255)
    ea_id: str | None = Field(default=None, max_length=255)


# Database model
class Club(ClubBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    seasons: list["Season"] = Relationship(back_populates="clubs", link_model=ClubSeasonLink)
    leagues: list["League"] = Relationship(back_populates="clubs", link_model=ClubLeagueLink)


# Properties to return via API
class ClubPublic(ClubBase):
    id: uuid.UUID
    created_at: datetime | None = None


class ClubsPublic(SQLModel):
    data: list[ClubPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
