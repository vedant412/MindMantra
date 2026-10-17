-- Run as the schema owner after Alembic. Create/set a password for the login
-- app_runtime through Neon, never by committing it to this file.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
REVOKE ALL ON alembic_version FROM app_runtime;
REVOKE INSERT, UPDATE, DELETE ON embedding_profiles FROM app_runtime;
GRANT EXECUTE ON FUNCTION auth_resolve_user(text,text,integer) TO app_runtime;
-- Do not grant the owner role to app_runtime. Reapply reviewed grants after migrations.
