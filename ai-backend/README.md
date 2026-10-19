# MindMitra backend

The active production entry point is `app.main:app`. It uses a fresh PostgreSQL
schema, Neon Auth JWT bearer authentication, row-level tenant isolation and Alembic.
It does not open or import the previous `memory.db`.

Start with the [repository quick-start guide](../QUICKSTART.md) for commands,
Neon Auth/OAuth setup and connecting mobile. See the
[deployment guide](docs/DEPLOYMENT.md) for security, retention, model configuration
and production operations.

Copy `.env.example` to a private `.env`, install `requirements-dev.txt`, provision
a new Neon database, run `alembic upgrade head` and apply `deploy/runtime-role.sql`.
The API must run with a non-owner, NOBYPASSRLS role. Owner credentials are reserved
for migrations and the scheduled maintenance worker.

Gemini Live and RAG default off until configured and evaluated. Raw audio is never
saved. Users opt in to transcript storage and semantic memory from Profile.

The activity API accepts nine game codes and ten exercise codes. Game scores are
recomputed from round results; rewritten games use version 2 so SQL improvement
queries keep earlier results separate. Authenticated `GET /activities/progress`
returns the user's daily completion IDs and points in their profile timezone.
Exercise payloads contain completion and active duration only, never journal or
recall text. The existing wellness-v1 activity cap remains nine sessions per day.

Legacy Ollama/Whisper/Edge-TTS modules and `test_ui.html` remain historical sources;
they are not imported or publicly served by the new application.
