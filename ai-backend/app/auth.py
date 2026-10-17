import uuid
from dataclasses import dataclass
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from app.db.database import SessionLocal
from app.settings import get_settings

bearer = HTTPBearer(auto_error=False)

@dataclass(frozen=True)
class Principal:
    id: uuid.UUID
    firebase_uid: str

def authenticate_token(token: str) -> Principal:
    import firebase_admin
    from firebase_admin import auth
    if not get_settings().firebase_project_id:
        raise HTTPException(503, "Firebase authentication is not configured")
    try:
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(options={"projectId": get_settings().firebase_project_id})
        claims = auth.verify_id_token(token, check_revoked=True)
    except Exception:
        raise HTTPException(401, "Invalid or expired authentication token") from None
    with SessionLocal.begin() as db:
        settings = get_settings()
        user_id = db.execute(text("SELECT auth_resolve_user(:subject, :timezone, :retention)"), {"subject": claims["uid"], "timezone": settings.default_user_timezone, "retention": settings.transcript_retention_days}).scalar_one()
    if user_id is None:
        raise HTTPException(403, "Account data was deleted or account is disabled")
    return Principal(uuid.UUID(str(user_id)), claims["uid"])

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    if not credentials:
        raise HTTPException(401, "Authentication required")
    return authenticate_token(credentials.credentials)
