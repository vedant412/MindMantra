from datetime import datetime, date
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.services.activity_catalog import GameCode, ExerciseCode

class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")

class ProfileInput(Contract):
    name: str | None = Field(None, max_length=100)
    stress: str | None = Field(None, max_length=1000)
    sleep: str | None = Field(None, max_length=1000)
    goals: str | None = Field(None, max_length=1000)
    triggers: str | None = Field(None, max_length=1000)
    preferred_language: Literal["en", "hi", "mr"] = "en"
    timezone: str = "Asia/Kolkata"
    memory_enabled: bool = False
    transcript_storage_enabled: bool = False
    retention_days: int = Field(90, ge=1, le=365)

    @field_validator("timezone")
    @classmethod
    def timezone_valid(cls, value):
        try:
            ZoneInfo(value)
        except Exception:
            raise ValueError("Unknown timezone") from None
        return value

    @model_validator(mode="after")
    def memory_requires_storage(self):
        if self.memory_enabled and "transcript_storage_enabled" in self.model_fields_set and not self.transcript_storage_enabled:
            raise ValueError("Memory requires transcript storage consent")
        return self

class ConversationInput(Contract):
    language: Literal["en", "hi", "mr"] = "en"

class TextInput(Contract):
    conversation_id: UUID
    text: str = Field(min_length=1, max_length=4000)
    client_event_id: str = Field(min_length=8, max_length=100)
    preferred_language: Literal["en", "hi", "mr"] = "en"

class RoundResult(Contract):
    correct: bool
    reaction_time_ms: int | None = Field(None, ge=0, le=600000)

class GameInput(Contract):
    game_code: GameCode
    game_version: Literal["1", "2"] = "1"
    client_session_id: str = Field(min_length=8, max_length=100)
    started_at: datetime
    ended_at: datetime
    score: int = Field(ge=0, le=100)
    round_results: list[RoundResult] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def valid_times(self):
        if self.started_at.tzinfo is None or self.ended_at.tzinfo is None:
            raise ValueError("Timezone offsets required")
        if self.ended_at < self.started_at:
            raise ValueError("End precedes start")
        from datetime import timezone, timedelta
        if self.ended_at > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Future session")
        limits = {"g1": 50, "g2": 45, "g3": 50, "g4": 75, "gl1": 50, "gl2": 50, "gl3": 50, "gl4": 50, "gl5": 50}
        if self.game_code.startswith("gl") and self.game_version != "2":
            raise ValueError("New games require game version 2")
        if self.score > limits[self.game_code] or self.score % 5:
            raise ValueError("Invalid game score")
        from app.services.game_scoring import calculate_game_score
        if self.score != calculate_game_score(self.game_code, self.round_results):
            raise ValueError("Score does not match round results")
        return self

class ActivityInput(Contract):
    activity_code: ExerciseCode
    client_event_id: str = Field(min_length=8, max_length=100)
    duration_ms: int = Field(ge=0, le=86400000)

class CheckinInput(Contract):
    client_event_id: str = Field(min_length=8, max_length=100)
    sleep_hours: float = Field(ge=0, le=24)
    mood: Literal["Great", "Good", "Okay", "Stressed"]

class FactInput(Contract):
    fact_key: str = Field(min_length=1, max_length=100)
    value_text: str = Field(min_length=1, max_length=1000)

class LiveInput(ConversationInput):
    conversation_id: UUID | None = None

class AppUsage(Contract):
    packageName: str = Field(max_length=300)
    appName: str = Field(max_length=300)
    foregroundTimeMs: int = Field(ge=0)
    opens: int = Field(ge=0)
    firstTimeStamp: int = Field(ge=0)
    lastTimeStamp: int = Field(ge=0)

class ScreenSnapshot(Contract):
    capturedAt: int = Field(ge=0, le=4102444800000)
    day: date
    totalScreenTimeMs: int = Field(ge=0)
    foregroundTimeMs: int = Field(ge=0)
    appOpens: int = Field(ge=0)
    apps: list[AppUsage] = Field(max_length=500)

class ScreenSync(Contract):
    snapshots: list[ScreenSnapshot] = Field(max_length=100)

class LocationPointInput(Contract):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timestamp: int = Field(ge=0, le=4102444800000)

class VisitInput(Contract):
    placeName: str = Field(max_length=500)
    category: str = Field(max_length=30)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    entryTime: int = Field(ge=0, le=4102444800000)
    exitTime: int = Field(ge=0, le=4102444800000)
    durationMs: int = Field(ge=0)

    @model_validator(mode="after")
    def times_valid(self):
        if self.exitTime < self.entryTime:
            raise ValueError("Exit precedes entry")
        return self

class LocationSync(Contract):
    points: list[LocationPointInput] = Field(max_length=500)
    visits: list[VisitInput] = Field(max_length=100)
