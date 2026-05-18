import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.api.deps import get_current_active_superuser, get_db
from app.core.scheduler import add_scheduler_job, remove_scheduler_job
from app.models import (
    League,
    Match,
    MatchPublic,
    Message,
    Scheduler,
    SchedulerActivitiesPublic,
    SchedulerActivity,
    SchedulerCreate,
    SchedulerPublic,
    SchedulersPublic,
    SchedulerUpdate,
    Season,
    UnsavedMatch,
    UnsavedMatchesPublic,
    UnsavedMatchPublic,
    UnsavedMatchUpdate,
)

router = APIRouter(prefix="/schedulers", tags=["schedulers"])


def _to_public(session: Session, db_scheduler: Scheduler) -> SchedulerPublic:
    """
    Helper to hydrate names and build public DTO.
    """
    league = session.get(League, db_scheduler.league_id)
    season = session.get(Season, db_scheduler.season_id)

    if not league or not season:
        raise HTTPException(status_code=404, detail="League or Season not found")

    return SchedulerPublic(
        **db_scheduler.model_dump(),
        league_name=league.name,
        season_name=season.name,
    )


@router.get("/", response_model=SchedulersPublic)
def read_schedulers(
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve schedulers.
    """
    count_statement = select(func.count()).select_from(Scheduler)
    count = session.exec(count_statement).one()

    statement = (
        select(
            Scheduler,
            League.name.label("league_name"),
            Season.name.label("season_name"),
        )
        .join(League, Scheduler.league_id == League.id)
        .join(Season, Scheduler.season_id == Season.id)
        .offset(skip)
        .limit(limit)
    )
    results = session.exec(statement).all()

    data = []
    for db_scheduler, league_name, season_name in results:
        scheduler_public = SchedulerPublic(
            **db_scheduler.model_dump(),
            league_name=league_name,
            season_name=season_name,
        )
        data.append(scheduler_public)

    return SchedulersPublic(data=data, count=count)


@router.get("/{id}", response_model=SchedulerPublic)
def read_scheduler(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Get a scheduler by id.
    """
    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    return _to_public(session, db_scheduler)


@router.post("/", response_model=SchedulerPublic)
def create_scheduler(
    *,
    session: Session = Depends(get_db),
    scheduler_in: SchedulerCreate,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Create new scheduler.
    """
    db_scheduler = Scheduler.model_validate(scheduler_in)
    session.add(db_scheduler)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=400,
            detail="Scheduler for this league and season already exists",
        )
    session.refresh(db_scheduler)

    try:
        add_scheduler_job(db_scheduler)
    except Exception:
        session.delete(db_scheduler)
        session.commit()
        raise HTTPException(status_code=500, detail="Failed to schedule job")

    return _to_public(session, db_scheduler)


@router.patch("/{id}", response_model=SchedulerPublic)
def update_scheduler(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    scheduler_in: SchedulerUpdate,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Update a scheduler.
    """
    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    update_dict = scheduler_in.model_dump(exclude_unset=True, exclude_none=True)
    db_scheduler.sqlmodel_update(update_dict)
    session.add(db_scheduler)
    session.commit()
    session.refresh(db_scheduler)

    # Update job
    try:
        remove_scheduler_job(id)
        if db_scheduler.is_enabled:
            add_scheduler_job(db_scheduler)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to update scheduler job")

    return _to_public(session, db_scheduler)


@router.delete("/{id}")
def delete_scheduler(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Delete a scheduler.
    """
    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    try:
        remove_scheduler_job(id)
    except Exception:
        pass
    session.delete(db_scheduler)
    session.commit()
    return Message(message="Scheduler deleted successfully")


@router.post("/{id}/start", response_model=SchedulerPublic)
def start_scheduler(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Start (enable) a scheduler.
    """
    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    db_scheduler.is_enabled = True
    session.add(db_scheduler)
    session.commit()
    session.refresh(db_scheduler)

    try:
        add_scheduler_job(db_scheduler)
    except Exception:
        db_scheduler.is_enabled = False
        session.add(db_scheduler)
        session.commit()
        raise HTTPException(status_code=500, detail="Failed to start scheduler job")

    return _to_public(session, db_scheduler)


@router.post("/{id}/stop", response_model=SchedulerPublic)
def stop_scheduler(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Stop (disable) a scheduler.
    """
    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    db_scheduler.is_enabled = False
    session.add(db_scheduler)
    session.commit()
    session.refresh(db_scheduler)

    try:
        remove_scheduler_job(id)
    except Exception:
        db_scheduler.is_enabled = True
        session.add(db_scheduler)
        session.commit()
        raise HTTPException(status_code=500, detail="Failed to stop scheduler job")

    return _to_public(session, db_scheduler)


@router.post("/{id}/run", response_model=SchedulerPublic)
async def run_scheduler_now(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Trigger the scheduler pull immediately.
    """
    from app.services.ea_api import pull_ea_data

    db_scheduler = session.get(Scheduler, id)
    if not db_scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    # This is a manual run, so we bypass the time window and just call the service
    await pull_ea_data(session, db_scheduler)
    session.refresh(db_scheduler)

    return _to_public(session, db_scheduler)


@router.get("/{id}/activities", response_model=SchedulerActivitiesPublic)
def read_scheduler_activities(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve activity logs for a specific scheduler.
    """
    count_statement = select(func.count()).where(SchedulerActivity.scheduler_id == id)
    count = session.exec(count_statement).one()

    statement = (
        select(SchedulerActivity)
        .where(SchedulerActivity.scheduler_id == id)
        .order_by(SchedulerActivity.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    activities = session.exec(statement).all()

    return SchedulerActivitiesPublic(data=activities, count=count)


@router.delete("/{id}/activities")
def delete_scheduler_activities(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Clear all activity logs for a specific scheduler.
    """
    statement = delete(SchedulerActivity).where(SchedulerActivity.scheduler_id == id)
    session.execute(statement)
    session.commit()
    return Message(message="Activity logs cleared successfully")


@router.get("/{id}/unsaved-matches", response_model=UnsavedMatchesPublic)
def read_unsaved_matches(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve unsaved matches for a specific scheduler. Sorted by timestamp.
    """
    count_statement = select(func.count()).where(UnsavedMatch.scheduler_id == id)
    count = session.exec(count_statement).one()

    # Sort by timestamp in raw_data (JSON)
    from sqlalchemy import Integer, String, cast
    timestamp_expr = func.coalesce(
        func.nullif(
            func.regexp_replace(cast(UnsavedMatch.raw_data["timestamp"], String), r"[^0-9]", "", "g"),
            "",
        ).cast(Integer),
        0,
    )

    statement = (
        select(UnsavedMatch)
        .where(UnsavedMatch.scheduler_id == id)
        .order_by(timestamp_expr.desc(), UnsavedMatch.match_id.desc())
        .offset(skip)
        .limit(limit)
    )
    matches = session.exec(statement).all()

    return UnsavedMatchesPublic(data=matches, count=count)


@router.get("/{id}/unsaved-matches/ids", response_model=list[str])
def read_unsaved_match_ids(
    *,
    session: Session = Depends(get_db),
    id: uuid.UUID,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve only unsaved match IDs for a specific scheduler.
    """
    statement = select(UnsavedMatch.match_id).where(UnsavedMatch.scheduler_id == id)
    return session.exec(statement).all()


@router.post("/unsaved-matches/bulk-delete")
def bulk_delete_unsaved_matches(
    *,
    session: Session = Depends(get_db),
    match_ids: list[str],
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Bulk delete unsaved matches.
    """
    unique_ids = list(set(match_ids))
    statement = delete(UnsavedMatch).where(UnsavedMatch.match_id.in_(unique_ids))
    result = session.execute(statement)
    deleted_count = result.rowcount
    session.commit()
    return Message(message=f"{deleted_count} pending matches deleted successfully")


@router.post("/unsaved-matches/{match_id}/promote", response_model=MatchPublic)
def promote_unsaved_match(
    *,
    session: Session = Depends(get_db),
    match_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Promote an unsaved match to a regular match.
    """
    unsaved_match = session.get(UnsavedMatch, match_id)
    if not unsaved_match:
        raise HTTPException(status_code=404, detail="Unsaved match not found")

    # Check if it's already in Match (global deduplication safety)
    if session.get(Match, match_id):
        session.delete(unsaved_match)
        session.commit()
        raise HTTPException(status_code=409, detail="Match already exists")

    # Move to Match
    match = Match(
        match_id=unsaved_match.match_id,
        league_id=unsaved_match.league_id,
        season_id=unsaved_match.season_id,
        raw_data=unsaved_match.raw_data,
    )
    session.add(match)
    
    # Create player links for the newly promoted match
    from app.services.ea_api import save_match_links
    save_match_links(session, match.raw_data, match.match_id)
    
    session.delete(unsaved_match)
    session.commit()
    session.refresh(match)

    return match


@router.patch("/unsaved-matches/{match_id}", response_model=UnsavedMatchPublic)
def update_unsaved_match(
    *,
    session: Session = Depends(get_db),
    match_id: str,
    match_in: UnsavedMatchUpdate,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Update an unsaved match's raw data.
    """
    unsaved_match = session.get(UnsavedMatch, match_id)
    if not unsaved_match:
        raise HTTPException(status_code=404, detail="Unsaved match not found")

    update_dict = match_in.model_dump(exclude_unset=True)
    unsaved_match.sqlmodel_update(update_dict)
    session.add(unsaved_match)
    session.commit()
    session.refresh(unsaved_match)
    return unsaved_match


@router.delete("/unsaved-matches/{match_id}")
def delete_unsaved_match(
    *,
    session: Session = Depends(get_db),
    match_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Delete an unsaved match.
    """
    unsaved_match = session.get(UnsavedMatch, match_id)
    if not unsaved_match:
        raise HTTPException(status_code=404, detail="Unsaved match not found")
    session.delete(unsaved_match)
    session.commit()
    return Message(message="Unsaved match deleted successfully")
