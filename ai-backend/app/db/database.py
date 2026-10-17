from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.settings import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_timeout=10)
SessionLocal = sessionmaker(expire_on_commit=False, bind=engine)

Base = declarative_base()

@contextmanager
def user_session(user_id):
    """Transaction-local ownership is safe with Neon's transaction pooler."""
    with SessionLocal.begin() as db:
        db.execute(text("SELECT set_config('app.user_id', :owner, true)"), {"owner": str(user_id)})
        yield db

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
