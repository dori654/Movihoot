# 🎬 Movihoot

A Kahoot-style group movie selection app. A host creates a session, participants join via QR code or room code, answer a short preference questionnaire, and Claude AI aggregates everyone's answers to recommend **5 movies** for the group to watch together.

---

## ✨ Features

- 🔐 Host authentication via Google (Firebase Auth)
- 🏠 Instant room creation with a 6-character code + QR code
- 📡 Real-time participant updates via WebSockets (Socket.io)
- 🎯 5-question preference questionnaire (mood, genres, length, energy)
- 🤖 AI-powered group recommendations using Claude (`claude-sonnet-4-20250514`)
- 🎞️ Movie details enriched from TMDB (posters, overview, runtime)
- 📱 Fully responsive — works on mobile for participants, TV-friendly for hosts

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | NestJS (Node.js) |
| Realtime | Socket.io (WebSockets) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google sign-in, host only) |
| AI | Anthropic Claude API |
| Movies | TMDB API |

---

## 🗂️ Project Structure

```
movihoot/
├── .github/workflows/ci.yml   # GitHub Actions CI
├── backend/                   # NestJS API
│   └── src/
│       ├── firebase/          # Firebase Admin SDK
│       ├── auth/              # JWT guard + @CurrentUser decorator
│       ├── sessions/          # REST endpoints + Socket.io gateway
│       ├── questionnaire/     # Answer submission + completion check
│       └── ai/                # Claude API + TMDB enrichment
└── frontend/                  # React + Vite SPA
    └── src/
        ├── firebase/          # Firebase client SDK init
        ├── hooks/             # useAuth, useSocket
        ├── services/          # Axios API client
        ├── pages/             # HostDashboard, Lobby, Questionnaire, Results
        └── components/        # QRCode, MovieCard, ParticipantList
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A [Firebase project](https://console.firebase.google.com/) with Firestore + Google Auth enabled
- An [Anthropic API key](https://console.anthropic.com/)
- A [TMDB API key](https://www.themoviedb.org/settings/api)

### 1. Clone the repo

```bash
git clone https://github.com/dori654/Movihoot.git
cd Movihoot
```

### 2. Configure environment variables

**`backend/.env`**
```env
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ANTHROPIC_API_KEY=sk-ant-...
TMDB_API_KEY=your-tmdb-key
TMDB_BASE_URL=https://api.themoviedb.org/3
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run the app

```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🎮 How to Play

1. **Host** opens the app and signs in with Google
2. Host clicks **"צור סשן חדש"** — a room code and QR code appear
3. **Participants** scan the QR code (or go to `/join?room=XXXXXX`) and enter a nickname
4. Host sees participants join in real time, then clicks **"התחל"**
5. Everyone answers 4 quick questions about their mood, preferred genres, available time, and energy level
6. Once all answers are in, Claude analyzes the group's preferences and recommends **5 movies**
7. Results appear on everyone's screen with TMDB posters, match scores, and reasons

---

## 🔄 Session Flow

```
Host creates session  →  Participants join via QR / code
        ↓
Host starts session  →  All clients navigate to Questionnaire
        ↓
Each participant answers 4 questions  →  Answers saved to Firestore
        ↓
Last answer triggers Claude API  →  5 movie recommendations returned
        ↓
TMDB enriches each movie  →  Results broadcast to all via WebSocket
        ↓
Results page shown to everyone 🎬
```

---

## 🌐 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_session` | client → server | Participant joins a room |
| `user_joined` | server → clients | New participant broadcast |
| `start_session` | client → server | Host starts the questionnaire |
| `session_started` | server → clients | Redirect all to questionnaire |
| `answers_submitted` | client → server | Participant submits answers |
| `answer_received` | server → clients | Acknowledge a submission |
| `all_answered` | server → clients | All done — send movie results |
| `user_left` | server → clients | Participant disconnected |

---

## 🧪 Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend test coverage
cd backend && npm run test:cov
```

---

## ✅ CI / GitHub Actions

Every push runs:

- **Backend:** `npm ci` → `npm run build` → `npm run lint` → `npm test`
- **Frontend:** `npm ci` → `npm run build`

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## 📝 License

MIT
