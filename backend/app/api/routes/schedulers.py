import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.api.deps import get_current_active_superuser, get_db
from app.core.scheduler import add_scheduler_job, remove_scheduler_job
from app.models import (
    Message,
    Scheduler,
    SchedulerCreate,
    SchedulerPublic,
    SchedulersPublic,
    SchedulerUpdate,
)

router = APIRouter(prefix="/schedulers", tags=["schedulers"])

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
    statement = select(Scheduler).offset(skip).limit(limit)
    schedulers = session.exec(statement).all()

    return SchedulersPublic(data=schedulers, count=count)

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
    # Check if league and season exists
    # (Optional validation)

    db_scheduler = Scheduler.model_validate(scheduler_in)
    session.add(db_scheduler)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Scheduler for this league and season already exists")
    session.refresh(db_scheduler)
    try:
        add_scheduler_job(db_scheduler)
    except Exception:
        session.delete(db_scheduler)
        session.commit()
        raise HTTPException(status_code=500, detail="Failed to schedule job")
    return db_scheduler

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

    return db_scheduler

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
    return db_scheduler

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
    return db_scheduler