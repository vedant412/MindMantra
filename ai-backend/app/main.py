import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.routes import process

# Create SQLite Database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Modular AI Backend - Cognitive Health",
    description="Minimal scalable backend foundation"
)

# Allow CORS for test UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# Register routes
app.include_router(process.router)

@app.get("/")
def root():
    return FileResponse("test_ui.html")
