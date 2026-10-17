from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.db.database import engine
from app.settings import get_settings
from app.routes.api import router as api_router
from app.routes.live import router as live_router

@asynccontextmanager
async def lifespan(app):
    with engine.connect() as connection:
        unsafe = connection.execute(text("SELECT rolsuper OR rolbypassrls OR EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users' AND tableowner=current_user) FROM pg_roles WHERE rolname=current_user")).scalar_one()
        if unsafe:
            raise RuntimeError("Runtime DATABASE_URL must use a non-owner, NOBYPASSRLS role")
        connection.execute(text("SELECT 1 FROM profiles LIMIT 0"))
    yield
    engine.dispose()

app = FastAPI(title="MindMitra", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_allowed_origins.split(','), allow_credentials=False, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.include_router(api_router)
app.include_router(live_router)

@app.get('/health')
def health():
    return {"ok": True}
