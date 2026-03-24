# Vani — Cognitive Health AI Backend

Vani is an empathetic AI assistant backend built with FastAPI. It processes voice/text input, runs sentiment analysis, calculates cognitive scores, and responds with natural speech via Edge-TTS.

## Core Features

- **Voice + Text Input**: Accepts audio (Faster-Whisper STT) or raw text
- **Cognitive Scoring**: Real-time 0-100 stress scoring with state tracking
- **Sentiment Analysis**: HuggingFace transformer-based emotion detection
- **Activity Extraction**: Rule-based behavioral pattern recognition (food, exercise, sleep, etc.)
- **Unified Insight Engine**: Aggregates daily data into human-readable insights
- **Daily Question System**: Time-aware proactive questioning (max 3/day)
- **Dual Memory**: Short-term session context + long-term user facts (SQLite)
- **Neural TTS**: Microsoft Edge-TTS (JennyNeural) with emotion-adaptive pacing
- **Adaptive Response Length**: Enforces short, human-like responses (max 40 words)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API | FastAPI + Uvicorn |
| LLM | Ollama (Mistral) |
| STT | Faster-Whisper |
| TTS | Microsoft Edge-TTS |
| Sentiment | HuggingFace Transformers |
| Database | SQLite + SQLAlchemy |

---

## Quick Start

### 1. Prerequisites

- **Python 3.10+**
- **Ollama** installed → run `ollama pull mistral`
- **FFmpeg** in system PATH (required by Whisper)

### 2. Create Virtual Environment

```powershell
cd ai-backend
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate
```

### 3. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 4. Start the Server

For **local-only** access (browser testing):
```powershell
uvicorn app.main:app --reload
```

For **mobile app** access (phone must be on same Wi-Fi):
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 5. Test

- **Browser UI**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Mobile App**: Update `API_BASE_URL` in `mindmitra-app/src/services/api.ts` with your PC's Wi-Fi IP (run `ipconfig` to find it)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process-input` | Send text or audio → get AI response + TTS |
| `GET` | `/daily-summary?user_id=` | Today's cognitive score summary |
| `GET` | `/insights?user_id=` | Behavioral insight strings |

### POST `/process-input` — JSON

```json
{
  "user_id": "user_123",
  "session_id": "session_1",
  "text": "I feel stressed today",
  "emotion": "neutral"
}
```

### POST `/process-input` — Audio (multipart/form-data)

- `user_id`: string
- `session_id`: string
- `audio_file`: .wav/.webm/.m4a file

### Response

```json
{
  "response": "Hey… sounds like a rough day. Did you sleep okay?",
  "audio_url": "/audio/response_abc123.mp3",
  "sentiment": "negative",
  "state": "stressed",
  "emotion": "tired",
  "cognitive_score": 45,
  "cognitive_state": "stressed"
}
```

---

## Project Structure

```
ai-backend/
├── app/
│   ├── routes/
│   │   └── process.py          # API endpoints
│   ├── services/
│   │   ├── llm_service.py      # Ollama LLM integration
│   │   ├── tts_service.py      # Edge-TTS synthesis
│   │   ├── speech_service.py   # Faster-Whisper STT
│   │   ├── memory_service.py   # Facts, events, daily summary
│   │   ├── sentiment_service.py
│   │   ├── cognitive_service.py
│   │   ├── insight_service.py
│   │   ├── question_service.py
│   │   ├── time_service.py
│   │   └── speech_analysis_service.py
│   ├── models/
│   │   └── schemas.py          # SQLAlchemy + Pydantic models
│   ├── db/
│   │   └── database.py         # SQLite engine
│   └── main.py                 # FastAPI app entry
├── requirements.txt
└── README.md
```
