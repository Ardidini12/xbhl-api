import uuid
from datetime import datetime, time, timezone

from pydantic import EmailStr
from sqlalchemy import JSON, DateTime, Index, UniqueConstraint, text
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
    club_id: uuid.UUID = Field(
        foreign_key="club.id", primary_key=True, ondelete="CASCADE"
    )
    season_id: uuid.UUID = Field(
        foreign_key="season.id", primary_key=True, ondelete="CASCADE"
    )


class ClubLeagueLink(SQLModel, table=True):
    club_id: uuid.UUID = Field(
        foreign_key="club.id", primary_key=True, ondelete="CASCADE"
    )
    league_id: uuid.UUID = Field(
        foreign_key="league.id", primary_key=True, ondelete="CASCADE"
    )


# Database model, database table inferred from class name
class League(LeagueBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    seasons: list["Season"] = Relationship(back_populates="league", cascade_delete=True)
    clubs: list["Club"] = Relationship(
        back_populates="leagues", link_model=ClubLeagueLink
    )


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
    league_id: uuid.UUID = Field(
        foreign_key="league.id", nullable=False, ondelete="CASCADE", index=True
    )
    league: "League" = Relationship(back_populates="seasons")
    clubs: list["Club"] = Relationship(
        back_populates="seasons", link_model=ClubSeasonLink
    )


# Properties to return via API
class SeasonPublic(SeasonBase):
    id: uuid.UUID


class SeasonsPublic(SQLModel):
    data: list[SeasonPublic]
    count: int


# Club models
class ClubBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, unique=True, index=True)
    logo: str | None = Field(default=None, max_length=255)
    ea_id: str | None = Field(default=None, max_length=255, unique=True)


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
    seasons: list["Season"] = Relationship(
        back_populates="clubs", link_model=ClubSeasonLink
    )
    leagues: list["League"] = Relationship(
        back_populates="clubs", link_model=ClubLeagueLink
    )


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


# Scheduler models
class SchedulerBase(SQLModel):
    league_id: uuid.UUID = Field(
        foreign_key="league.id", ondelete="CASCADE", index=True
    )
    season_id: uuid.UUID = Field(
        foreign_key="season.id", ondelete="CASCADE", index=True
    )
    days: list[str] = Field(default_factory=list, sa_type=JSON)  # type: ignore
    start_time: time
    end_time: time
    interval_minutes: int = Field(default=15, ge=1)
    is_enabled: bool = Field(default=True)


# Properties to receive on scheduler creation
class SchedulerCreate(SchedulerBase):
    pass


# Properties to receive on scheduler update
class SchedulerUpdate(SQLModel):
    days: list[str] | None = None
    start_time: time | None = None
    end_time: time | None = None
    interval_minutes: int | None = Field(default=None, ge=1)
    is_enabled: bool | None = None


