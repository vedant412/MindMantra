# Vani — Cognitive Health AI Backend

Vani is an empathetic AI assistant backend built with **FastAPI**. It processes voice/text input, runs sentiment analysis, calculates cognitive scores, and responds with natural speech via Edge-TTS — now with **Redis caching**, **instant response templates**, and **async LLM processing** for near real-time performance.

---

## Core Features

- **Voice & Text Input**: Accepts audio (Whisper STT) or raw text
- **Multilingual**: English, Hindi, Marathi (native Devanagari script)
- **Redis Response Cache**: Repeated/similar queries return in < 100ms
- **Instant Templates**: Common intents (stress, sleep, greetings) skip LLM entirely — < 20ms
- **Async LLM Pipeline**: Non-blocking Ollama calls via `httpx`
- **Background Tasks**: DB writes (facts, insights, events) happen after response is sent
- **Cognitive Scoring System**: Tracks mood, confidence, and session state
- **Dual Memory**: Short-term session context + long-term user facts (SQLite)
- **Daily Question System**: Time-aware proactive questioning (max 3/day)
- **Unified Insight Engine**: Aggregates daily data into human-readable insights
- **Adaptive TTS**: Microsoft Edge-TTS (JennyNeural) with emotion-adaptive pacing
- **Short Response Enforcement**: Max 40 words — optimized for voice interaction
- **Performance Monitor**: Live cache hit rate and latency stats via `/perf-stats`

---

## Response Time Targets

| Path | How it triggers | Target |
|---|---|---|
| 🚀 **Template Hit** | "stressed", "hello", "can't sleep", "bored" | **< 20ms** |
| ⚡ **Cache Hit** | Same short query seen before (1hr TTL) | **< 100ms** |
| 🧠 **LLM Call** | New/personal queries → full Ollama pipeline | **< 1.5s** |
| ⚠️ **Fallback** | Ollama timeout (> 10s) | **< 2.1s** |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process-input` | Send text or audio → get AI response + TTS |
| `GET`  | `/daily-summary?user_id=` | Today's cognitive score summary |
| `GET`  | `/insights?user_id=` | Behavioral insight strings |
| `GET`  | `/location/insights?user_id=` | Location pattern analysis |
| `POST` | `/screen-time/sync` | Sync app usage data |
| `POST` | `/location/sync` | Sync GPS location data |
| `POST` | `/user-profile` | Create/update user profile |
| `GET`  | `/user-profile?user_id=` | Fetch user profile facts |
| `GET`  | `/perf-stats` | **NEW** — Live cache hit rate & latency stats |

### POST `/process-input` — JSON

```json
{
  "user_id": "user_123",
  "session_id": "session_1",
  "text": "I feel stressed today",
  "emotion": "neutral",
  "preferred_language": "en"
}
```

### POST `/process-input` — Audio (multipart/form-data)

- `user_id`: string
- `session_id`: string
- `audio_file`: .wav / .webm / .m4a file
- `preferred_language`: `en` | `hi` | `mr` (optional, default: `auto`)

### Response

```json
{
  "response": "Hey… sounds like a rough day. Want to try a quick breathing exercise?",
  "audio_url": "/audio/response_abc123.mp3",
  "language": "en",
  "sentiment": "negative",
  "state": "stressed",
  "emotion": "tired",
  "cognitive_score": 45,
  "cognitive_state": "stressed",
  "question": "What's been the most overwhelming part of your day?",
  "question_type": "template",
  "actions": [{ "type": "exercise", "id": "breathing" }]
}
```

> `question_type` will be one of: `"template"` | `"cached"` | `"generated"` | `"db"`

---

## Tech Stack

| Component | Technology |
|---|---|
| API Framework | FastAPI + Uvicorn |
| LLM | Ollama (Mistral) — async via `httpx` |
| STT | Faster-Whisper |
| TTS | Microsoft Edge-TTS |
| Sentiment | HuggingFace Transformers |
| Cache | Redis via `redis-py` (Memurai on Windows) |
| Database | SQLite + SQLAlchemy |

---

## Project Structure

```
ai-backend/
├── app/
│   ├── routes/
│   │   └── process.py              # All API endpoints
│   ├── services/
│   │   ├── llm_service.py          # Async Ollama LLM (httpx)
│   │   ├── cache_service.py        # NEW — Redis cache (SHA-256 keys, TTL)
│   │   ├── template_service.py     # NEW — Instant intent templates (EN/HI/MR)
│   │   ├── monitor_service.py      # NEW — Latency logger + hit-rate stats
│   │   ├── tts_service.py          # Edge-TTS synthesis
│   │   ├── speech_service.py       # Faster-Whisper STT
│   │   ├── memory_service.py       # Facts, events, daily summary
│   │   ├── sentiment_service.py    # Sentiment analysis
│   │   ├── cognitive_service.py    # Cognitive score engine
│   │   ├── insight_service.py      # Unified insight generation
│   │   ├── question_service.py     # Daily question selection
│   │   ├── time_service.py         # Time-of-day context
│   │   └── speech_analysis_service.py
│   ├── models/
│   │   └── schemas.py              # SQLAlchemy + Pydantic models
│   ├── db/
│   │   └── database.py             # SQLite engine
│   └── main.py                     # FastAPI app entry point
├── requirements.txt
└── README.md
```

---

## Setup & Running

### 1. Prerequisites

- **Python 3.10+**
- **FFmpeg** in system PATH (required by Whisper)
- **Ollama** running locally with Mistral model pulled:
  ```powershell
  ollama pull mistral
  ```
- **Redis** — Install [Memurai](https://www.memurai.com/get-memurai) (free Developer Edition for Windows). It runs as a Windows Service automatically.

### 2. Verify Redis is Running

```powershell
# Note: path must be quoted — use the & call operator
& "C:\Program Files\Memurai\memurai-cli.exe" ping

