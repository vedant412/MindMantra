# Fresh Neon + Gemini deployment

For first-run commands and mobile setup, start with the
[quick-start guide](../../QUICKSTART.md).

The production application no longer opens SQLite. `memory.db`, existing audio,
and old device databases are left untouched; there is no import or destructive reset.

## Server

1. Create a new Neon PostgreSQL database. Use a direct owner URL for migrations and
   a pooled **non-owner, NOBYPASSRLS** login for the API. Never use the owner login
   in the mobile app or API process. Put server secrets in deployment secret storage.
2. Install Python 3.12 dependencies from `requirements.txt`. Copy `.env.example`
   to `.env` in `ai-backend`, filling values privately. Firebase Admin needs a
   service-account mount/ADC and the same project ID used by mobile Firebase auth.
3. Run `alembic upgrade head` with `DATABASE_MIGRATION_URL` pointing to the **new**
   direct database. Review and run `deploy/runtime-role.sql` as owner. Give
   `app_runtime` its password through Neon. Set `DATABASE_URL` to its pooled URL.
4. Start `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Terminate TLS at the
   hosting proxy. Preserve WebSocket upgrades and enforce a 1 MB request/frame
   ceiling and connection/IP rate limits. Uvicorn can use `--ws-max-size 1048576`.
5. After validating model access, set `LIVE_ENABLED=true`. Default Live model is
   `gemini-3.8-live`; change it only after verifying the project's model availability.
   The text fallback uses configurable `GEMINI_TEXT_MODEL`.
6. Set `RAG_ENABLED=true` only after providing an embedding key and validating the
   retrieval fixtures in English, Hindi and Marathi. The initial schema uses exact
   cosine search, appropriate for small per-user corpora. Add an Alembic HNSW index
   only after testing filtered recall and query plans at production volume.

`/docs` describes the current API. Every personal REST route requires a Firebase
ID token. The backend ignores no claimed identity: request contracts forbid owner
fields. `/live/sessions` returns a random, single-use, 30-second ticket bound to
an owner/conversation. `/live/ws` consumes it in its first JSON frame; audio is
binary PCM16 mono 16 kHz, output audio events carry base64 PCM16 mono 24 kHz.
No long-lived provider keys enter mobile. There is no public audio-file route.

The legacy upload/Ollama/Whisper modules remain on disk for reference but are not
loaded by the production entry point. Talk now uses streaming voice or typed text;
the old multipart upload protocol is not exposed. No old cached responses are used.

## Memory, calculation and retention

New profiles default to **no saved transcripts and no semantic memory**. Profile
offers separate consent switches, 30/90/365-day transcript retention, forget-memory,
and deletion. Disabling transcript storage deletes saved messages and semantic
documents. Disabling memory removes derived documents/jobs; explicit facts can be
removed with forget-memory. There is no recording-to-file path in streaming audio.

Numeric game scores are recomputed from bounded round results by backend code,
then stored in SQL. This verifies arithmetic, not physical authenticity of a mobile
tap. Trends use SQL aggregates grouped by game/version/difficulty. At least three
results per comparison window are required. Daily score components follow the
versioned deterministic service; missing values remain null. No new Vani score or
composite is invented from Gemini transcripts. A validated replacement for Whisper
confidence would require a separate scoring version and clinical/product review.

Run `python -m app.services.maintenance` at least every minute using a **separate
maintenance process** whose `DATABASE_URL` is the direct table-owner credential.
Do not start the API with this credential. The worker enumerates users, sets a
transaction-local owner per operation, purges expired rows and processes a bounded
summary job. Multiple workers use SKIP LOCKED and leases; scale polling based on
queue age. Jobs retry five times with backoff and then remain failed for inspection.
Do not log transcript contents or provider exception payloads when investigating.

Only the latest eight bounded messages are summarized; full history is never sent.
Summaries and selected meaningful user excerpts are embedded as narrative chunks; raw scores/location trails are not.
Context is capped at 6,000 UTF-8 bytes and contains bounded recent messages,
relevant confirmed facts, SQL measurements and up to four narrative chunks.
Retrieval filters owner, embedding identity, dates and expiry in SQL.

Default transcript retention is 90 days; raw location 30 days; structured data 365
days. Expired rows are excluded from retrieval/analytics before the purge runs.
Deletion cascades conversations, messages, vectors and jobs immediately. Account
data deletion leaves only a disabled Firebase-subject tombstone to prevent an old
token from recreating data; it does not delete the external Firebase identity.
Active Live sessions check account/conversation validity periodically.

Configure Neon backup retention explicitly (target: no more than 30 days), restrict
backup access, and reapply account tombstones/deletion requests after a restore
before serving traffic. Application deletion cannot erase retained provider backups.
Review Gemini/embedding provider data-use and retention settings for sensitive data
before enabling production voice. Do not enable provider request-content logging.

## Embedding contract

Default: Google `gemini-embedding-001`, 768 dimensions, normalized cosine vectors,
`RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT` task modes. Google's supported-language list
includes English, Hindi and Marathi:
https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/text-embeddings-api#supported_text_languages

`EMBEDDING_PROVIDER=openai-compatible` supports a private HTTPS `/embeddings`
endpoint with the configured model. Validate its language support before selecting
it. Models sharing 768 dimensions still have incompatible embedding spaces. Change
`EMBEDDING_PROFILE`, rebuild in parallel and evaluate before switching. A dimension
change requires an Alembic schema migration; startup rejects other dimensions.
The worker rejects changes to an existing profile's provider/model/dimension tuple.

## Mobile

1. Copy `mindmitra-app/.env.example`, using only the public backend URL and Firebase
   client configuration. There are **no** Neon/Gemini/embedding public variables.
2. Run `npm ci`, then make an Expo development build (`npx expo run:android` or
   `npx expo run:ios`). Native audio and SQLCipher are not available in Expo Go.
   Text mode can render in Expo Go; encrypted device activity queues need the build.
3. Use HTTPS/WSS in release. Android cleartext traffic is disabled. For development,
   prefer a trusted HTTPS tunnel instead of opening release cleartext permissions.
4. Test microphone permissions, Hindi/Marathi/code switching, Bluetooth disconnects,
   incoming calls, barge-in, backgrounding, slow networks and logout on real devices.
   PCM playback has a bounded jitter queue; OS/device echo behavior requires device QA.

Fresh per-user SQLCipher databases preserve legacy local databases untouched. Local
activity outboxes use stable event IDs and retry on app/tracking initialization and
when activities open. Background telemetry sync requires a restored Firebase user;
it fails closed when identity is unavailable. Cumulative snapshots are collected
from the start of the current day; analytics selects the latest snapshot, never sums
overlapping snapshots. The native Android ScreenTimeModule is still required for
real usage data; the repository does not provide its implementation.

## Verification and rollout

Run `pytest -q` and `npm run typecheck`. `TEST_DATABASE_URL` must point to an isolated,
migrated pgvector database using the runtime role, never production. The GitHub
workflow provisions this environment and checks RLS and connection-context reset.
Without that URL, PostgreSQL integration tests are explicitly skipped.

Roll out: auth/schema -> structured activities -> multilingual RAG evaluation ->
Live pilot -> wider release. Gate RAG on reviewed recall@5 fixtures in all three
languages, zero cross-owner retrieval, expiry/deletion tests and embedding identity
checks. Gate Live on real-device interruptions/transcripts and p95 latency measured
on a defined network; target first audio under two seconds. Feature flags default
off and allow disabling Live/RAG independently. Old clients must update because
the unauthenticated APIs and upload contract have been retired.

There is no automatic destructive Alembic downgrade. Restore to a separate database
or roll application code forward; never switch to the old SQLite file after accepting
new PostgreSQL writes. Back up the new production database before future migrations.
