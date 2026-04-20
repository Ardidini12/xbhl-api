import logging
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session, select

from app.core.db import engine
from app.models import Scheduler
from app.services.ea_api import pull_ea_data

logger = logging.getLogger(__name__)

async_scheduler = AsyncIOScheduler()

async def scheduler_job(scheduler_id: uuid.UUID):
    with Session(engine) as session:
        db_scheduler = session.get(Scheduler, scheduler_id)
        if not db_scheduler or not db_scheduler.is_enabled:
            return

        # Window Logic - use Eastern Time (America/New_York)
        eastern_tz = ZoneInfo("America/New_York")
        now = datetime.now(eastern_tz)

        current_day = now.strftime('%A')
        current_time = now.time()

        if current_day not in db_scheduler.days:
            logger.debug(f"Scheduler {scheduler_id} skipped: wrong day {current_day}")
            return

        # Handle time window, including overnight windows (e.g., 21:00 -> 02:00)
        if db_scheduler.start_time <= db_scheduler.end_time:
            # Normal window (no midnight wrap)
            if not (db_scheduler.start_time <= current_time <= db_scheduler.end_time):
                logger.debug(f"Scheduler {scheduler_id} skipped: outside time window {db_scheduler.start_time}-{db_scheduler.end_time}")
                return
        else:
            # Overnight window (wraps midnight)
            if not (current_time >= db_scheduler.start_time or current_time <= db_scheduler.end_time):
                logger.debug(f"Scheduler {scheduler_id} skipped: outside time window {db_scheduler.start_time}-{db_scheduler.end_time}")
                return

        logger.info(f"Running EA pull for scheduler {scheduler_id}")
        await pull_ea_data(session, db_scheduler)

def add_scheduler_job(db_scheduler: Scheduler):
    if db_scheduler.is_enabled:
        async_scheduler.add_job(
            scheduler_job,
            trigger=IntervalTrigger(minutes=db_scheduler.interval_minutes),
            args=[db_scheduler.id],
            id=str(db_scheduler.id),
            replace_existing=True
        )
        logger.info(f"Added/Updated job for scheduler {db_scheduler.id}")

def remove_scheduler_job(scheduler_id: uuid.UUID):
    try:
        async_scheduler.remove_job(str(scheduler_id))
        logger.info(f"Removed job for scheduler {scheduler_id}")
    except Exception:
        pass

def start_all_jobs():
    with Session(engine) as session:
        schedulers = session.exec(select(Scheduler)).all()
        for db_scheduler in schedulers:
            if db_scheduler.is_enabled:
                add_scheduler_job(db_scheduler)

    if not async_scheduler.running:
        async_scheduler.start()
        logger.info("Started background scheduler")
