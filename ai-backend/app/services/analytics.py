from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import select, func, case, and_
from sqlalchemy.dialects.postgresql import insert
from app.models.domain import Profile, GameSession, ActivityEvent, DailyMetric, ScreenTimeSnapshot, now

SCORING_VERSION = "wellness-v1"

def day_bounds(day: date, tz: str):
    start = datetime.combine(day, time.min, ZoneInfo(tz))
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)

def component_scores(games, exercises, checkin, sleep_minutes, screen_ms, vani_score=None):
    # Nine completed sessions is the unchanged wellness-v1 engagement cap.
    # Catalog expansion does not change historical scoring. Missing inputs stay unknown.
    activity = min(100, round(min((games + exercises) / 9, 1) * 80 + (20 if checkin else 0)))
    sleep = None
    if sleep_minutes is not None:
        hours = sleep_minutes / 60
        sleep = max(0, min(100, round(hours / 7 * 100 if hours < 7 else 100 if hours <= 8 else 100 - (hours - 8) * 10)))
    screen = None if screen_ms is None else max(0, min(100, round(100 - max(0, screen_ms / 60000 - 180) / 3)))
    composite = None if any(v is None for v in (vani_score, sleep, screen)) else round(.3 * vani_score + .25 * sleep + .2 * screen + .25 * activity)
    return dict(activity_score=activity, sleep_score=sleep, screen_score=screen, vani_score=vani_score, composite_score=composite)

def daily_summary(db, user_id, day=None):
    profile = db.get(Profile, user_id)
    tz = profile.timezone if profile else "Asia/Kolkata"
    day = day or datetime.now(ZoneInfo(tz)).date()
    start, end = day_bounds(day, tz)
    games, game_points = db.execute(select(func.count(), func.coalesce(func.sum(GameSession.score), 0)).where(GameSession.user_id == user_id, GameSession.expires_at > now(), GameSession.ended_at >= start, GameSession.ended_at < end)).one()
    events = db.scalars(select(ActivityEvent).where(ActivityEvent.user_id == user_id, ActivityEvent.expires_at > now(), ActivityEvent.occurred_at >= start, ActivityEvent.occurred_at < end).order_by(ActivityEvent.occurred_at)).all()
    exercises = [e for e in events if e.event_type == "exercise_completed"]
    checkins = [e for e in events if e.event_type == "daily_checkin"]
    checkin = checkins[-1].payload if checkins else {}
    snapshot = db.scalar(select(ScreenTimeSnapshot).where(ScreenTimeSnapshot.user_id == user_id, ScreenTimeSnapshot.expires_at > now(), ScreenTimeSnapshot.metric_date == day).order_by(ScreenTimeSnapshot.captured_at.desc()).limit(1))
    screen_ms = snapshot.total_screen_time_ms if snapshot else None
    values = dict(user_id=user_id, metric_date=day, scoring_version=SCORING_VERSION, timezone=tz,
                  game_count=games, exercise_count=len(exercises), activity_points=game_points + sum(e.points or 0 for e in exercises),
                  sleep_minutes=checkin.get("sleep_minutes"), mood=checkin.get("mood"), mood_score=checkin.get("mood_score"), screen_time_ms=screen_ms,
                  **component_scores(games, len(exercises), bool(checkin), checkin.get("sleep_minutes"), screen_ms), computed_at=datetime.now(timezone.utc))
    db.execute(insert(DailyMetric).values(**values).on_conflict_do_update(index_elements=["user_id", "metric_date", "scoring_version"], set_={k: v for k, v in values.items() if k not in {"user_id", "metric_date", "scoring_version"}}))
    return {**{k: v for k, v in values.items() if k != "user_id"}, "avg_score": values["composite_score"], "state": "unknown", "insight": "No composite score yet. Voice scoring requires validated measurements."}

def game_trends(db, user_id, game_code, start_date, end_date):
    if (end_date - start_date).days not in range(2, 367):
        raise ValueError("Choose a window between 2 and 366 days")
    profile = db.get(Profile, user_id)
    start, _ = day_bounds(start_date, profile.timezone if profile else "Asia/Kolkata")
    end, _ = day_bounds(end_date, profile.timezone if profile else "Asia/Kolkata")
    middle = start + (end - start) / 2
    averages = (select(GameSession.game_code, GameSession.game_version, GameSession.scoring_version, GameSession.difficulty,
        func.avg(GameSession.score).filter(GameSession.ended_at < middle).label("previous_avg"),
        func.avg(GameSession.score).filter(GameSession.ended_at >= middle).label("current_avg"),
        func.count().filter(GameSession.ended_at < middle).label("previous_count"),
        func.count().filter(GameSession.ended_at >= middle).label("current_count")
    ).where(GameSession.user_id == user_id, GameSession.expires_at > now(), GameSession.game_code == game_code, GameSession.ended_at >= start, GameSession.ended_at < end)
      .group_by(GameSession.game_code, GameSession.game_version, GameSession.scoring_version, GameSession.difficulty)).subquery()
    enough = and_(averages.c.previous_count >= 3, averages.c.current_count >= 3)
    delta = averages.c.current_avg - averages.c.previous_avg
    rows = db.execute(select(averages,
        case((enough, delta), else_=None).label("score_delta"),
        case((enough, delta * 100 / func.nullif(averages.c.previous_avg, 0)), else_=None).label("improvement_percent"),
        case((enough, "available"), else_="insufficient_data").label("status"))).mappings().all()
    return {"start_date": start_date, "end_date": end_date, "split_at": middle, "groups": [dict(r) for r in rows]}
