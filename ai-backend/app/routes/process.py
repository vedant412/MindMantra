import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from datetime import date
from typing import Optional, Dict, Any
from collections import defaultdict
from app.db.database import get_db  # type: ignore
from app.models.schemas import (  # type: ignore
    ProcessInputRequest,
    ProcessInputResponse,
    UserFact,
    UserProfileCreate,
    ScreenTimeSyncRequest,
    LocationSyncRequest,
    ScreenTimeSnapshot,
    ScreenTimeAppUsage,
    LocationPoint,
    VisitedPlace,
)

from app.services.memory_service import get_user_memory, extract_and_store_facts, store_conversation, store_cognitive_history, get_daily_summary, extract_user_events, store_user_events  # type: ignore
from app.services.insight_service import generate_and_store_insights, get_recent_insights  # type: ignore
from app.services.sentiment_service import analyze_sentiment  # type: ignore
from app.services.state_service import determine_state  # type: ignore
from app.services.question_service import get_next_question, detect_answer  # type: ignore
from app.services.llm_service import generate_response  # type: ignore
from app.services.speech_service import transcribe_audio  # type: ignore
from app.services.tts_service import text_to_speech  # type: ignore
from app.services.speech_analysis_service import analyze_speech  # type: ignore
from app.services.cognitive_service import calculate_cognitive_score  # type: ignore
from app.services.time_service import get_time_context  # type: ignore
from app.services.emotion_service import detect_emotion_from_base64  # type: ignore
from pydantic import BaseModel  # type: ignore
from datetime import datetime, timezone

router = APIRouter()

class EmotionRequest(BaseModel):
    image_b64: str

@router.post("/detect-emotion")
async def detect_emotion(req: EmotionRequest):
    result = detect_emotion_from_base64(req.image_b64)
    return result

@router.post("/user-profile")
async def create_user_profile(profile: UserProfileCreate, db: Session = Depends(get_db)):
    facts = {
        "Name": profile.name,
        "General Stress Level": profile.stress,
        "Sleep Habits": profile.sleep,
        "Wellness Goals": profile.goals,
        "Overwhelm Triggers": profile.triggers
    }
    
    for key, value in facts.items():
        if value:
            existing = db.query(UserFact).filter(UserFact.user_id == profile.user_id, UserFact.key == key).first()
            if existing:
                existing.value = value
            else:
                new_fact = UserFact(user_id=profile.user_id, key=key, value=value)
                db.add(new_fact)
                
    db.commit()
    return {"status": "success"}

@router.get("/user-profile")
def get_user_profile(user_id: str = Query(...), db: Session = Depends(get_db)):
    facts = db.query(UserFact).filter(UserFact.user_id == user_id).all()
    profile = {}
    for f in facts:
        profile[f.key] = f.value
    return profile

