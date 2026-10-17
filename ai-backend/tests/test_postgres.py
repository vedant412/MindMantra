"""Requires a separate migrated test database. Never set this to production."""
import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine, text

URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL is not configured")

def test_rls_isolation_and_pool_context_reset():
    engine = create_engine(URL, pool_size=1, max_overflow=0)
    owners = [uuid.uuid4(), uuid.uuid4()]
    # URL must use the runtime role; provisioning uses the verified-subject function.
    with engine.begin() as db:
        owners = [db.execute(text("SELECT auth_resolve_user(:subject)"), {"subject": f"integration-{uuid.uuid4()}"}).scalar_one() for _ in range(2)]
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