# Database model
class Scheduler(SchedulerBase, table=True):
    __table_args__ = (
        UniqueConstraint("league_id", "season_id", name="uq_scheduler_league_season"),
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    last_run_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    last_run_status: str | None = Field(default=None, max_length=1024)
    league: "League" = Relationship()
    season: "Season" = Relationship()


# Properties to return via API
class SchedulerPublic(SchedulerBase):
    id: uuid.UUID
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    league_name: str
    season_name: str


class SchedulersPublic(SQLModel):
    data: list[SchedulerPublic]
    count: int


# Match models
class MatchBase(SQLModel):
    match_id: str = Field(primary_key=True)
    league_id: uuid.UUID = Field(
        foreign_key="league.id", ondelete="CASCADE", index=True
    )
    season_id: uuid.UUID = Field(
        foreign_key="season.id", ondelete="CASCADE", index=True
    )
    raw_data: dict = Field(default_factory=dict, sa_type=JSON)  # type: ignore


# Properties to receive on match update
class MatchUpdate(SQLModel):
    raw_data: dict


# Properties to receive on unsaved match update
class UnsavedMatchUpdate(SQLModel):
    raw_data: dict


# Database model
class Match(MatchBase, table=True):
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    league: "League" = Relationship()
    season: "Season" = Relationship()


# Properties to return via API
class MatchPublic(MatchBase):
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MatchesPublic(SQLModel):
    data: list[MatchPublic]
    count: int


# Player models
class PlayerBase(SQLModel):
    ea_id: str = Field(primary_key=True)
    gamertag: str = Field(index=True, max_length=255)


class Player(PlayerBase, table=True):
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class PlayerPublic(PlayerBase):
    created_at: datetime | None = None
    most_frequent_position: str | None = None


class PlayersPublic(SQLModel):
    data: list[PlayerPublic]
    count: int


class MatchPlayerLink(SQLModel, table=True):
    match_id: str = Field(
        foreign_key="match.match_id", primary_key=True, ondelete="CASCADE"
    )
    player_ea_id: str = Field(
        foreign_key="player.ea_id", primary_key=True, ondelete="CASCADE"
    )


class MatchPlayerStats(SQLModel, table=True):
    match_id: str = Field(
        foreign_key="match.match_id", primary_key=True, ondelete="CASCADE"
    )
    player_ea_id: str = Field(
        foreign_key="player.ea_id", primary_key=True, ondelete="CASCADE", index=True
    )

    # Position in this match
    position: str

    # Record
    win: int = 0
    loss: int = 0
    otl: int = 0

    # Stats from API (sk... keys)
    skgoals: int = 0
    skgwg: int = 0
    skassists: int = 0
    skpossession: int = 0
    skplusmin: int = 0
    skshots: int = 0
    skshotattempts: int = 0
    skshotpct: float = 0.0
    skshotonnetpct: float = 0.0
    skdeflections: int = 0
    skpasses: int = 0
    skpassattempts: int = 0
    skpasspct: float = 0.0
    sksaucerpasses: int = 0
    skhits: int = 0
    skgiveaways: int = 0
    sktakeaways: int = 0
    skinterceptions: int = 0
    skbs: int = 0
    skpim: int = 0
    skpenaltiesdrawn: int = 0
    skpkclearzone: int = 0
    skfow: int = 0
    skfol: int = 0
    skfopct: float = 0.0


class PlayerAggregateStats(SQLModel, table=True):
    __table_args__ = (
        Index(
            "uq_player_stats_career",
            "player_ea_id",
            unique=True,
            postgresql_where=text("league_id IS NULL AND season_id IS NULL"),
        ),
        Index(
            "uq_player_stats_league",
            "player_ea_id",
            "league_id",
            unique=True,
            postgresql_where=text("season_id IS NULL"),
        ),
        Index(
            "uq_player_stats_season",
            "player_ea_id",
            "league_id",
            "season_id",
            unique=True,
            postgresql_where=text("season_id IS NOT NULL"),
        ),
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    player_ea_id: str = Field(foreign_key="player.ea_id", ondelete="CASCADE", index=True)
    league_id: uuid.UUID | None = Field(
        default=None, foreign_key="league.id", ondelete="CASCADE", index=True
    )
    season_id: uuid.UUID | None = Field(
        default=None, foreign_key="season.id", ondelete="CASCADE", index=True
    )

    games_played: int = 0
    wins: int = 0
    losses: int = 0
    otl: int = 0

    goals: int = 0
    game_winning_goals: int = 0
    assists: int = 0
    possession_seconds: int = 0
    plus_minus: int = 0
    shots: int = 0
    shot_attempts: int = 0
    deflections: int = 0
    passes: int = 0
    pass_attempts: int = 0
    saucer_passes: int = 0
    hits: int = 0
    giveaways: int = 0
    takeaways: int = 0
    interceptions: int = 0
    blocked_shots: int = 0
    penalty_minutes: int = 0
    penalties_drawn: int = 0
    penalty_clears: int = 0
    faceoffs_won: int = 0
    faceoffs_lost: int = 0

    # Sums for averaging percentages
    sum_shot_pct: float = 0.0
    sum_shot_on_net_pct: float = 0.0
    sum_pass_pct: float = 0.0
    sum_fo_pct: float = 0.0


class PlayerDetailedStats(SQLModel):
    # This model follows the CSV order for the frontend
    player_name: str
    team_name: str | None = None
    position: str
    record: str  # e.g. "10-2-0"
    games_played: int
    goals: int
    goals_per_gp: float
    game_winning_goals: int
    assists: int
    assists_per_gp: float
    points: int
    points_per_gp: float
    possession_min_per_gp: float
    plus_minus: int
    shots: int
    shot_attempts: int
    scoring_pct: float
    missed_shots: int
    shots_on_net_pct: float
    deflections: int
    passes: int
    passes_per_gp: float
    pass_attempts: int
    pa_per_gp: float
    passing_pct: float
    saucer_passes: int
    sp_per_gp: float
    hits: int
    hits_per_gp: float
    giveaways: int
    giveaways_per_gp: float
    takeaways: int
    takeaways_per_gp: float
    interceptions: int
    interceptions_per_gp: float
    blocked_shots: int
    blocks_per_gp: float
    penalty_minutes: int
    penalties_drawn: int
    penalty_clears: int
    faceoffs_won: int
    faceoffs_lost: int
    faceoff_win_pct: float


class MatchClubLink(SQLModel, table=True):
    match_id: str = Field(
        foreign_key="match.match_id", primary_key=True, ondelete="CASCADE"
    )
    club_id: uuid.UUID = Field(
        foreign_key="club.id", primary_key=True, ondelete="CASCADE"
    )


class SeasonStats(SQLModel):
    id: uuid.UUID
    name: str
    count: int


class LeagueStats(SQLModel):
    id: uuid.UUID
    name: str
    count: int
    seasons: list[SeasonStats]


class ClubStatsPublic(SQLModel):
    total_matches: int
    leagues: list[LeagueStats]


class PlayerStatsOverview(SQLModel):
    total_matches: int
    leagues: list[LeagueStats]


# New models for Scheduler visibility and validation
class UnsavedMatch(MatchBase, table=True):
    scheduler_id: uuid.UUID = Field(
        foreign_key="scheduler.id", ondelete="CASCADE", index=True
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    reason: str | None = Field(default=None, max_length=255)
    scheduler: "Scheduler" = Relationship()


class UnsavedMatchPublic(MatchPublic):
    scheduler_id: uuid.UUID
    reason: str | None = None


class UnsavedMatchesPublic(SQLModel):
    data: list[UnsavedMatchPublic]
    count: int


class SchedulerActivity(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    scheduler_id: uuid.UUID = Field(
        foreign_key="scheduler.id", ondelete="CASCADE", index=True
    )
    started_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    finished_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    status: str = Field(default="running", max_length=50)  # running, success, error
    summary: str | None = Field(default=None, max_length=1024)
    details: dict = Field(default_factory=dict, sa_type=JSON)  # type: ignore
    scheduler: "Scheduler" = Relationship()


class SchedulerActivityPublic(SQLModel):
    id: uuid.UUID
    scheduler_id: uuid.UUID
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    summary: str | None = None
    details: dict


class SchedulerActivitiesPublic(SQLModel):
    data: list[SchedulerActivityPublic]
    count: int
