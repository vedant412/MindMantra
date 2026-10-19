"""Neon JWT identity plus a short, encrypted, single-use native browser handoff."""
import base64
import hashlib
import re
import secrets
from datetime import timedelta
from uuid import UUID
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from app.auth import current_user, Principal, bearer, verify_neon_token
from app.db.database import user_session
from app.models.domain import AuthHandoff, User, now
from app.settings import get_settings

router = APIRouter(prefix="/auth", tags=["authentication"])

class HandoffInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")

class ExchangeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=50, max_length=150)
    verifier: str = Field(pattern=r"^[A-Za-z0-9._~-]{43,128}$")

def handoff_cipher():
    key = get_settings().neon_auth_handoff_key
    if not key:
        raise HTTPException(503, "Native authentication handoff is not configured")
    try:
        return Fernet(key.encode())
    except ValueError:
        raise HTTPException(503, "Native authentication handoff is not configured") from None

def pkce_challenge(verifier):
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")

@router.get("/me")
def me(user: Principal = Depends(current_user)):
    return {"id": str(user.id), "subject": user.auth_subject}

@router.post("/native/handoff")
def create_handoff(payload: HandoffInput, credentials: HTTPAuthorizationCredentials = Depends(bearer), user: Principal = Depends(current_user)):
    cipher = handoff_cipher()
    code = str(user.id) + "." + secrets.token_urlsafe(32)
    with user_session(user.id) as db:
        # Serialize handoff creation per owner and bound outstanding one-minute records.
        db.scalar(select(User).where(User.id == user.id).with_for_update())
        rows = db.scalars(select(AuthHandoff).where(AuthHandoff.user_id == user.id).order_by(AuthHandoff.created_at.desc())).all()
        for old in rows:
            db.delete(old)
        db.add(AuthHandoff(user_id=user.id, code_hash=hashlib.sha256(code.encode()).hexdigest(), challenge=payload.challenge,
                           encrypted_token=cipher.encrypt(credentials.credentials.encode()).decode(), expires_at=now() + timedelta(seconds=60)))
    return {"code": code, "expires_in": 60}

@router.post("/native/exchange")
def exchange_handoff(payload: ExchangeInput):
    try:
        owner_id = UUID(payload.code.split(".", 1)[0])
    except ValueError:
        raise HTTPException(401, "Invalid or expired handoff") from None
    cipher = handoff_cipher()
    with user_session(owner_id) as db:
        row = db.scalar(select(AuthHandoff).where(AuthHandoff.user_id == owner_id,
            AuthHandoff.code_hash == hashlib.sha256(payload.code.encode()).hexdigest(), AuthHandoff.expires_at > now()).with_for_update())
        account = db.get(User, owner_id)
        if not row or not account or account.status != "active" or not secrets.compare_digest(row.challenge, pkce_challenge(payload.verifier)):
            raise HTTPException(401, "Invalid or expired handoff")
        try:
            token = cipher.decrypt(row.encrypted_token.encode(), ttl=60).decode()
        except InvalidToken:
            raise HTTPException(401, "Invalid or expired handoff") from None
        claims = verify_neon_token(token)
        if (claims["sub"], claims["iss"]) != (account.auth_subject, account.auth_issuer):
            raise HTTPException(401, "Invalid identity")
        db.delete(row)
    return {"token": token, "user": {"uid": claims["sub"], "email": claims.get("email", ""), "name": claims.get("name", "")}, "expires_at": claims["exp"]}
