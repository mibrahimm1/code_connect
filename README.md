# Video Calling MVP

A minimal, production-structured Video Calling Web Application with Realtime Speech-to-Text (Groq) and Realtime Translation (Google Cloud).

## Features

- **Video Calling**: WebRTC-based P2P video/audio.
- **Live Captions**: Real-time English transcription using Groq (Whisper).
- **Live Translation**: Optional real-time translation using Google Cloud Translation API.
- **Minimal UI**: Clean, responsive interface with dark mode.

## Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (optional, for containerized run)
- **Groq API Key**: Get one at [GroqCloud](https://console.groq.com/).
- **Google Cloud Translate Key**: Enable Cloud Translation API and get an API Key.

## Setup & Run

### 1. Environment Variables

Create a `.env` file in the `backend` directory (or set them in your environment/docker-compose):

```env
PORT=3000
GROQ_API_KEY=your_groq_api_key
CLOUD_TRANSLATE_KEY=your_google_translate_key
# OR
# GOOGLE_API_KEY=your_google_api_key
```

### 2. Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in two different browser windows/tabs.

### 3. Docker Compose

```bash
docker-compose up --build
```
Access the app at [http://localhost:5173](http://localhost:5173).

## Usage

1.  **Join Room**: Both users join the default room (`room-1`) automatically.
2.  **Video/Audio**: Grant permissions for Camera and Microphone.
3.  **Captions**: Speak in English. Captions will appear at the bottom.
4.  **Translation**: 
    - Click the "Translate" checkbox.
    - Select a target language (e.g., Spanish).
    - Speak in English. Translated text will appear below the original caption.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, WebRTC, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, Groq API (Whisper), Google Cloud Translation API
- **DevOps**: Docker Compose

## Troubleshooting

- **No Video?**: Ensure you allow camera/mic permissions. Check console for WebRTC errors.
- **No Captions?**: Verify `GROQ_API_KEY` is set and valid. Check backend logs.
- **No Translation?**: Verify `CLOUD_TRANSLATE_KEY` is set and valid. Check backend logs.
