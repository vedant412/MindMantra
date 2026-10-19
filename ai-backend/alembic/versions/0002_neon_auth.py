"""Provider-scoped Neon identities and single-use native PKCE handoffs.

Existing Firebase identities remain isolated as legacy records, never linked by email.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column("users", "firebase_uid", new_column_name="auth_subject")
    op.add_column("users", sa.Column("auth_issuer", sa.Text(), nullable=False, server_default="legacy:firebase"))
    op.alter_column("users", "auth_issuer", server_default=None)
    # Discover the old unnamed single-column unique constraint rather than
    # depending on a database-generated constraint name.
    op.execute("""DO $$ DECLARE old_constraint text; BEGIN
      FOR old_constraint IN SELECT c.conname FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
        WHERE c.conrelid='public.users'::regclass AND c.contype='u'
          AND array_length(c.conkey,1)=1 AND a.attname='auth_subject'
      LOOP EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I',old_constraint); END LOOP;
    END $$""")
    op.create_unique_constraint("uq_users_auth_identity", "users", ["auth_issuer", "auth_subject"])
    op.execute("DROP FUNCTION auth_resolve_user(text,text,integer)")
    op.execute("""CREATE FUNCTION auth_resolve_user(identity_issuer text, subject text,
      default_timezone text DEFAULT 'Asia/Kolkata', default_retention integer DEFAULT 90) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
    DECLARE owner_id uuid; account_status text;
    BEGIN
      IF length(subject)<1 OR length(subject)>128 OR length(identity_issuer)<1 THEN
        RAISE EXCEPTION 'Invalid identity'; END IF;
      INSERT INTO public.users(id,auth_issuer,auth_subject,status,created_at)
        VALUES(gen_random_uuid(),identity_issuer,subject,'active',now())
        ON CONFLICT(auth_issuer,auth_subject) DO NOTHING;
      SELECT id,status INTO owner_id,account_status FROM public.users
        WHERE auth_issuer=identity_issuer AND auth_subject=subject;
      IF account_status<>'active' THEN RETURN NULL; END IF;
      PERFORM set_config('app.user_id',owner_id::text,true);
      INSERT INTO public.profiles(user_id,preferred_language,timezone,memory_enabled,
        transcript_storage_enabled,retention_days,updated_at)
        VALUES(owner_id,'en',default_timezone,false,false,default_retention,now())
        ON CONFLICT(user_id) DO NOTHING;
      RETURN owner_id;
    END $$""")
    op.execute("REVOKE ALL ON FUNCTION auth_resolve_user(text,text,text,integer) FROM PUBLIC")
    op.create_table("auth_handoffs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("challenge", sa.String(43), nullable=False),
        sa.Column("encrypted_token", sa.Text(), nullable=False))
    op.create_index("ix_auth_handoffs_user_id", "auth_handoffs", ["user_id"])
    op.create_index("ix_auth_handoffs_expires_at", "auth_handoffs", ["expires_at"])
    op.execute("ALTER TABLE auth_handoffs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE auth_handoffs FORCE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY owner_access ON auth_handoffs USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK (user_id=nullif(current_setting('app.user_id',true),'')::uuid)")

def downgrade():
    raise RuntimeError("Restore to a separate database; identity downgrades are disabled")
