# MindMitra quick start

Start the backend with a **new Neon PostgreSQL database**, then build the mobile
app. Commands below use Windows PowerShell from the repository root. Existing
SQLite databases and audio files are left untouched; no data import is required.

## Prerequisites

- Python 3.12 and Node.js/npm.
- A new Neon PostgreSQL database.
- Neon Auth enabled on the same Neon branch, with email/password sign-in.
- Google and/or GitHub OAuth configured in the Neon Auth console (step 4).
- A server-side Gemini API key for typed chat and Live voice.
- An Android development toolchain and device/emulator. Building iOS requires
  macOS and Xcode.

Native streaming audio and encrypted local activity storage require a native
development build. Browser voice uses Web Audio on HTTPS or localhost, with
microphone permission. Expo Go cannot test the complete app.

## 1. Install and configure the backend

```powershell
Set-Location ai-backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `ai-backend/.env` privately:

| Variable | Value |
| --- | --- |
| `DATABASE_MIGRATION_URL` | The new database's **direct owner** connection URL |
| `DATABASE_URL` | Its **pooled `app_runtime`** connection URL; configure this role in step 2 |
| `NEON_AUTH_BASE_URL` | The Auth URL copied from the Neon branch console |
| `NEON_AUTH_HANDOFF_KEY` | Server-only Fernet key for native sign-in; generate below |
| `GEMINI_API_KEY` | Your server-side Gemini key |
| `LIVE_ENABLED` | Leave `false` initially |
| `RAG_ENABLED` | Leave `false` initially |

Both database URLs may use Neon's `postgresql://` format or
`postgresql+psycopg://` (the backend selects psycopg), and must include
`sslmode=require` or a stricter TLS mode. Use Neon's connection details for the
selected database and role; URL-encode special characters in passwords.

Generate the native handoff key directly into the backend `.env` without
printing it (run once, from `ai-backend`):

```powershell
.\.venv\Scripts\python.exe -c "from pathlib import Path; from cryptography.fernet import Fernet; p=Path('.env'); s=p.read_text(); assert not any(x.startswith('NEON_AUTH_HANDOFF_KEY=') and x.split('=',1)[1].strip() for x in s.splitlines()), 'Key already configured'; s='\n'.join(x for x in s.splitlines() if not x.startswith('NEON_AUTH_HANDOFF_KEY=')); p.write_text(s+'\nNEON_AUTH_HANDOFF_KEY='+Fernet.generate_key().decode()+'\n')"
```

Do not share or commit the generated key.
Database URLs, handoff keys, Gemini keys and embedding keys must never appear
in mobile configuration or `EXPO_PUBLIC_` variables.

`NEON_AUTH_BASE_URL`, JWKS URL, issuer and audience are public identifiers.
Leave their optional overrides blank unless your Neon JWT configuration differs.
The defaults use the Auth URL's origin for issuer/audience and append
`/.well-known/jwks.json` to the full Auth URL.

## 2. Create the PostgreSQL schema and runtime role

From `ai-backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Alembic uses `DATABASE_MIGRATION_URL` to create tables, pgvector and tenant policies.
It does not open SQLite.

In Neon's SQL Editor, select the **same new database**, connect as the schema
owner and execute [deploy/runtime-role.sql](ai-backend/deploy/runtime-role.sql).
Set a password for `app_runtime` securely, then finish its pooled `DATABASE_URL`
in the backend `.env`.

The runtime login must be a non-owner with `NOBYPASSRLS`, without membership in
the owner role. The API checks this at startup. Reserve the owner credential for
migrations and maintenance.

Verify in the SQL Editor:

```sql
SELECT version_num FROM alembic_version;
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

## 3. Start the backend

```powershell
# Still in ai-backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

In another terminal:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Expect `ok: true`. Open [API documentation](http://localhost:8000/docs) to inspect
the routes. Personal API calls require a signed Neon Auth JWT; an unauthenticated
`401` is expected.

For mobile, provide a reachable **HTTPS URL** forwarding to this backend with
WebSocket upgrades enabled. `localhost` on a phone means the phone itself.
Android cleartext traffic is disabled. Expo's Metro tunnel does not automatically
expose FastAPI; the backend needs its own HTTPS connection.

## 4. Configure and build mobile

Open a new terminal from the repository root:

```powershell
Set-Location mindmitra-app
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `mindmitra-app/.env`:

- Set `EXPO_PUBLIC_API_BASE_URL` to your reachable HTTPS backend URL, without
  `/docs` or `/live/ws` appended.
