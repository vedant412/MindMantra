"""Production schema; legacy SQLite models are deliberately not imported."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, BigInteger, Boolean, DateTime, Date, Numeric, ForeignKey, ForeignKeyConstraint, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.db.database import Base

def now():
    return datetime.now(timezone.utc)

class Entity:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)

class Owned(Entity):
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), index=True)

class User(Entity, Base):
    __tablename__ = "users"
    auth_issuer = Column(Text, nullable=False)
    auth_subject = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    __table_args__ = (UniqueConstraint("auth_issuer", "auth_subject", name="uq_users_auth_identity"),)

class Profile(Base):
    __tablename__ = "profiles"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name = Column(Text)
    preferred_language = Column(String(8), nullable=False, default="en")
    timezone = Column(Text, nullable=False, default="Asia/Kolkata")
    stress_description = Column(Text)
    sleep_description = Column(Text)
    wellness_goals = Column(Text)
    overwhelm_triggers = Column(Text)
    memory_enabled = Column(Boolean, nullable=False, default=False)
    transcript_storage_enabled = Column(Boolean, nullable=False, default=False)
    retention_days = Column(Integer, nullable=False, default=90)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now, onupdate=now)
    __table_args__ = (CheckConstraint("retention_days BETWEEN 1 AND 365"),)

class Conversation(Owned, Base):
    __tablename__ = "conversations"
    channel = Column(String(20), nullable=False, default="text")
    language = Column(String(8), nullable=False, default="en")
    status = Column(String(20), nullable=False, default="active")
    ended_at = Column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("user_id", "id"), Index("ix_conversations_owner_time", "user_id", "created_at"))

class Message(Owned, Base):
    __tablename__ = "messages"
    conversation_id = Column(UUID(as_uuid=True), nullable=False)
    sequence_no = Column(BigInteger, nullable=False)
    role = Column(String(20), nullable=False)
    content_text = Column(Text, nullable=False)
    language = Column(String(8), nullable=False, default="en")
    interrupted = Column(Boolean, nullable=False, default=False)
    provider_event_id = Column(Text, nullable=False)
    __table_args__ = (ForeignKeyConstraint(["user_id", "conversation_id"], ["conversations.user_id", "conversations.id"], ondelete="CASCADE"), UniqueConstraint("user_id", "id"), UniqueConstraint("conversation_id", "sequence_no"), UniqueConstraint("conversation_id", "provider_event_id"), CheckConstraint("role IN ('user','assistant')"), Index("ix_messages_owner_time", "user_id", "created_at"))

class ActivityEvent(Owned, Base):
    __tablename__ = "activity_events"
    event_type = Column(String(40), nullable=False)
    activity_code = Column(String(40))
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=now)
    duration_ms = Column(BigInteger)
    points = Column(Numeric(12, 2))
    value_text = Column(Text)
    client_event_id = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False, default=dict)
    __table_args__ = (UniqueConstraint("user_id", "id"), UniqueConstraint("user_id", "client_event_id"), CheckConstraint("duration_ms IS NULL OR duration_ms >= 0"), Index("ix_events_owner_type_time", "user_id", "event_type", "occurred_at"))

class GameSession(Owned, Base):
    __tablename__ = "game_sessions"
    game_code = Column(String(20), nullable=False)
    game_version = Column(String(20), nullable=False, default="1")
    scoring_version = Column(String(20), nullable=False, default="game-v1")
    difficulty = Column(String(20), nullable=False, default="standard")
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=False)
    score = Column(Numeric(12, 2), nullable=False)
    round_results = Column(JSONB, nullable=False, default=list)
    client_session_id = Column(Text, nullable=False)
    verification_status = Column(String(30), nullable=False, default="client_reported")
    __table_args__ = (UniqueConstraint("user_id", "client_session_id"), CheckConstraint("ended_at >= started_at AND score >= 0"), Index("ix_game_trends", "user_id", "game_code", "scoring_version", "ended_at"))

class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    metric_date = Column(Date, primary_key=True)
    scoring_version = Column(String(30), primary_key=True, default="wellness-v1")
    timezone = Column(Text, nullable=False)
    game_count = Column(Integer, nullable=False, default=0)
    exercise_count = Column(Integer, nullable=False, default=0)
    activity_points = Column(Numeric(12, 2), nullable=False, default=0)
    sleep_minutes = Column(Integer)
    mood = Column(String(20))
    mood_score = Column(Integer)
    screen_time_ms = Column(BigInteger)
    vani_score = Column(Integer)
    activity_score = Column(Integer)
    sleep_score = Column(Integer)
    screen_score = Column(Integer)
    composite_score = Column(Integer)
    computed_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (CheckConstraint("sleep_minutes IS NULL OR sleep_minutes BETWEEN 0 AND 1440"),)

class MemoryFact(Owned, Base):
    __tablename__ = "memory_facts"
    fact_key = Column(Text, nullable=False)
    value_text = Column(Text, nullable=False)
    user_confirmed = Column(Boolean, nullable=False, default=True)
    __table_args__ = (UniqueConstraint("user_id", "fact_key"), UniqueConstraint("user_id", "id"))

class EmbeddingProfile(Entity, Base):
    __tablename__ = "embedding_profiles"
    name = Column(Text, nullable=False, unique=True)
    provider = Column(Text, nullable=False)
    model = Column(Text, nullable=False)
    dimensions = Column(Integer, nullable=False)
    __table_args__ = (CheckConstraint("dimensions = 768"),)

class RagDocument(Owned, Base):
    __tablename__ = "rag_documents"
    conversation_id = Column(UUID(as_uuid=True), nullable=False)
    document_type = Column(String(30), nullable=False)
    content_text = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    source_start_at = Column(DateTime(timezone=True), nullable=False)
    source_end_at = Column(DateTime(timezone=True), nullable=False)
    retrieval_enabled = Column(Boolean, nullable=False, default=True)
    __table_args__ = (ForeignKeyConstraint(["user_id", "conversation_id"], ["conversations.user_id", "conversations.id"], ondelete="CASCADE"), UniqueConstraint("user_id", "id"), UniqueConstraint("conversation_id", "content_hash"))

class RagChunk(Owned, Base):
    __tablename__ = "rag_chunks"
    document_id = Column(UUID(as_uuid=True), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content_text = Column(Text, nullable=False)
    embedding_profile_id = Column(UUID(as_uuid=True), ForeignKey("embedding_profiles.id"), nullable=False)
    embedding = Column(Vector(768), nullable=False)
    __table_args__ = (ForeignKeyConstraint(["user_id", "document_id"], ["rag_documents.user_id", "rag_documents.id"], ondelete="CASCADE"), UniqueConstraint("document_id", "chunk_index", "embedding_profile_id"))

class BackgroundJob(Owned, Base):
    __tablename__ = "background_jobs"
    conversation_id = Column(UUID(as_uuid=True), nullable=False)
    source_revision = Column(Integer, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending")
    available_at = Column(DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (ForeignKeyConstraint(["user_id", "conversation_id"], ["conversations.user_id", "conversations.id"], ondelete="CASCADE"), UniqueConstraint("conversation_id", "source_revision"))

class LiveTicket(Owned, Base):
    __tablename__ = "live_tickets"
    token_hash = Column(String(64), nullable=False, unique=True)
    conversation_id = Column(UUID(as_uuid=True), nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    __table_args__ = (ForeignKeyConstraint(["user_id", "conversation_id"], ["conversations.user_id", "conversations.id"], ondelete="CASCADE"),)

class AuthHandoff(Owned, Base):
    __tablename__ = "auth_handoffs"
    code_hash = Column(String(64), nullable=False, unique=True)
    challenge = Column(String(43), nullable=False)
    encrypted_token = Column(Text, nullable=False)

class ScreenTimeSnapshot(Owned, Base):
    __tablename__ = "screen_time_snapshots"
    client_event_id = Column(Text, nullable=False)
    metric_date = Column(Date, nullable=False)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    total_screen_time_ms = Column(BigInteger, nullable=False)
    foreground_time_ms = Column(BigInteger, nullable=False)
    app_opens = Column(Integer, nullable=False)
    apps = Column(JSONB, nullable=False, default=list)
    __table_args__ = (UniqueConstraint("user_id", "client_event_id"), CheckConstraint("total_screen_time_ms >= 0 AND foreground_time_ms >= 0 AND app_opens >= 0"))

class LocationPoint(Owned, Base):
    __tablename__ = "location_points"
    client_event_id = Column(Text, nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "client_event_id"), CheckConstraint("latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180"))

class VisitedPlace(Owned, Base):
    __tablename__ = "visited_places"
    client_event_id = Column(Text, nullable=False)
    place_name = Column(Text, nullable=False)
    category = Column(String(30), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    duration_ms = Column(BigInteger, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "client_event_id"), CheckConstraint("exit_time >= entry_time AND duration_ms >= 0"))
