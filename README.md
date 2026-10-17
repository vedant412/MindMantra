# MindMitra

FastAPI/SQLAlchemy backend and Expo React Native mobile app for wellness activities
and Vani voice conversations.

The application now starts with a **fresh Neon PostgreSQL + pgvector database**.
Existing SQLite and audio files are preserved and are not imported or opened by
the new backend. Schema changes run through Alembic, never startup `create_all`.

Start with the [quick-start guide](QUICKSTART.md) for Windows setup, Neon/Firebase
configuration, native mobile builds and optional voice/memory setup. Use the
[deployment guide](ai-backend/docs/DEPLOYMENT.md) for production operation,
retention, deletion and rollout checks.

Features include Firebase-token backend authentication, tenant RLS, normalized
conversations/messages, SQL activity/game history and improvement, opt-in narrative
memory, configurable 768-dimensional embeddings, retention/deletion, and a Gemini
Live WebSocket proxy. Mobile voice uses native PCM capture/playback; typed chat is
the fallback. Saved conversations and semantic memory default off.

## Quick start

1. Create a new Neon database and a Firebase project with email/password sign-in.
2. Configure [backend secrets](ai-backend/.env.example), install dependencies,
   run Alembic and apply the runtime-role grants.
3. Start FastAPI using the non-owner runtime database URL.
4. Configure [public mobile settings](mindmitra-app/.env.example), run `npm ci`,
   then `npm run android` or, on macOS, `npm run ios`.

Follow [QUICKSTART.md](QUICKSTART.md) for the commands and account setup.
Streaming audio and SQLCipher require a native development build; Expo Go does
not support the complete app. Use a reachable HTTPS/WSS backend URL on mobile.

Never put database URLs, Firebase Admin credentials, Gemini keys or embedding keys
in mobile configuration. Live voice and RAG default off until configured. Users
separately opt in to transcript storage and semantic memory in Profile.

## Repository map

| Location | Purpose |
| --- | --- |
| `ai-backend/app` | Authenticated API, SQL models, Live proxy, retrieval and maintenance |
| `ai-backend/alembic` | Production PostgreSQL migrations |
| `ai-backend/deploy` | Runtime-role permissions |
| `mindmitra-app/src` | Mobile UI, authentication, native audio and encrypted local queues |
| `QUICKSTART.md` | First-run setup and troubleshooting |
| `ai-backend/docs/DEPLOYMENT.md` | Production configuration and operations |

## Validation

Run backend tests with `python -m pytest -q`. The PostgreSQL integration suite
requires `TEST_DATABASE_URL` to an isolated, migrated pgvector database using the
runtime role. GitHub Actions provisions this test environment.

This project provides wellness measurements, not clinical diagnosis.
