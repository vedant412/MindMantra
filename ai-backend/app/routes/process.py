import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from app.db.database import get_db
from app.models.schemas import ProcessInputRequest, ProcessInputResponse

from app.services.memory_service import get_user_memory, extract_and_store_facts, store_conversation, store_cognitive_history, get_daily_summary, extract_user_events, store_user_events
from app.services.insight_service import generate_and_store_insights, get_recent_insights
from app.services.sentiment_service import analyze_sentiment
from app.services.state_service import determine_state
from app.services.question_service import get_next_question, detect_answer
from app.services.llm_service import generate_response
from app.services.speech_service import transcribe_audio
from app.services.tts_service import text_to_speech
from app.services.speech_analysis_service import analyze_speech
from app.services.cognitive_service import calculate_cognitive_score
from app.services.time_service import get_time_context
from app.services.emotion_service import detect_emotion_from_base64
from pydantic import BaseModel

router = APIRouter()

class EmotionRequest(BaseModel):
    image_b64: str

@router.post("/detect-emotion")
async def detect_emotion(req: EmotionRequest):
    result = detect_emotion_from_base64(req.image_b64)
    return result

@router.post("/process-input", response_model=ProcessInputResponse)
async def process_input(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("Content-Type", "")
    
    user_id = None
    session_id = None
    text = None
    emotion = None
    audio_file = None
    
    if "application/json" in content_type:
        try:
            data = await request.json()
            user_id = data.get("user_id")
            session_id = data.get("session_id")
            text = data.get("text")
            emotion = data.get("emotion")
        except:
            print("BLOCKED: Invalid JSON payload provided.")
            raise HTTPException(status_code=400, detail="Invalid JSON format")
    elif "multipart/form-data" in content_type:
        form = await request.form()
        user_id = form.get("user_id")
        session_id = form.get("session_id")
        text = form.get("text")
        emotion = form.get("emotion")
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

    # 1. Handle Audio input if present
    if audio_file:
        temp_dir = os.path.join(os.getcwd(), "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4().hex}_{audio_file.filename}")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)
            
        # Transcribe audio to text
        text, segments = transcribe_audio(temp_path)
        
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    text = text.strip() if text else ""
    if not text:
        if audio_file:
            fallback_msg = "Hmm, I didn't quite catch that. Could you say it again?"
            return ProcessInputResponse(
                response=fallback_msg,
                audio_url=await text_to_speech(fallback_msg, emotion="neutral"),
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
    ai_response_text, final_question = generate_response(
        user_text=text,
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
    audio_url = await text_to_speech(ai_response_text, emotion=stable_emo)
    
    # 10. Generate Unified Cognitive Insight
    generate_and_store_insights(db, user_id)
    
    # 11. Return structured output
    return ProcessInputResponse(
        response=ai_response_text,
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
