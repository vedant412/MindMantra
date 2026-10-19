"""Signature verification and native handoff security, without external credentials."""
import time
from types import SimpleNamespace
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import HTTPException
from app import auth
from app.routes.auth import pkce_challenge, HandoffInput, ExchangeInput
from app.settings import Settings

ISSUER = "https://example.neonauth.aws.neon.tech"

def test_neon_connection_url_selects_psycopg_driver():
    settings = Settings(_env_file=None, database_url="postgresql://user:password@localhost/app")
    assert settings.database_url == "postgresql+psycopg://user:password@localhost/app"

@pytest.fixture
def signing(monkeypatch):
    key = Ed25519PrivateKey.generate()
    monkeypatch.setattr(auth, "get_settings", lambda: SimpleNamespace(
        neon_auth_base_url=ISSUER + "/neondb/auth", neon_auth_issuer="",
        neon_auth_audience="", neon_auth_jwks_url=""))
    monkeypatch.setattr(auth, "jwks_client", lambda url: SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=key.public_key())))
    def token(**changes):
        claims = {"iss": ISSUER, "aud": ISSUER, "sub": "neon-user-one",
                  "iat": int(time.time()), "exp": int(time.time()) + 900}
        claims.update(changes)
        return jwt.encode(claims, key, algorithm="EdDSA", headers={"kid": "test"})
    return token

def test_valid_neon_identity_and_metadata(signing):
    assert auth.auth_configuration() == (ISSUER, ISSUER, ISSUER + "/neondb/auth/.well-known/jwks.json")
    assert auth.verify_neon_token(signing())["sub"] == "neon-user-one"

@pytest.mark.parametrize("changes", [
    {"iss": "https://other.example"}, {"aud": "other-app"}, {"exp": 1},
    {"iat": int(time.time()) + 3600}, {"sub": ""}, {"sub": "x" * 129}, {"banned": True},
])
def test_reject_invalid_claims(signing, changes):
    with pytest.raises(HTTPException) as error:
        auth.verify_neon_token(signing(**changes))
    assert error.value.status_code == 401

def test_reject_wrong_signature(signing):
    token = signing()
    forged = jwt.encode(jwt.decode(token, options={"verify_signature": False}), Ed25519PrivateKey.generate(), algorithm="EdDSA")
    with pytest.raises(HTTPException) as error:
        auth.verify_neon_token(forged)
    assert error.value.status_code == 401

def test_reject_algorithm_confusion(signing):
    token = jwt.encode({"sub": "victim"}, "attacker" * 8, algorithm="HS256")
    with pytest.raises(HTTPException) as error:
        auth.verify_neon_token(token)
    assert error.value.status_code == 401

def test_missing_claim_and_oversized_token(signing):
    with pytest.raises(HTTPException):
        auth.verify_neon_token(signing(iat=None))
    with pytest.raises(HTTPException):
        auth.verify_neon_token("x" * 16385)

def test_pkce_rfc7636_vector_and_input_bounds():
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    assert pkce_challenge(verifier) == challenge
    HandoffInput(challenge=challenge)
    with pytest.raises(ValueError):
        HandoffInput(challenge=challenge, user_id="forged")
    with pytest.raises(ValueError):
        ExchangeInput(code="x" * 80, verifier="short")

def test_jwks_outage_does_not_bypass_auth(signing, monkeypatch):
    def unavailable(token):
        raise jwt.PyJWKClientConnectionError("offline")
    monkeypatch.setattr(auth, "jwks_client", lambda url: SimpleNamespace(get_signing_key_from_jwt=unavailable))
    with pytest.raises(HTTPException) as error:
        auth.verify_neon_token(signing())
    assert error.value.status_code == 503