@router.post("/process-input", response_model=ProcessInputResponse)
async def process_input(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("Content-Type", "")
    
    user_id = None
    session_id = None
    text = None
    emotion = None
    audio_file = None
    preferred_language = "auto"
    
    if "application/json" in content_type:
        try:
            data = await request.json()
            user_id = data.get("user_id")
            session_id = data.get("session_id")
            text = data.get("text")
            emotion = data.get("emotion")
            preferred_language = data.get("preferred_language", "auto")
        except:
            print("BLOCKED: Invalid JSON payload provided.")
            raise HTTPException(status_code=400, detail="Invalid JSON format")
    elif "multipart/form-data" in content_type:
        form = await request.form()
        user_id = form.get("user_id")
        session_id = form.get("session_id")
        text = form.get("text")
        emotion = form.get("emotion")
        preferred_language = form.get("preferred_language", "auto")
        # Ensure it's an UploadFile object
        audio_field = form.get("audio_file")
        if hasattr(audio_field, "filename") and audio_field.filename:
            audio_file = audio_field
    else:
        print(f"BLOCKED: Unsupported Content-Type encountered: '{content_type}'")
        raise HTTPException(status_code=400, detail="Unsupported Content-Type. Use application/json or multipart/form-data")

    # String type fallback checks
    if type(user_id) != str and user_id is not None:
        user_id = str(user_id)
    if type(session_id) != str and session_id is not None:
        session_id = str(session_id)
    if type(text) != str and text is not None:
        text = str(text)

    if not user_id:
        print("BLOCKED: user_id was not provided in the request.")
        raise HTTPException(status_code=400, detail="user_id is required")
        
    if not session_id:
        print("BLOCKED: session_id was not provided in the request.")
        raise HTTPException(status_code=400, detail="session_id is required")

    detected_lang = preferred_language if preferred_language != "auto" else "en"

    # 1. Handle Audio input if present
    if audio_file:
        temp_dir = os.path.join(os.getcwd(), "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4().hex}_{audio_file.filename}")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)
            
        # Transcribe audio to text
        text, segments, detected_lang = transcribe_audio(temp_path, preferred_language)
        
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    text = text.strip() if text else ""
    if not text:
        if audio_file:
            fallback_msg = "Hmm, I didn't quite catch that. Could you say it again?"
            return ProcessInputResponse(
                response=fallback_msg,
                language=detected_lang,
                audio_url=await text_to_speech(fallback_msg, emotion="neutral", language=detected_lang),
                session_id=session_id,
                question="Could you say it again?",
                question_type="generated",
                sentiment="neutral",
                state="normal",
                confidence=0,
                speech_analysis=None
            )
        else:
            print("BLOCKED: Both text and audio_file were empty or missing.")
            raise HTTPException(status_code=400, detail="Text or audio_file cannot be empty")
        
    confidence = None
    speech_analysis_data = None
    
    if audio_file and 'segments' in locals():
        speech_analysis_data = analyze_speech(text, segments)
        confidence = speech_analysis_data["confidence"]
        
    # 2. Analyze sentiment
    sentiment = analyze_sentiment(text)
    
    # 3. Extract new facts from user text
    extract_and_store_facts(db, user_id, text)
    detect_answer(db, user_id, text)
    
    # 3b. Extract behavioral activity strings directly
    recent_tracked_events = extract_user_events(text)
    store_user_events(db, user_id, recent_tracked_events)

    # 4. Fetch updated user memory scoped to this session
    memory = get_user_memory(db, user_id, session_id)
    
    # 5. Cognitive Scoring System
    cog_score, cog_state, stable_emo = calculate_cognitive_score(session_id, confidence, sentiment, emotion)
    store_cognitive_history(db, user_id, session_id, cog_score, cog_state, emotion=stable_emo, confidence=confidence)
    
    # 6. Fetch Time Context
    current_time, time_of_day, ask_time_q = get_time_context()
    
    # 7. Select question (Now mathematically bounded + temporally aware)
    question, q_type = get_next_question(db, user_id, time_of_day)
    
    # Fetch today's aggregate overview
    daily_summary_data = get_daily_summary(db, user_id)
    
    # Fetch recent overarching AI insights to pass into the LLM logic
    recent_insights_data = get_recent_insights(db, user_id)
    
    # 8. Generate response using LLM (Ollama)
    ai_response_text, final_question, actions = generate_response(
        user_text=text,
        language=detected_lang,
        memory=memory,
        state=cog_state,
        selected_question=question,
        emotion=stable_emo,
        cognitive_score=cog_score,
        cognitive_state=cog_state,
        sentiment=sentiment,
        confidence=confidence,
        current_time=current_time,
        time_of_day=time_of_day,
        ask_time_q=ask_time_q,
        daily_summary=daily_summary_data,
        recent_insights=recent_insights_data
    )
    
    # 9. Store conversation locally in this session
    store_conversation(db, user_id, session_id, text, ai_response_text)
    
    # 9. Generate AI voice (TTS)
    audio_url = await text_to_speech(ai_response_text, emotion=stable_emo, language=detected_lang)
    
    # 10. Generate Unified Cognitive Insight
    generate_and_store_insights(db, user_id)
    
    # 11. Return structured output
    return ProcessInputResponse(
        response=ai_response_text,
        language=detected_lang,
        audio_url=audio_url,
        session_id=session_id,
        question=final_question,
        question_type=q_type,
        sentiment=sentiment,
        state=cog_state,
        emotion=stable_emo,
        cognitive_state=cog_state,
        cognitive_score=cog_score,
        confidence=confidence,
        actions=actions
    )

@router.get("/daily-summary")
def get_daily_summary_endpoint(user_id: str = Query(...), target_date: Optional[date] = None, db: Session = Depends(get_db)):
    """REST API hook returning JSON analysis telemetry per day"""
    summary = get_daily_summary(db, user_id, target_date)
    return summary

@router.get("/insights")
def get_insights_endpoint(user_id: str = Query(...), db: Session = Depends(get_db)):
    """REST API hook exposing specific human-readable behavioral telemetry insights"""
    insights = get_recent_insights(db, user_id)
    return {"insights": insights}

