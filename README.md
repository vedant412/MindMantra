# MindMitra — AI-Powered Cognitive Wellness Companion

MindMitra is a full-stack cognitive health platform consisting of a **FastAPI AI backend** (Vani) and a **React Native (Expo) mobile app**.

Vani is an empathetic AI assistant that uses voice input, sentiment analysis, cognitive scoring, and neural TTS to have natural, human-like conversations about your mental wellness.

---

## Project Structure

```
RIT_COGNITIVE_HEALTH_APP/
├── ai-backend/          # FastAPI + Ollama + Edge-TTS backend
│   ├── app/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # LLM, TTS, sentiment, memory, insights
│   │   ├── models/      # SQLAlchemy + Pydantic schemas
│   │   └── db/          # SQLite database config
│   ├── requirements.txt
│   └── README.md
│
└── mindmitra-app/       # React Native (Expo) mobile app
    ├── src/
    │   ├── screens/     # Home, Talk, Activities, Insights, Profile
    │   ├── components/  # Orb animated component
    │   ├── services/    # API service (connects to backend)
    │   ├── navigation/  # Bottom tab navigator
    │   └── theme/       # Color palette & design tokens
    ├── package.json
    └── App.tsx
```

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **Ollama** installed and running (`ollama pull mistral`)
- **FFmpeg** in system PATH
- **Expo Go** app on your phone

### 1. Backend (Vani AI Engine)

```powershell
cd ai-backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend (MindMitra Mobile App)

```powershell
cd mindmitra-app
npm install
npm start
```

Scan the QR code with Expo Go on your phone. Both devices must be on the **same Wi-Fi network**.

> **Important**: Update `API_BASE_URL` in `mindmitra-app/src/services/api.ts` with your PC's local IP. Find it by running `ipconfig` and looking for `IPv4 Address` under your Wi-Fi adapter.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Backend | FastAPI, Ollama (Mistral), SQLAlchemy, SQLite |
| Speech-to-Text | Faster-Whisper |
| Text-to-Speech | Microsoft Edge-TTS (JennyNeural) |
| Sentiment | HuggingFace Transformers |
| Mobile App | React Native (Expo), TypeScript |
| Navigation | React Navigation (Bottom Tabs) |
| Audio Playback | expo-av |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/process-input` | Send text/audio, get AI response + TTS audio |
| GET | `/daily-summary?user_id=` | Cognitive score summary for the day |
| GET | `/insights?user_id=` | AI-generated behavioral insights |

---

## License

This project is for academic/research purposes (RIT).