# OR if Memurai is already in your system PATH:
memurai-cli ping

# Expected output: PONG
```

### 3. Create Virtual Environment

```powershell
python -m venv venv
```

### 4. Activate Environment (Windows)

```powershell
.\venv\Scripts\Activate
```

### 5. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 6. Start the Server

**Local-only** (browser/emulator on same machine):
```powershell
uvicorn app.main:app --reload
```

**Network access** (phone/device on same Wi-Fi):
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then update `mindmitra-app/src/services/api.ts` with your PC's Wi-Fi IP (run `ipconfig` to find it).

---

## Performance Monitoring

After sending a few requests, check real-time stats:

```
GET http://localhost:8000/perf-stats
```

Example response:
```json
{
  "cache_hit":     { "count": 5,  "avg_ms": 62.3  },
  "template_hit":  { "count": 12, "avg_ms": 18.1  },
  "llm_call":      { "count": 8,  "avg_ms": 1340.5 },
  "fallback":      { "count": 0,  "avg_ms": 0.0   },
  "cache_hit_rate": "68.0%",
  "total_requests": 25
}
```

Console logs will show per-request timing:
```
INFO [PERF] 🚀 [TEMPLATE_HIT] | 18.3ms  | user=user123
INFO [PERF] ⚡ [CACHE_HIT]    | 54.1ms  | user=user123
INFO [PERF] 🧠 [LLM_CALL]     | 1240ms  | user=user123
INFO [CACHE] ✅ Redis connected successfully
```

---

## Caching Rules

The cache only stores responses for:
- ✅ Short inputs (≤ 150 characters)
- ✅ Non-personal queries (no "I", "my", "me" patterns)
- ✅ TTL: 1 hour per entry

The following are **never cached**:
- ❌ Long personal inputs / diary-style messages
- ❌ Audio transcriptions (always treated as personal)

---

## Supported Actions (LLM Response)

The LLM (and templates) can return action suggestions:

| Type | IDs |
|---|---|
| `exercise` | `breathing`, `meditation`, `stretching`, `journaling` |
| `game` | `pattern`, `reaction`, `stroop`, `sequence` |

Example action in response:
```json
"actions": [{ "type": "exercise", "id": "breathing" }]
```

---

## Fallback Strategy

If Ollama is unreachable or times out (> 10s), Vani returns a pre-written language-aware fallback and suggests a breathing exercise — ensuring the user always gets a response.
