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
   to `.env` in `ai-backend`, filling values privately. Set `NEON_AUTH_BASE_URL` to the same Neon Auth URL used by the client.
   For native sign-in, generate a server-only `NEON_AUTH_HANDOFF_KEY`.
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

`/docs` describes the current API. Every personal data REST route requires a signed Neon Auth
JWT. The native code exchange authenticates with a one-time PKCE proof. The backend ignores no claimed identity: request contracts forbid owner
fields. `/live/sessions` returns a random, single-use, 30-second ticket bound to
an owner/conversation. `/live/ws` consumes it in its first JSON frame; audio is
binary PCM16 mono 16 kHz, output audio events carry base64 PCM16 mono 24 kHz.
No long-lived provider keys enter mobile. There is no public audio-file route.

The legacy upload/Ollama/Whisper modules remain on disk for reference but are not
loaded by the production entry point. Talk now uses streaming voice or typed text;
the old multipart upload protocol is not exposed. No old cached responses are used.

## Authentication operations

Enable Neon Auth and configure OAuth providers/trusted origins as described in
[QUICKSTART.md](../../QUICKSTART.md). Google/GitHub client secrets live in Neon.
FastAPI accepts only EdDSA JWTs with validated signature, expiry, issued-at,
issuer, audience and subject. JWKS is cached for five minutes and refreshed for
an unknown key ID. The application maps `(issuer, subject)` to an internal UUID;
emails never select or link an owner. Neon manages its own auth tables separately
from application Alembic tables. Do not manage Neon's auth schema with Alembic.

Migration `0002` preserves prior identities under `legacy:firebase`; they remain
inaccessible to new Neon accounts rather than being linked by email. Back up before
upgrading and reapply runtime grants after migration. Old Firebase clients must
upgrade. A restored older backend requires a separate pre-upgrade database.

Native handoffs store only a hash of the single-use code and a Fernet-encrypted
JWT for at most 60 seconds. PKCE and state bind the handoff to the initiating app.
Row locks prevent replay; expired rows are purged by maintenance. Rotate the
handoff key to invalidate pending codes. All replicas must share the same key.
Rate-limit `/auth/native/*` at the proxy, cap JSON bodies, and avoid logging
Authorization headers, bodies, handoff codes or callback query strings. Host the
sign-in website with a restrictive referrer policy, no third-party analytics on
auth pages, and trusted HTTPS origins. Browser sessions require Neon cookies to
work in the user's browser; test third-party-cookie restrictions before rollout.
Native JWTs expire after Neon's configured lifetime (normally 15 minutes); native
renewal currently requires another browser sign-in. Background sync fails closed
when expired. Native sign-out clears SecureStore, but does not sign the browser
out. Browser sign-out does not revoke already-issued JWTs; app-account deletion
blocks the identity immediately. Manage external Neon account deletion separately
in Neon; application data deletion retains its disabled identity tombstone.

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

All nine games and ten exercises are enabled. Rewritten games submit version 2;
old version 1 records remain valid and separate in trend groups. The catalog uses
existing text/JSON columns and requires no further schema migration. Daily
activity progress comes from owner-scoped SQL using profile timezone and retention
filters. Distinct activities tried and points are separate from the wellness-v1
component, which retains its nine-session daily cap. Exercises save active time
only; journal, gratitude and recall answers never leave screen memory. Browser
saves require connectivity and retain failed results on screen for explicit retry;
native saves retain stable IDs in the encrypted per-user outbox.

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
data deletion leaves only a disabled Neon issuer/subject tombstone to prevent an old
token from recreating data; it does not delete the external Neon Auth identity.
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

1. Copy `mindmitra-app/.env.example`, using only public API, Neon Auth and hosted sign-in URLs. There are no database
   credentials, OAuth provider secrets, handoff keys or Gemini/embedding public keys.
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
when activities open. Background telemetry sync requires a restored, unexpired Neon session;
it fails closed when identity is unavailable. Cumulative snapshots are collected
from the start of the current day; analytics selects the latest snapshot, never sums
overlapping snapshots. The native Android ScreenTimeModule is still required for
real usage data; the repository does not provide its implementation.

## Browser voice

Expo resolves `liveVoice.web.ts` in browsers and the native implementation on
mobile. Browser voice uses `getUserMedia` and a locally created AudioWorklet to
mix/resample microphone audio into 100 ms mono PCM16 little-endian frames at
16 kHz. It uses the same authenticated, one-use backend ticket and WebSocket
protocol as native voice. Assistant audio is played from 24 kHz PCM buffers.
Audio recordings and provider keys are never stored in the browser.

Serve over HTTPS (localhost works for development). Allow microphone access and
the worklet module in your site's CSP. Embedded browsers may block microphone
access; test the app directly in Chrome, Edge and Safari. Keep the tab visible:
hiding/leaving it or switching accounts releases microphone tracks and closes
the session. Both capture and playback queues are bounded and fail closed on
slow networks. Device echo cancellation remains browser/device-dependent.

Live sessions start with one brief greeting. Server-side voice activity detection
handles subsequent turns and barge-in; a model turn ending does not stop capture
or cancel pending tools. User cancellation, account/consent changes, leaving the
page, failures and the configured session limit still end sessions. Database
ownership checks run independently of the microphone forwarding task, and SQL
lookups/message persistence run in worker threads. Numeric calculations remain
in the existing SQL services.

SQL and narrative tool calls emit owner-bound `lookup_status` frames. The client
shows a small Getting information status, like Connecting. No speech synthesis,
spoken progress announcement, or extra answer-audio queue is used. The model is
instructed not to narrate retrieval/tool processing. Normal answer audio and
microphone capture continue. Lookup tasks have a 20-second timeout and are
cancelled on interruption, provider cancellation or session shutdown, rather
than on ordinary response boundaries. Tool responses use WHEN_IDLE scheduling.

The shared prompt asks Vani to suggest 2-3 relevant activities after understanding
the user's concern or when asked for next steps. Its catalog includes only the
currently available 19 app activities and makes no
medical or score-improvement promises. It does not repeat suggestions every turn.

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
