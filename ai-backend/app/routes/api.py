import hashlib
import secrets
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, delete, func
from sqlalchemy.dialects.postgresql import insert
from app.auth import current_user, Principal
from app.contracts import ProfileInput, ConversationInput, TextInput, GameInput, ActivityInput, CheckinInput, FactInput, LiveInput
from app.db.database import user_session
from app.models.domain import User, Profile, Conversation, Message, GameSession, ActivityEvent, DailyMetric, MemoryFact, RagDocument, BackgroundJob, LiveTicket, LocationPoint, VisitedPlace, ScreenTimeSnapshot, now
from app.services.analytics import daily_summary, game_trends
from app.services.conversations import create_conversation, owned_conversation, store_messages
from app.services.retrieval import assemble_context, SYSTEM_INSTRUCTION
from app.settings import get_settings
from app.services.activity_catalog import exercise_points
from app.services.activity_progress import activity_progress
from app.contracts import ScreenSync, LocationSync

router = APIRouter()

@router.get("/user-profile")
def get_profile(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        p = db.get(Profile, user.id)
        return {"Name": p.display_name, "name": p.display_name, "stress": p.stress_description, "sleep": p.sleep_description,
                "goals": p.wellness_goals, "triggers": p.overwhelm_triggers, "preferred_language": p.preferred_language,
                "timezone": p.timezone, "memory_enabled": p.memory_enabled, "transcript_storage_enabled": p.transcript_storage_enabled, "retention_days": p.retention_days}

@router.post("/user-profile")
def update_profile(payload: ProfileInput, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        p = db.scalar(select(Profile).where(Profile.user_id == user.id).with_for_update())
        mapping = {"name": "display_name", "stress": "stress_description", "sleep": "sleep_description", "goals": "wellness_goals", "triggers": "overwhelm_triggers"}
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(p, mapping.get(key, key), value)
        if payload.memory_enabled and not p.transcript_storage_enabled:
            raise HTTPException(422, "Enable transcript storage before memory")
        if not p.transcript_storage_enabled:
            p.memory_enabled = False
        if not p.memory_enabled:
            db.execute(delete(RagDocument).where(RagDocument.user_id == user.id))
            db.execute(delete(BackgroundJob).where(BackgroundJob.user_id == user.id))
        if not p.transcript_storage_enabled:
            db.execute(delete(Message).where(Message.user_id == user.id))
        cutoff = now() + timedelta(days=p.retention_days)
        # Reducing retention also applies to existing derived material.
        from app.models.domain import RagChunk
        for model in (Conversation, Message, RagDocument, RagChunk):
            db.query(model).filter(model.user_id == user.id, model.expires_at > cutoff).update({"expires_at": cutoff})
    return {"status": "success"}

@router.post("/conversations")
def new_conversation(payload: ConversationInput, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        row = create_conversation(db, user.id, payload.language)
        return {"id": str(row.id)}

@router.get("/conversations/{conversation_id}/messages")
def messages(conversation_id: UUID, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        owned_conversation(db, user.id, conversation_id)
        rows = db.scalars(select(Message).where(Message.user_id == user.id, Message.conversation_id == conversation_id, Message.expires_at > now()).order_by(Message.sequence_no.desc()).limit(100)).all()
        return [{"id": str(m.id), "role": m.role, "text": m.content_text, "interrupted": m.interrupted, "created_at": m.created_at} for m in reversed(rows)]

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: UUID, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        db.delete(owned_conversation(db, user.id, conversation_id))
    return {"ok": True}

@router.post("/process-input")
async def process_input(payload: TextInput, user: Principal = Depends(current_user)):
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(503, "Text model is not configured")
    with user_session(user.id) as db:
        owned_conversation(db, user.id, payload.conversation_id)
        prior = db.scalar(select(Message).where(Message.user_id == user.id, Message.conversation_id == payload.conversation_id, Message.provider_event_id == payload.client_event_id + ":assistant"))
        if prior:
            return {"response": prior.content_text, "language": prior.language, "audio_url": None}
    context = await assemble_context(user.id, payload.conversation_id, payload.text)
    from google import genai
    from google.genai import types
    try:
        from app.routes.live import TOOLS, call_tool
        contents = [types.Content(role="user", parts=[types.Part(text=f"Language: {payload.preferred_language}\nEvidence: {context}\nUser: {payload.text}")])]
        async with genai.Client(api_key=settings.gemini_api_key).aio as client:
            for _ in range(4):
                result = await client.models.generate_content(model=settings.gemini_text_model, contents=contents,
                    config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION, max_output_tokens=400, tools=TOOLS))
                calls = result.function_calls or []
                if not calls:
                    break
                contents.append(result.candidates[0].content)
                responses = []
                for call in calls[:4]:
                    evidence = await call_tool(user.id, call.name, call.args or {})
                    responses.append(types.Part.from_function_response(name=call.name, response=evidence))
                contents.append(types.Content(role="tool", parts=responses))
        response = result.text or "I couldn't respond just now. Please try again."
    except Exception:
        raise HTTPException(503, "Voice service unavailable; please try again") from None
    with user_session(user.id) as db:
        stored = store_messages(db, user.id, payload.conversation_id, [("user", payload.text), ("assistant", response)], payload.client_event_id)
    return {"response": response, "language": payload.preferred_language, "audio_url": None, "stored": stored}

@router.get("/daily-summary")
def summary(target_date: date | None = None, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        return daily_summary(db, user.id, target_date)

@router.get("/games/trends")
def trends(game_code: str, start_date: date, end_date: date, user: Principal = Depends(current_user)):
    try:
        with user_session(user.id) as db:
            return game_trends(db, user.id, game_code, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None

@router.post("/games/sessions")
def record_game(payload: GameInput, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        db.execute(insert(GameSession).values(user_id=user.id, **payload.model_dump(), verification_status="arithmetic_checked", expires_at=now() + timedelta(days=get_settings().structured_data_retention_days)).on_conflict_do_nothing(index_elements=["user_id", "client_session_id"]))
        return {"ok": True, "summary": daily_summary(db, user.id)}

@router.post("/activities")
def record_activity(payload: ActivityInput, user: Principal = Depends(current_user)):
    points = exercise_points(payload.activity_code, payload.duration_ms)
    with user_session(user.id) as db:
        db.execute(insert(ActivityEvent).values(user_id=user.id, event_type="exercise_completed", points=points, **payload.model_dump(), expires_at=now() + timedelta(days=get_settings().structured_data_retention_days)).on_conflict_do_nothing())
        return {"ok": True, "summary": daily_summary(db, user.id)}

@router.get("/activities/progress")
def get_activity_progress(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        return activity_progress(db, user.id)

@router.post("/daily-checkin")
def checkin(payload: CheckinInput, user: Principal = Depends(current_user)):
    values = {"sleep_minutes": round(payload.sleep_hours * 60), "mood": payload.mood, "mood_score": {"Great": 100, "Good": 80, "Okay": 50, "Stressed": 20}[payload.mood]}
    with user_session(user.id) as db:
        db.execute(insert(ActivityEvent).values(user_id=user.id, event_type="daily_checkin", client_event_id=payload.client_event_id, payload=values, expires_at=now() + timedelta(days=get_settings().structured_data_retention_days)).on_conflict_do_nothing())
        return daily_summary(db, user.id)

@router.post("/memory/facts")
def record_fact(payload: FactInput, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        if not db.get(Profile, user.id).memory_enabled:
            raise HTTPException(409, "Enable memory first")
        values = dict(user_id=user.id, **payload.model_dump(), user_confirmed=True, expires_at=now() + timedelta(days=db.get(Profile, user.id).retention_days))
        db.execute(insert(MemoryFact).values(**values).on_conflict_do_update(index_elements=["user_id", "fact_key"], set_={k: v for k, v in values.items() if k not in {"user_id", "fact_key"}}))
    return {"ok": True}

@router.delete("/memory")
def forget_memory(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        db.execute(delete(RagDocument).where(RagDocument.user_id == user.id))
        db.execute(delete(MemoryFact).where(MemoryFact.user_id == user.id))
        db.execute(delete(BackgroundJob).where(BackgroundJob.user_id == user.id))
        db.get(Profile, user.id).memory_enabled = False
    return {"ok": True}

@router.delete("/account/data")
def delete_account_data(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        # Retain an identity tombstone so the same Neon identity cannot recreate data.
        from app.models.domain import AuthHandoff
        db.execute(delete(AuthHandoff).where(AuthHandoff.user_id == user.id))
        for model in (Conversation, ActivityEvent, GameSession, DailyMetric, MemoryFact, ScreenTimeSnapshot, LocationPoint, VisitedPlace):
            db.execute(delete(model).where(model.user_id == user.id))
        db.execute(delete(Profile).where(Profile.user_id == user.id))
        db.get(User, user.id).status = "deleted"
    return {"ok": True}

@router.get("/insights")
def insights(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        data = daily_summary(db, user.id)
        return {"insights": [f"You completed {data['game_count']} games and {data['exercise_count']} exercises today."]}

@router.post("/live/sessions")
def live_session(payload: LiveInput, user: Principal = Depends(current_user)):
    settings = get_settings()
    if not settings.live_enabled or not settings.gemini_api_key:
        raise HTTPException(503, "Live voice is not enabled")
    with user_session(user.id) as db:
        p = db.get(Profile, user.id)
        active = db.scalar(select(func.count()).select_from(LiveTicket).where(LiveTicket.user_id == user.id, LiveTicket.expires_at > now()))
        if active >= 3:
            raise HTTPException(429, "Too many active voice sessions")
        c = owned_conversation(db, user.id, payload.conversation_id) if payload.conversation_id else create_conversation(db, user.id, payload.language, "live")
        token = secrets.token_urlsafe(32)
        db.add(LiveTicket(user_id=user.id, conversation_id=c.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=now() + timedelta(seconds=30)))
        return {"ticket": token, "conversation_id": str(c.id), "user_id": str(user.id), "transcript_storage_enabled": p.transcript_storage_enabled, "expires_in": 30}

# Deliberately no public /audio mount, image capture endpoint, or performance endpoint.

@router.post("/screen-time/sync")
def screen_sync(payload: ScreenSync, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        for snap in payload.snapshots:
            db.execute(insert(ScreenTimeSnapshot).values(user_id=user.id, client_event_id=f"screen:{snap.capturedAt}", metric_date=snap.day,
                captured_at=datetime.fromtimestamp(snap.capturedAt / 1000, timezone.utc), total_screen_time_ms=snap.totalScreenTimeMs,
                foreground_time_ms=snap.foregroundTimeMs, app_opens=snap.appOpens, apps=[a.model_dump() for a in snap.apps],
                expires_at=now() + timedelta(days=get_settings().structured_data_retention_days)).on_conflict_do_nothing())
    return {"ok": True}

@router.post("/location/sync")
def location_sync(payload: LocationSync, user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        for p in payload.points:
            db.execute(insert(LocationPoint).values(user_id=user.id, client_event_id=f"point:{p.timestamp}:{p.latitude}:{p.longitude}", latitude=p.latitude, longitude=p.longitude,
                occurred_at=datetime.fromtimestamp(p.timestamp / 1000, timezone.utc), expires_at=now() + timedelta(days=get_settings().location_retention_days)).on_conflict_do_nothing())
        for v in payload.visits:
            db.execute(insert(VisitedPlace).values(user_id=user.id, client_event_id=f"visit:{v.entryTime}:{v.latitude}:{v.longitude}", place_name=v.placeName, category=v.category,
                latitude=v.latitude, longitude=v.longitude, entry_time=datetime.fromtimestamp(v.entryTime / 1000, timezone.utc), exit_time=datetime.fromtimestamp(v.exitTime / 1000, timezone.utc),
                duration_ms=v.durationMs, expires_at=now() + timedelta(days=get_settings().location_retention_days)).on_conflict_do_nothing())
    return {"ok": True}

@router.get("/location/insights")
def location_insights(user: Principal = Depends(current_user)):
    with user_session(user.id) as db:
        rows = db.scalars(select(VisitedPlace).where(VisitedPlace.user_id == user.id, VisitedPlace.expires_at > now()).order_by(VisitedPlace.entry_time.desc()).limit(50)).all()
        return {"timeline": [{"time": r.entry_time, "place": r.place_name, "category": r.category, "duration_ms": r.duration_ms} for r in reversed(rows)], "totals": {"visits_analyzed": len(rows)}}
