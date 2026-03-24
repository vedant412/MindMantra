from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from datetime import datetime, timezone
from app.db.database import Base
from pydantic import BaseModel
from typing import Optional, Dict

# --- SQLAlchemy Models ---

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True, nullable=False, default="default")
    user_text = Column(String)
    ai_response = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UserFact(Base):
    __tablename__ = "user_facts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    key = Column(String, index=True)
    value = Column(String)

class RequiredQuestion(Base):
    __tablename__ = "required_questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    frequency = Column(String) # e.g. "daily"
    last_asked = Column(DateTime, nullable=True)

class DailyQuestion(Base):
    __tablename__ = "daily_questions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    question = Column(String)
    category = Column(String)
    asked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    answered = Column(Boolean, default=False)
    answer_text = Column(String, nullable=True)
    answer_time = Column(DateTime, nullable=True)

class UserEvent(Base):
    __tablename__ = "user_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    category = Column(String)
    value = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UserInsight(Base):
    __tablename__ = "user_insights"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    insight_text = Column(String)
    pattern_type = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class CognitiveHistory(Base):
    __tablename__ = "cognitive_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True)
    score = Column(Integer)
    state = Column(String)
    emotion = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# --- Pydantic Schemas ---

class ProcessInputRequest(BaseModel):
    user_id: str
    session_id: str
    text: str

class ProcessInputResponse(BaseModel):
    response: str
    audio_url: Optional[str] = None
    session_id: str
    question: str
    question_type: str # "required | generated"
    sentiment: str     # "positive | negative | neutral"
    state: str         # "normal | stressed | fatigue"
    emotion: Optional[str] = None
    cognitive_state: Optional[str] = None
    cognitive_score: Optional[int] = None
    confidence: Optional[float] = None
    speech_analysis: Optional[Dict] = None
