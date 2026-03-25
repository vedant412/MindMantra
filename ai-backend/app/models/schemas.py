from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from datetime import datetime, timezone
from app.db.database import Base
from pydantic import BaseModel
from typing import Optional, Dict, List

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

class ScreenTimeSnapshot(Base):
    __tablename__ = "screen_time_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    day = Column(String, index=True, nullable=False)
    captured_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    total_screen_time_ms = Column(Integer, nullable=False, default=0)
    foreground_time_ms = Column(Integer, nullable=False, default=0)
    app_opens = Column(Integer, nullable=False, default=0)

class ScreenTimeAppUsage(Base):
    __tablename__ = "screen_time_app_usage"
    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, index=True, nullable=False)
    package_name = Column(String, index=True, nullable=False)
    app_name = Column(String, nullable=False)
    foreground_time_ms = Column(Integer, nullable=False, default=0)
    opens = Column(Integer, nullable=False, default=0)
    first_timestamp = Column(DateTime, nullable=True)
    last_timestamp = Column(DateTime, nullable=True)

class LocationPoint(Base):
    __tablename__ = "location_points"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class VisitedPlace(Base):
    __tablename__ = "visited_places"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    place_name = Column(String, nullable=False)
    category = Column(String, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=False)
    duration_ms = Column(Integer, nullable=False, default=0)

# --- Pydantic Schemas ---

class ProcessInputRequest(BaseModel):
    user_id: str
    session_id: str
    text: str
    preferred_language: Optional[str] = "auto"

class UserProfileCreate(BaseModel):
    user_id: str
    name: Optional[str] = None
    stress: Optional[str] = None
    sleep: Optional[str] = None
    goals: Optional[str] = None
    triggers: Optional[str] = None

class ProcessInputResponse(BaseModel):
    response: str
    language: str = "en"
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
    actions: Optional[List[Dict]] = None

class AppUsageItemIn(BaseModel):
    packageName: str
    appName: str
    foregroundTimeMs: int
    opens: int
    firstTimeStamp: int
    lastTimeStamp: int

class ScreenTimeSnapshotIn(BaseModel):
    capturedAt: int
    day: str
    totalScreenTimeMs: int
    foregroundTimeMs: int
    appOpens: int
    apps: List[AppUsageItemIn]

class ScreenTimeSyncRequest(BaseModel):
    user_id: str
    session_id: str
    snapshots: List[ScreenTimeSnapshotIn]

class LocationPointIn(BaseModel):
    latitude: float
    longitude: float
    timestamp: int

class VisitedPlaceIn(BaseModel):
    placeName: str
    category: str
    latitude: float
    longitude: float
    entryTime: int
    exitTime: int
    durationMs: int

class LocationSyncRequest(BaseModel):
    user_id: str
    session_id: str
    points: List[LocationPointIn]
    visits: List[VisitedPlaceIn]
