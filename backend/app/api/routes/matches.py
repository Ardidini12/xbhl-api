from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast
from sqlmodel import Session, func, select

from app.api.deps import get_current_active_superuser, get_db
from app.models import (
    Match,
    MatchesPublic,
    MatchPublic,
    MatchUpdate,
    Message,
)

router = APIRouter(prefix="/matches", tags=["matches"])

@router.get("/", response_model=MatchesPublic)
def read_matches(
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    club_name: str | None = None,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Retrieve matches. Filter by club name (case-insensitive) in raw_data.
    """
    statement = select(Match)
    if club_name:
        statement = statement.where(cast(Match.raw_data, String).ilike(f"%{club_name}%"))

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.order_by(Match.created_at.desc()).offset(skip).limit(limit)
    matches = session.exec(statement).all()

    return MatchesPublic(data=matches, count=count)

@router.patch("/{match_id}", response_model=MatchPublic)
def update_match(
    *,
    session: Session = Depends(get_db),
    match_id: str,
    match_in: MatchUpdate,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Any:
    """
    Update match raw data.
    """
    db_match = session.get(Match, match_id)
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    db_match.raw_data = match_in.raw_data
    db_match.updated_at = datetime.now(timezone.utc)
    session.add(db_match)
    session.commit()
    session.refresh(db_match)
    return db_match

@router.delete("/{match_id}")
def delete_match(
    *,
    session: Session = Depends(get_db),
    match_id: str,
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Delete a match.
    """
    db_match = session.get(Match, match_id)
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    session.delete(db_match)
    session.commit()
    return Message(message="Match deleted successfully")

@router.post("/bulk-delete")
def bulk_delete_matches(
    *,
    session: Session = Depends(get_db),
    match_ids: list[str],
    _current_user: Any = Depends(get_current_active_superuser),
) -> Message:
    """
    Bulk delete matches.
    """
    for match_id in match_ids:
        db_match = session.get(Match, match_id)
        if db_match:
            session.delete(db_match)
    session.commit()
    return Message(message=f"{len(match_ids)} matches deleted successfully")
