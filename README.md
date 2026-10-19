# MindMitra

FastAPI/SQLAlchemy backend and Expo React Native mobile app for wellness activities
and Vani voice conversations.

The application now starts with a **fresh Neon PostgreSQL + pgvector database**.
Existing SQLite and audio files are preserved and are not imported or opened by
the new backend. Schema changes run through Alembic, never startup `create_all`.

Start with the [quick-start guide](QUICKSTART.md) for Windows setup, Neon Auth/OAuth
configuration, native mobile builds and optional voice/memory setup. Use the
[deployment guide](ai-backend/docs/DEPLOYMENT.md) for production operation,
retention, deletion and rollout checks.

Features include Neon Auth JWT authentication with Google/GitHub OAuth, tenant RLS, normalized
conversations/messages, SQL activity/game history and improvement, opt-in narrative
memory, configurable 768-dimensional embeddings, retention/deletion, and a Gemini
Live WebSocket proxy. Mobile voice uses native PCM capture/playback; browser
voice uses Web Audio microphone capture and playback. Start once for a continuous
conversation; Vani greets you, listens between replies, and shows lookup progress
as a small visual status. It can suggest 2-3 relevant activities from the app.
Typed chat is the fallback. Saved conversations and semantic memory default off.

Activities includes all **9 games and 10 exercises**, with the formerly locked
entries available. Games have repeatable rounds and server-validated scores;
exercises provide guided sessions, pause/resume and actual active-time tracking.
Today's completion and points come from authenticated SQL queries. Browser saves
require a connection; native builds keep pending results in an encrypted queue.
Journal, gratitude and word-recall answers stay in screen memory and are discarded
when the activity closes.

## Quick start

1. Create a Neon database, enable Neon Auth, and configure email/password and OAuth.
2. Configure [backend secrets](ai-backend/.env.example), install dependencies,
   run Alembic and apply the runtime-role grants.
3. Start FastAPI using the non-owner runtime database URL.
4. Configure [public mobile settings](mindmitra-app/.env.example), run `npm ci`,
   then `npm run android` or, on macOS, `npm run ios`.

Follow [QUICKSTART.md](QUICKSTART.md) for commands, OAuth callbacks and the hosted
browser sign-in required for native apps. Browser preview: `npx expo start --web`.
Native JWT sessions currently require browser sign-in again after expiry (normally
15 minutes); browser sessions use managed Neon cookies.
Native streaming audio and SQLCipher require a development build; Expo Go does
not support the complete app. Browser voice works on HTTPS or localhost with
microphone permission and AudioWorklet support. Use a reachable HTTPS/WSS backend URL on mobile.

Never put database URLs, OAuth provider secrets and handoff keys, Gemini keys or embedding keys
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

Run `npm run typecheck`, `npm run test:auth`, `npm run test:voice` and
`npm run test:activities` from `mindmitra-app` to check client types, session
isolation, browser audio streaming and activity scoring/save behavior.

This project provides wellness measurements, not clinical diagnosis.
