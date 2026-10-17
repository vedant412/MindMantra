import asyncio
import math
import uuid
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.settings import Settings
from app.contracts import GameInput, ProfileInput, TextInput
from app.services.analytics import component_scores, day_bounds
from app.services.embeddings import normalized_vector
from app.routes.live import call_tool
from app.main import app
from app.services.analytics import game_trends
from sqlalchemy.dialects import postgresql

def test_no_sqlite_or_incompatible_embedding_configuration():
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///./memory.db")
    with pytest.raises(ValidationError):
        Settings(embedding_dimensions=3072)

def test_missing_measurements_are_not_scores():
    scores = component_scores(0, 0, False, None, None)
    assert scores["composite_score"] is None
    assert scores["sleep_score"] is None
    assert scores["screen_score"] is None
    assert component_scores(4, 5, True, 480, 180*60000, 100)["composite_score"] == 100

def test_timezone_and_dst_windows():
    lower, upper = day_bounds(date(2026, 10, 17), "Asia/Kolkata")
    assert lower.isoformat() == "2026-10-16T18:30:00+00:00"
    assert (upper - lower).total_seconds() == 86400
    lower, upper = day_bounds(date(2026, 3, 8), "America/New_York")
    assert (upper - lower).total_seconds() == 23 * 3600

def test_embedding_dimensions_finite_and_nonzero():
    assert math.isclose(sum(x*x for x in normalized_vector([1.] * 768)), 1.)
    for values in ([1.] * 3072, [0.] * 768, [float("nan")] * 768):
        with pytest.raises(ValueError):
            normalized_vector(values)

def test_ownership_cannot_be_submitted():
    with pytest.raises(ValidationError):
        TextInput(conversation_id=uuid.uuid4(), text="Hi", client_event_id="12345678", user_id="other")

def test_consent_and_language_validation():
    with pytest.raises(ValidationError):
        ProfileInput(memory_enabled=True, transcript_storage_enabled=False)
    assert ProfileInput(memory_enabled=True).memory_enabled
    with pytest.raises(ValidationError):
        ProfileInput(timezone="Not/AZone")
    for language in ("en", "hi", "mr"):
        assert ProfileInput(preferred_language=language).preferred_language == language

def test_game_validation():
    data = dict(game_code="g2", client_session_id="12345678", started_at=datetime(2026, 1, 1, tzinfo=timezone.utc), ended_at=datetime(2026, 1, 2, tzinfo=timezone.utc), round_results=[{"correct": True, "reaction_time_ms": 250}] * 3)
    assert GameInput(**data, score=45).score == 45
    with pytest.raises(ValidationError):
        GameInput(**data, score=50)
    with pytest.raises(ValidationError):
        GameInput(**data, score=40)

def test_anonymous_routes_fail_without_contacting_database():
    client = TestClient(app)
    for route in ("/user-profile", "/daily-summary", "/insights", "/location/insights"):
        assert client.get(route).status_code == 401
    assert client.get("/audio/old.mp3").status_code == 404
    assert client.get("/perf-stats").status_code == 404

def test_tool_owner_override_and_arbitrary_sql_rejected():
    assert "error" in asyncio.run(call_tool(uuid.uuid4(), "get_daily_metrics", {"day": "2026-10-17", "user_id": "other"}))
    assert "error" in asyncio.run(call_tool(uuid.uuid4(), "execute_sql", {"sql": "SELECT * FROM users"}))

def test_invalid_websocket_ticket_closes():
    client = TestClient(app)
    with client.websocket_connect("/live/ws") as socket:
        with pytest.raises(Exception):
            socket.receive_json()

def test_improvement_arithmetic_is_compiled_into_sql():
    class Results:
        def mappings(self): return self
        def all(self): return []
    class Database:
        statement = None
        def get(self, model, key): return None
        def execute(self, statement):
            self.statement = statement
            return Results()
    db = Database()
    result = game_trends(db, uuid.uuid4(), 'g1', date(2026, 1, 1), date(2026, 1, 15))
    sql = str(db.statement.compile(dialect=postgresql.dialect()))
    assert 'nullif' in sql.lower() and 'FILTER' in sql and 'CASE WHEN' in sql
    assert 'user_id' in sql and 'expires_at' in sql and 'difficulty' in sql
    assert result['groups'] == []
