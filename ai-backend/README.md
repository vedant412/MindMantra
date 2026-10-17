# MindMitra backend

The active production entry point is `app.main:app`. It uses a fresh PostgreSQL
schema, Firebase bearer authentication, row-level tenant isolation and Alembic.
It does not open or import the previous `memory.db`.

Start with the [repository quick-start guide](../QUICKSTART.md) for commands,
Neon/Firebase setup and connecting mobile. See the
[deployment guide](docs/DEPLOYMENT.md) for security, retention, model configuration
and production operations.

Copy `.env.example` to a private `.env`, install `requirements-dev.txt`, provision
a new Neon database, run `alembic upgrade head` and apply `deploy/runtime-role.sql`.
The API must run with a non-owner, NOBYPASSRLS role. Owner credentials are reserved
for migrations and the scheduled maintenance worker.

Gemini Live and RAG default off until configured and evaluated. Raw audio is never
saved. Users opt in to transcript storage and semantic memory from Profile.

Legacy Ollama/Whisper/Edge-TTS modules and `test_ui.html` remain historical sources;
they are not imported or publicly served by the new application.