@router.post("/screen-time/sync")
def sync_screen_time(payload: ScreenTimeSyncRequest, db: Session = Depends(get_db)):
    created_snapshots = 0  # type: ignore
    created_app_rows = 0  # type: ignore
    for snap in payload.snapshots:
        captured_at_dt = datetime.fromtimestamp(snap.capturedAt / 1000, tz=timezone.utc)
        snapshot_row = ScreenTimeSnapshot(
            user_id=payload.user_id,
            session_id=payload.session_id,
            day=snap.day,
            captured_at=captured_at_dt,
            total_screen_time_ms=snap.totalScreenTimeMs,
            foreground_time_ms=snap.foregroundTimeMs,
            app_opens=snap.appOpens,
        )
        db.add(snapshot_row)
        db.flush()
        created_snapshots += 1

        for app in snap.apps:
            app_row = ScreenTimeAppUsage(
                snapshot_id=snapshot_row.id,
                package_name=app.packageName,
                app_name=app.appName,
                foreground_time_ms=app.foregroundTimeMs,
                opens=app.opens,
                first_timestamp=datetime.fromtimestamp(app.firstTimeStamp / 1000, tz=timezone.utc),
                last_timestamp=datetime.fromtimestamp(app.lastTimeStamp / 1000, tz=timezone.utc),
            )
            db.add(app_row)
            created_app_rows = int(created_app_rows) + 1  # type: ignore

    db.commit()
    return {"ok": True, "created_snapshots": created_snapshots, "created_app_rows": created_app_rows}

@router.post("/location/sync")
def sync_location(payload: LocationSyncRequest, db: Session = Depends(get_db)):
    created_points = 0
    created_visits = 0

    for point in payload.points:
        point_row = LocationPoint(
            user_id=payload.user_id,
            session_id=payload.session_id,
            latitude=point.latitude,
            longitude=point.longitude,
            timestamp=datetime.fromtimestamp(point.timestamp / 1000, tz=timezone.utc),
        )
        db.add(point_row)
        created_points += 1

    for visit in payload.visits:
        visit_row = VisitedPlace(
            user_id=payload.user_id,
            session_id=payload.session_id,
            place_name=visit.placeName,
            category=visit.category,
            latitude=visit.latitude,
            longitude=visit.longitude,
            entry_time=datetime.fromtimestamp(visit.entryTime / 1000, tz=timezone.utc),
            exit_time=datetime.fromtimestamp(visit.exitTime / 1000, tz=timezone.utc),
            duration_ms=visit.durationMs,
        )
        db.add(visit_row)
        created_visits += 1

    db.commit()
    return {"ok": True, "created_points": created_points, "created_visits": created_visits}

@router.get("/location/insights")
def get_location_insights_endpoint(user_id: str = Query(...), limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)):
    visits = (
        db.query(VisitedPlace)
        .filter(VisitedPlace.user_id == user_id)
        .order_by(VisitedPlace.entry_time.desc())
        .limit(limit)
        .all()
    )

    timeline = [
        {
            "time": v.entry_time.isoformat(),
            "place": v.place_name,
            "category": v.category,
            "duration_ms": v.duration_ms,
        }
        for v in reversed(visits)
    ]

    freq: Dict[str, Any] = defaultdict(lambda: {"place_name": "", "category": "", "visits": 0, "total_duration_ms": 0})
    for v in visits:
        key = f"{v.place_name}|{v.category}"
        freq[key]["place_name"] = v.place_name
        freq[key]["category"] = v.category
        freq[key]["visits"] = int(freq[key]["visits"]) + 1
        freq[key]["total_duration_ms"] = int(freq[key]["total_duration_ms"]) + int(v.duration_ms)

    sorted_places = sorted(freq.values(), key=lambda x: (int(x["visits"]), int(x["total_duration_ms"])), reverse=True)
    frequent_places = sorted_places[:5]  # type: ignore
    park_visits = sum(1 for v in visits if v.category == "park")
    off_hour_visits = sum(1 for v in visits if v.entry_time.hour <= 5 or v.entry_time.hour >= 23)

    return {
        "timeline": timeline,
        "frequent_places": frequent_places,
        "patterns": {
            "lack_of_outdoor_activity": park_visits < 2,
            "irregular_movement": off_hour_visits > 0,
            "stress_correlation_hint": "Frequent visits to crowded indoor places may correlate with stress. Compare with mood logs for confidence."
        },
        "totals": {
            "visits_analyzed": len(visits),
            "park_visits": park_visits
        }
    }
