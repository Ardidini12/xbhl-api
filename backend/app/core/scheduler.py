from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
import uuid
import logging
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
        
        # Window Logic
        # Note: We should handle timezones carefully. The requirement says EST.
        # For now, let's assume the DB stores times that we compare against a specific timezone.
        # But usually, it's better to compare in a consistent way.
        # If the user sets 9 PM to 11 PM, we need to know what timezone that is.
        # "showing date as well, so date and time both in EST"
        
        now = datetime.now(timezone.utc)
        # TODO: Adjust to EST if needed for comparison, or assume stored times are UTC
        # For this prototype, we'll use UTC for logic and leave EST for display if not specified otherwise in DB
        
        current_day = now.strftime('%A')
        current_time = now.time()
        
        if current_day not in db_scheduler.days:
            logger.debug(f"Scheduler {scheduler_id} skipped: wrong day {current_day}")
            return
        
        if not (db_scheduler.start_time <= current_time <= db_scheduler.end_time):
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
