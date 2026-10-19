from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select, func
from app.models.domain import Profile, GameSession, ActivityEvent, now
from app.services.analytics import day_bounds
from app.services.activity_catalog import GAME_CODES, EXERCISE_CODES

def activity_progress(db, user_id):
    profile = db.get(Profile, user_id)
    timezone = profile.timezone if profile else "Asia/Kolkata"
    day = datetime.now(ZoneInfo(timezone)).date()
    start, end = day_bounds(day, timezone)
    game_filters = [GameSession.user_id == user_id, GameSession.expires_at > now(), GameSession.game_code.in_(GAME_CODES)]
    exercise_filters = [ActivityEvent.user_id == user_id, ActivityEvent.expires_at > now(),
        ActivityEvent.event_type == "exercise_completed", ActivityEvent.activity_code.in_(EXERCISE_CODES)]
    games = db.execute(select(GameSession.game_code, func.sum(GameSession.score)).where(*game_filters,
        GameSession.ended_at >= start, GameSession.ended_at < end).group_by(GameSession.game_code)).all()
    exercises = db.execute(select(ActivityEvent.activity_code, func.sum(ActivityEvent.points)).where(*exercise_filters,
        ActivityEvent.occurred_at >= start, ActivityEvent.occurred_at < end).group_by(ActivityEvent.activity_code)).all()
    total_games = db.scalar(select(func.coalesce(func.sum(GameSession.score), 0)).where(*game_filters))
    total_exercises = db.scalar(select(func.coalesce(func.sum(ActivityEvent.points), 0)).where(*exercise_filters))
    return {"date": day.isoformat(), "timezone": timezone,
        "completed_ids": sorted({row[0] for row in [*games, *exercises]}),
        "daily_points": float(sum(row[1] or 0 for row in [*games, *exercises])),
        "total_points": float((total_games or 0) + (total_exercises or 0))}
