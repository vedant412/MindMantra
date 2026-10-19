"""Requires a separate migrated test database. Never set this to production."""
import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL is not configured")

def test_rls_isolation_and_pool_context_reset():
    engine = create_engine(URL, pool_size=1, max_overflow=0)
    owners = [uuid.uuid4(), uuid.uuid4()]
    # URL must use the runtime role; provisioning uses the verified-subject function.
    with engine.begin() as db:
        owners = [db.execute(text("SELECT auth_resolve_user(:issuer,:subject)"), {"issuer": "https://integration.test", "subject": f"integration-{uuid.uuid4()}"}).scalar_one() for _ in range(2)]
    try:
        with engine.begin() as db:
            db.execute(text("SELECT set_config('app.user_id', :id, true)"), {"id": str(owners[0])})
            assert db.execute(text("SELECT count(*) FROM profiles")).scalar_one() == 1
            assert db.execute(text("SELECT count(*) FROM profiles WHERE user_id=:other"), {"other": owners[1]}).scalar_one() == 0
        with engine.begin() as db:
            assert db.execute(text("SELECT count(*) FROM profiles")).scalar_one() == 0
        with pytest.raises(Exception):
            with engine.begin() as db:
                db.execute(text("SELECT set_config('app.user_id', :id, true)"), {"id": str(owners[0])})
                db.execute(text("UPDATE profiles SET display_name='forged' WHERE user_id=:id RETURNING user_id"), {"id": owners[1]}).scalar_one()
    finally:
        for owner in owners:
            with engine.begin() as db:
                db.execute(text("SELECT set_config('app.user_id', :id, true)"), {"id": str(owner)})
                db.execute(text("DELETE FROM users WHERE id=:id"), {"id": owner})
        engine.dispose()


def test_native_handoff_is_bound_to_pkce_owner_and_single_use(monkeypatch):
    from types import SimpleNamespace
    from cryptography.fernet import Fernet
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.auth import Principal
    from app.routes import auth as routes
    engine = create_engine(URL)
    sessions = sessionmaker(bind=engine)
    issuer, subject = "https://integration.test", f"handoff-{uuid.uuid4()}"
    with engine.begin() as db:
        owner = db.execute(text("SELECT auth_resolve_user(:issuer,:subject)"), {"issuer": issuer, "subject": subject}).scalar_one()
    @contextmanager
    def scoped(user_id):
        with sessions.begin() as db:
            db.execute(text("SELECT set_config('app.user_id',:id,true)"), {"id": str(user_id)})
            yield db
    monkeypatch.setattr(routes, "user_session", scoped)
    cipher_key = Fernet.generate_key().decode()
    monkeypatch.setattr(routes, "get_settings", lambda: SimpleNamespace(neon_auth_handoff_key=cipher_key))
    claims = {"sub": subject, "iss": issuer, "exp": int(datetime.now(timezone.utc).timestamp()) + 900}
    monkeypatch.setattr(routes, "verify_neon_token", lambda token: claims)
    verifier = "a" * 64
    try:
        code = routes.create_handoff(routes.HandoffInput(challenge=routes.pkce_challenge(verifier)),
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="verified-test-jwt"), Principal(owner, subject))["code"]
        with pytest.raises(HTTPException):
            routes.exchange_handoff(routes.ExchangeInput(code=code, verifier="b" * 64))
        wrong_owner = str(uuid.uuid4()) + "." + code.split(".", 1)[1]
        with pytest.raises(HTTPException):
            routes.exchange_handoff(routes.ExchangeInput(code=wrong_owner, verifier=verifier))
        assert routes.exchange_handoff(routes.ExchangeInput(code=code, verifier=verifier))["token"] == "verified-test-jwt"
        with pytest.raises(HTTPException):
            routes.exchange_handoff(routes.ExchangeInput(code=code, verifier=verifier))
    finally:
        with scoped(owner) as db:
            db.execute(text("DELETE FROM users WHERE id=:id"), {"id": owner})
        engine.dispose()
