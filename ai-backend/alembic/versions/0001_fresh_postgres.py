"""Fresh PostgreSQL schema, tenant policies and verified-subject provisioning.

DDL is frozen in 0001_schema.sql; this revision never imports mutable ORM models.
"""
from pathlib import Path
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

TABLES = ("profiles", "conversations", "messages", "activity_events", "game_sessions", "daily_metrics", "memory_facts", "rag_documents", "rag_chunks", "background_jobs", "live_tickets", "screen_time_snapshots", "location_points", "visited_places")

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    for statement in Path(__file__).with_name("0001_schema.sql").read_text().split(";\n"):
        if statement.strip():
            op.execute(statement)
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY owner_access ON users USING (id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.user_id', true), '')::uuid)")
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY owner_access ON {table} USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid)")
    # Only the backend calls this after verifying a Firebase ID token. The owner can
    # resolve users through RLS, but tenant tables still require transaction context.
    op.execute("""
    CREATE FUNCTION auth_resolve_user(subject text, default_timezone text DEFAULT 'Asia/Kolkata', default_retention integer DEFAULT 90) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    DECLARE owner_id uuid; account_status text;
    BEGIN
      IF length(subject) < 1 OR length(subject) > 128 THEN RAISE EXCEPTION 'Invalid subject'; END IF;
      INSERT INTO public.users(id, firebase_uid, status, created_at)
        VALUES (gen_random_uuid(), subject, 'active', now())
        ON CONFLICT(firebase_uid) DO NOTHING;
      SELECT id, status INTO owner_id, account_status FROM public.users WHERE firebase_uid = subject;
      IF account_status <> 'active' THEN RETURN NULL; END IF;
      PERFORM set_config('app.user_id', owner_id::text, true);
      INSERT INTO public.profiles(user_id, preferred_language, timezone, memory_enabled,
        transcript_storage_enabled, retention_days, updated_at)
        VALUES(owner_id, 'en', default_timezone, false, false, default_retention, now())
        ON CONFLICT(user_id) DO NOTHING;
      RETURN owner_id;
    END $$
    """)
    op.execute("REVOKE ALL ON FUNCTION auth_resolve_user(text,text,integer) FROM PUBLIC")

def downgrade():
    raise RuntimeError("Destructive downgrade disabled. Restore to a separate database instead.")
