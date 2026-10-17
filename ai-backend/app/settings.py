from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://localhost/mindmitra"
    database_migration_url: str | None = None
    firebase_project_id: str = ""
    gemini_api_key: str = ""
    gemini_live_model: str = "gemini-3.8-live"
    gemini_text_model: str = "gemini-2.5-flash"
    live_enabled: bool = False
    rag_enabled: bool = False
    embedding_provider: str = "google"
    embedding_model: str = "gemini-embedding-001"
    embedding_api_key: str = ""
    embedding_base_url: str = ""
    embedding_dimensions: int = 768
    embedding_profile: str = "google-gemini-embedding-001-768-v1"
    transcript_retention_days: int = 90
    location_retention_days: int = 30
    structured_data_retention_days: int = 365
    live_max_session_seconds: int = 900
    cors_allowed_origins: str = "http://localhost:8081"
    default_user_timezone: str = "Asia/Kolkata"

    @model_validator(mode="after")
    def validate_settings(self):
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("Fresh PostgreSQL required; SQLite is never opened")
        if self.embedding_dimensions != 768:
            raise ValueError("Schema uses vector(768); migrate before changing dimensions")
        if self.embedding_provider not in {"google", "openai-compatible"}:
            raise ValueError("Unsupported embedding provider")
        from sqlalchemy.engine import make_url
        if self.app_env == "production" and make_url(self.database_url).query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
            raise ValueError("Production DATABASE_URL must require TLS")
        if min(self.transcript_retention_days, self.location_retention_days, self.structured_data_retention_days) < 1:
            raise ValueError("Retention must be positive")
        if self.transcript_retention_days > 365:
            raise ValueError("Transcript retention cannot exceed 365 days")
        from zoneinfo import ZoneInfo
        ZoneInfo(self.default_user_timezone)
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
