from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS
from uuid import uuid4
import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from app.contracts import GameInput, ActivityInput, RoundResult
from app.services.activity_catalog import GAME_CODES, EXERCISE_CODES, exercise_points
from app.services.game_scoring import calculate_game_score
from app.services.activity_progress import activity_progress

def session(code, rounds, score, version="2"):
    return dict(game_code=code, game_version=version, client_session_id="stable-session-id",
        started_at=datetime.now(timezone.utc)-timedelta(minutes=1), ended_at=datetime.now(timezone.utc), score=score, round_results=rounds)

@pytest.mark.parametrize("code", GAME_CODES)
def test_all_nine_games_accept_valid_structured_results(code):
    rounds = [{"correct": True, **({"reaction_time_ms": 250} if code == "g2" else {})}] * (3 if code == "g2" else 5)
    score = 45 if code == "g2" else 75 if code == "g4" else 50
    assert GameInput(**session(code, rounds, score)).score == score
    with pytest.raises(ValidationError):
        GameInput(**session(code, rounds, score-5))

@pytest.mark.parametrize("matches,attempts,expected", [(5, 5, 50), (5, 6, 40), (5, 8, 30), (1, 20, 5), (0, 20, 0)])
def test_card_match_accuracy_and_half_up_rounding(matches, attempts, expected):
    rounds = [RoundResult(correct=True)] * matches + [RoundResult(correct=False)] * (attempts-matches)
    assert calculate_game_score("gl2", rounds) == expected

def test_incomplete_or_impossible_matching_records_are_rejected():
    for rounds in ([RoundResult(correct=True)], [RoundResult(correct=True)] * 6, [RoundResult(correct=False)] * 21):
        with pytest.raises(ValueError): calculate_game_score("gl2", rounds)
    with pytest.raises(ValidationError): GameInput(**session("gl1", [{"correct": True}] * 5, 50, "1"))
    assert GameInput(**session("g1", [{"correct": True}] * 5, 50, "1")).game_version == "1"

@pytest.mark.parametrize("code", EXERCISE_CODES)
def test_all_ten_exercises_accept_only_structured_completion_data(code):
    payload = dict(activity_code=code, client_event_id="stable-event-id", duration_ms=60000)
    assert ActivityInput(**payload).activity_code == code
    with pytest.raises(ValidationError): ActivityInput(**payload, journal_text="private reflection")
    assert exercise_points(code, 60000) == 5
    assert exercise_points(code, 25*60000) == (15 if code == "e4" else 5)

def test_progress_uses_owned_sql_and_distinct_activity_codes():
    owner = uuid4()
    class Result:
        def __init__(self, rows): self.rows = rows
        def all(self): return self.rows
    class Database:
        def __init__(self): self.queries = []; self.totals = iter([100, 20])
        def get(self, model, key): assert key == owner; return NS(timezone="Asia/Kolkata")
        def inspect(self, query):
            compiled = query.compile(dialect=postgresql.dialect())
            assert "user_id" in str(compiled) and "expires_at" in str(compiled)
            assert owner in compiled.params.values()
            self.queries.append(str(compiled))
        def execute(self, query):
            self.inspect(query)
            return Result([("g1", 50)] if len(self.queries) == 1 else [("e1", 5)])
        def scalar(self, query): self.inspect(query); return next(self.totals)
    db = Database(); result = activity_progress(db, owner)
    assert result["completed_ids"] == ["e1", "g1"]
    assert result["daily_points"] == 55
    assert result["total_points"] == 120
    assert all("GROUP BY" in query for query in db.queries[:2])
