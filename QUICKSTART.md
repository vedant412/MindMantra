# MindMitra quick start

Start the backend with a **new Neon PostgreSQL database**, then build the mobile
app. Commands below use Windows PowerShell from the repository root. Existing
SQLite databases and audio files are left untouched; no data import is required.

## Prerequisites

- Python 3.12 and Node.js/npm.
- A new Neon PostgreSQL database.
- A Firebase project with **Authentication → Email/Password** enabled.
- Firebase client configuration and backend Admin credentials from that same project.
- A server-side Gemini API key for typed chat and Live voice.
- An Android development toolchain and device/emulator. Building iOS requires
  macOS and Xcode.

Streaming audio and encrypted local activity storage require a native development
build. Expo Go cannot test the complete app.

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
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to your Firebase Admin JSON file, outside the repository |
| `GEMINI_API_KEY` | Your server-side Gemini key |
| `LIVE_ENABLED` | Leave `false` initially |
| `RAG_ENABLED` | Leave `false` initially |

Both database URLs must start with `postgresql+psycopg://` and include
`sslmode=require` or a stricter TLS mode. Use Neon's connection details for the
selected database and role; URL-encode special characters in passwords.

Windows credential paths can use forward slashes:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/YOUR_NAME/secrets/firebase-admin.json
```

Do not commit `.env` or the Admin JSON. Database URLs, Gemini keys and embedding
keys must never appear in mobile configuration or `EXPO_PUBLIC_` variables.

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
the routes. Personal API calls require a Firebase ID token; an unauthenticated
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
- Fill the `EXPO_PUBLIC_FIREBASE_*` client values from the same Firebase project
  used by the backend. These are separate from the private Firebase Admin JSON.

Then run:

```powershell
npm run typecheck
npm run android
```

On macOS, use `npm run ios` instead. Rebuild after native dependency/plugin changes.
Restart Metro after public environment changes. For an existing development build,
you can start Metro separately with `npx expo start --dev-client`.

Create an account or sign in and complete onboarding. Firebase must be configured;
there is no mock-login path to personal backend data.

## 5. Enable streaming voice

In the backend `.env`, set `LIVE_ENABLED=true` after verifying your project can use
the configured `GEMINI_LIVE_MODEL`. Restart the backend.

Open **Talk**, choose English, Hindi or Marathi, tap **Start voice** and grant
microphone permission. Typed chat is available when Live is disabled or unavailable.
Audio streams without being recorded to files.

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
| Firebase authentication fails | Match project IDs and configure valid Admin credentials |
| Phone cannot connect | Check its HTTPS backend URL and WebSocket forwarding |
| Live returns `503` | Configure the server key, enable Live and verify model access |
| Native audio/encryption unavailable | Rebuild the native development app; do not use Expo Go |
| Semantic memory is empty | Check both consent switches, RAG settings, embedding key and maintenance jobs |
| Screen time is unrecorded | Collection requires the native Android `ScreenTimeModule`, which this repository does not implement |

Continue with the [deployment guide](ai-backend/docs/DEPLOYMENT.md) for retention,
deletion, backups and production rollout.