- Set `EXPO_PUBLIC_NEON_AUTH_URL` to the same Auth URL as backend `NEON_AUTH_BASE_URL`.
- Set `EXPO_PUBLIC_AUTH_WEB_URL` to the hosted HTTPS copy of this Expo web app.
  Native sign-in opens it in the system browser. For browser-only local preview,
  use `http://localhost:8081` and add that origin to both Neon trusted origins and
  backend `CORS_ALLOWED_ORIGINS`. Native devices need a reachable HTTPS website.

Then run:

```powershell
npm run typecheck
npm run android
```

On macOS, use `npm run ios` instead. Rebuild after native dependency/plugin changes.
Restart Metro after public environment changes. For an existing development build,
you can start Metro separately with `npx expo start --dev-client`.

For browser preview, run `npx expo start --web --localhost --port 8081`.
Browser sign-in, typed chat and streaming voice can be tested here. Allow the
microphone and keep the tab visible during voice sessions. Browser capture uses
an AudioWorklet, resamples to 16 kHz PCM16, and plays responses at 24 kHz. No audio
recordings are saved. SQLCipher activity queues require a native development build.

In **Neon Console → Auth**, enable email/password and configure Google/GitHub
providers. Put OAuth client IDs/secrets in Neon only. In each provider's console,
register the redirect URI `<NEON_AUTH_BASE_URL>/callback/google` or
`<NEON_AUTH_BASE_URL>/callback/github`. Register your hosted app's origin (and
`http://localhost:8081` for development) as a Neon Auth trusted origin. The
provider redirect URI is different from the app callback URL. The SDK supplies
the current app URL as `callbackURL`, preserving native handoff parameters.
See [Neon's OAuth setup](https://neon.com/docs/auth/guides/setup-oauth).

Deploy this web app at `EXPO_PUBLIC_AUTH_WEB_URL` for native sign-in. Build the
native app again to register `mindmitra://auth/callback`. Expo Go cannot receive
this app-specific callback reliably. The hosted page requires explicit approval
to continue as the displayed account. The native app verifies a random state and
redeems a single-use, 60-second PKCE-bound code. JWTs and provider credentials
never enter redirect URLs. Use HTTPS and redact query strings in access logs.
Neon cookies remain in the browser; native JWTs are saved only in SecureStore.

Native API access lasts until the issued Neon JWT expires (normally 15 minutes).
On expiry, the app returns to sign-in; reopening the browser reuses the Neon
session when available. No refresh token is copied into the app. Native sign-out
clears that device's token; the hosted browser session may remain. Browser
sign-out revokes its managed session, but already issued JWTs remain valid until
expiry. Application data deletion disables the app account immediately.

Create an account or sign in and complete onboarding. No mock authentication is
available. Existing Firebase logins must create/use a Neon account; the migration
preserves prior application rows as isolated legacy identities and does not link
accounts by email. Run `alembic upgrade head` (revision `0002`) and reapply the
runtime grants even if revision `0001` was already deployed.

## 5. Enable streaming voice

In the backend `.env`, set `LIVE_ENABLED=true` after verifying your project can use
the configured `GEMINI_LIVE_MODEL`. Restart the backend.

Open **Talk**, choose English, Hindi or Marathi, tap **Start conversation** and grant
microphone permission. Typed chat is available when Live is disabled or unavailable.
Tap Start conversation once: Vani greets you and keeps listening between replies.
Speak naturally and interrupt when needed; use End conversation to release the
microphone. SQL/memory lookups show a small Getting information status, like
Connecting. There are no spoken lookup announcements, and answer audio is not
held for a progress notice. After understanding a concern, Vani's prompt asks it
to recommend 2-3 relevant available activities, with a brief reason or first step.
Normal turn completion leaves the conversation and pending lookups
open. The configured session limit still applies (15 minutes by default).

Audio streams without being recorded to files. In the browser, use HTTPS or
localhost, allow microphone access, and keep the tab visible. Voice stops when
you hide/leave the tab or change accounts. If an embedded preview blocks microphone
access, open the same app URL directly in Chrome or Edge. The browser needs
AudioWorklet support; production CSP must permit the locally created worklet module.

## 6. Enable semantic memory

In the backend `.env`, configure:

```dotenv
RAG_ENABLED=true
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_API_KEY=YOUR_SERVER_ONLY_KEY
EMBEDDING_DIMENSIONS=768
EMBEDDING_PROFILE=google-gemini-embedding-001-768-v1
```

Restart the backend. In mobile **Profile**, enable **Save transcripts**, then
**Remember conversations**. Both default off. New completed turns can queue summary
and embedding jobs; earlier unsaved conversations cannot be recovered.

Run the maintenance command in a **separate environment**, with `DATABASE_URL`
set to the direct owner URL and the same provider settings:

```powershell
# From ai-backend, using the dedicated maintenance environment
.\.venv\Scripts\python.exe -m app.services.maintenance
```

Each invocation processes one available job per user and purges expired data.
Schedule it at least every minute and monitor pending/failed jobs. Do not change
the API's runtime URL to the owner URL. On macOS/Linux, use your virtual
environment's Python executable for equivalent backend commands.

Keep embeddings at 768 dimensions. A provider/model change requires a new profile
and evaluation; a dimension change also requires a schema migration. Evaluate
retrieval in English, Hindi and Marathi before enabling it for real users.

## Activities

All 19 activities are available: nine games (Pattern Recall, Tap Reaction Test,
Stroop Test, Number Sequence, Number Memory, Card Match, Speed Sorting, Find the Target,
Logic Quiz) and ten exercises. Open a card for instructions, complete the session,
then save its result. A failed browser save keeps the result on screen for retry
with the same event ID; stay on that screen until it saves. Native development
builds retain unsent results in the encrypted per-account queue and retry when
Activities is opened again. Pending results do not add to server progress yet.

Timed exercises offer shorter sessions and pause when the app goes into the
background. Focus Timer awards 15 points for 25 active minutes or 5 points for a
shorter completed session; other exercises award 5. Reflection and recall text
never enters the API payload or semantic memory. Only completion and active
duration are saved. Game scores and improvement remain SQL calculations, grouped
by game version; the rewritten games use version 2 and do not merge with older
version 1 results. No schema migration is needed for the expanded catalog.

The wellness-v1 activity component keeps its existing cap of nine completed
sessions per day; catalog size does not change that formula. The Activities
progress bar separately counts distinct activities tried that day, using the
profile timezone. These are practice activities, not clinical tests.

Gentle session guidance follows general advice from
[NHS breathing exercises](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/),
[NHS seated exercise](https://www.nhs.uk/live-well/exercise/sitting-exercises/)
and [AAO screen breaks](https://www.aao.org/eye-health/tips-prevention/computer-usage).

## Verification

| Check | Expected result |
| --- | --- |
| Save onboarding | Profile persists for the signed-in account |
| Complete a game | Round-validated score persists in structured SQL history |
| Submit a check-in | Sleep and mood appear in measurements |
| Open Insights on a new account | Unrecorded measurements stay unavailable |
| Start Talk with Live enabled | Microphone audio and assistant playback stream |
| Enable memory, chat and run maintenance | Summary/excerpt documents and vector chunks are created |
| Switch accounts | Personal data and local activity queues remain separate |

Vani/composite scores can remain unavailable: Gemini transcripts do not provide
the old Whisper confidence measurements, and the backend does not invent them.
Game improvement needs at least three results in each comparison window.

Run checks from the respective folders:

```powershell
# ai-backend
.\.venv\Scripts\python.exe -m pytest -q

# mindmitra-app
npm run typecheck
npm run test:auth
npm run test:voice
npm run test:activities
```

PostgreSQL integration tests require `TEST_DATABASE_URL` pointing to a separate,
migrated pgvector **test database**, using its runtime role. Otherwise they are
skipped. Never point the integration suite at production. The
[backend workflow](.github/workflows/backend.yml) defines the isolated CI setup.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend rejects its database role | Use non-owner `app_runtime`, not the migration URL |
| Missing tables/vector extension | Run Alembic against the correct new database as owner |
| Neon authentication fails | Check the Auth URL, trusted origins, provider callbacks, and issuer/audience/JWKS settings |
| Native sign-in cannot return | Rebuild with the `mindmitra` scheme and configure the hosted web URL and backend handoff key |
| Phone cannot connect | Check its HTTPS backend URL and WebSocket forwarding |
| Live returns `503` | Configure the server key, enable Live and verify model access |
| Native audio/encryption unavailable | Rebuild the native development app; do not use Expo Go |
| Semantic memory is empty | Check both consent switches, RAG settings, embedding key and maintenance jobs |
| Screen time is unrecorded | Collection requires the native Android `ScreenTimeModule`, which this repository does not implement |

Continue with the [deployment guide](ai-backend/docs/DEPLOYMENT.md) for retention,
deletion, backups and production rollout.
