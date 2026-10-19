"""Verify Neon Auth JWTs; a client identity or provider access token is never trusted."""
import uuid
import logging
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientConnectionError
from sqlalchemy import text
from app.db.database import SessionLocal
from app.settings import get_settings

bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class Principal:
    id: uuid.UUID
    auth_subject: str

def auth_configuration():
    settings = get_settings()
    base = settings.neon_auth_base_url.rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(503, "Neon Auth is not configured")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    issuer = settings.neon_auth_issuer or origin
    audience = settings.neon_auth_audience or origin
    jwks_url = settings.neon_auth_jwks_url or base + "/.well-known/jwks.json"
    if urlsplit(jwks_url).scheme != "https":
        raise HTTPException(503, "Neon Auth requires an HTTPS JWKS endpoint")
    return issuer, audience, jwks_url

@lru_cache(maxsize=4)
def jwks_client(url):
    return PyJWKClient(url, cache_jwk_set=True, lifespan=300, timeout=5)

def verify_neon_token(token: str) -> dict:
    issuer, audience, url = auth_configuration()
    if len(token) > 16384:
        raise HTTPException(401, "Invalid authentication token")
    try:
        key = jwks_client(url).get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["EdDSA"], issuer=issuer, audience=audience,
                            leeway=15, options={"require": ["sub", "iss", "aud", "exp", "iat"]})
        if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 128:
            raise jwt.InvalidTokenError()
        if claims.get("banned") is True:
            raise jwt.InvalidTokenError()
        return claims
    except PyJWKClientConnectionError:
        raise HTTPException(503, "Authentication service is temporarily unavailable") from None
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as error:
        # Class names identify configuration/claim failures without logging tokens,
        # identity claims, credentials, or exception messages containing payloads.
        logger.warning("Neon JWT rejected (%s)", type(error).__name__)
        raise HTTPException(401, "Invalid or expired Neon Auth token") from None

def authenticate_token(token: str) -> Principal:
    claims = verify_neon_token(token)
    settings = get_settings()
    with SessionLocal.begin() as db:
        user_id = db.execute(text("SELECT auth_resolve_user(:issuer, :subject, :timezone, :retention)"),
            {"issuer": claims["iss"], "subject": claims["sub"], "timezone": settings.default_user_timezone, "retention": settings.transcript_retention_days}).scalar_one()
    if user_id is None:
        raise HTTPException(403, "Account data was deleted or account is disabled")
    return Principal(uuid.UUID(str(user_id)), claims["sub"])

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    if not credentials:
        raise HTTPException(401, "Authentication required")
    return authenticate_token(credentials.credentials)
