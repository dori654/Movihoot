# Movihoot — Claude Code Context

## Project Overview
Kahoot-style group movie selection app. A host creates a session, participants join via QR or room code, answer a preference questionnaire, and Claude AI aggregates all responses to recommend 5 movies for the group to watch together.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | NestJS (Node.js) |
| Realtime | Socket.io (WebSockets) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Host only, Google sign-in) |
| AI | Claude API (claude-sonnet-4-20250514) |
| Movies | TMDB API |

## Repo Structure
```
movihoot/
├── backend/                  # NestJS
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── firebase/
│   │   │   ├── firebase.module.ts
│   │   │   └── firebase.service.ts   # Firebase Admin SDK init
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.guard.ts         # Verifies Firebase ID token
│   │   │   └── auth.decorator.ts     # @CurrentUser() decorator
│   │   ├── sessions/
│   │   │   ├── sessions.module.ts
│   │   │   ├── sessions.controller.ts
│   │   │   ├── sessions.service.ts
│   │   │   ├── sessions.gateway.ts   # Socket.io WebSocket gateway
│   │   │   └── dto/
│   │   │       ├── create-session.dto.ts
│   │   │       └── join-session.dto.ts
│   │   ├── questionnaire/
│   │   │   ├── questionnaire.module.ts
│   │   │   ├── questionnaire.service.ts
│   │   │   └── dto/
│   │   │       └── submit-answers.dto.ts
│   │   └── ai/
│   │       ├── ai.module.ts
│   │       └── ai.service.ts         # Claude API + TMDB integration
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── firebase/
    │   │   └── firebase.config.ts    # Firebase client SDK init
    │   ├── hooks/
    │   │   ├── useAuth.ts            # Firebase Auth hook
    │   │   └── useSocket.ts          # Socket.io hook
    │   ├── pages/
    │   │   ├── HostDashboard.tsx     # Create session, QR display
    │   │   ├── Lobby.tsx             # Waiting room, participant list
    │   │   ├── Questionnaire.tsx     # Questions flow
    │   │   └── Results.tsx           # 5 movie recommendations
    │   ├── components/
    │   │   ├── QRCode.tsx
    │   │   ├── MovieCard.tsx
    │   │   └── ParticipantList.tsx
    │   └── services/
    │       └── api.ts                # Axios calls to backend
    ├── .env
    └── package.json
```

## Environment Variables

### backend/.env
```env
PORT=3000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=""
ANTHROPIC_API_KEY=
TMDB_API_KEY=
TMDB_BASE_URL=https://api.themoviedb.org/3
```

### frontend/.env
```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firestore Data Model

```
sessions/{roomCode}
  ├── hostId: string           # Firebase Auth UID
  ├── status: "lobby" | "active" | "done"
  ├── participants: string[]   # nicknames
  ├── results: MovieResult[]   # populated after AI call
  └── createdAt: timestamp

sessions/{roomCode}/answers/{nickname}
  ├── mood: string             # e.g. "happy", "tired", "adventurous"
  ├── genres: string[]         # e.g. ["comedy", "action"]
  ├── length: "short" | "medium" | "long"
  ├── knownFilms: number[]     # TMDB movie IDs
  └── submittedAt: timestamp

hosts/{uid}
  ├── email: string
  ├── displayName: string
  └── createdAt: timestamp
```

## WebSocket Events (Socket.io)

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join_session` | client → server | `{ roomCode, nickname }` | Participant joins room |
| `user_joined` | server → clients | `{ nickname, count }` | Broadcast new participant |
| `start_session` | client → server | `{ roomCode }` | Host starts questionnaire |
| `session_started` | server → clients | `{}` | Redirect all to questionnaire |
| `answers_submitted` | client → server | `{ roomCode, nickname, answers }` | User finishes questionnaire |
| `all_answered` | server → clients | `{ results: Movie[] }` | All users done, show results |
| `user_left` | server → clients | `{ nickname }` | Participant disconnected |

## Session Flow

```
1. Host logs in (Firebase Auth Google)
2. Host creates session → backend generates roomCode (6 chars)
3. QR code displayed on host screen
4. Participants scan QR / enter roomCode + nickname → join WS room
5. Host sees participant list update in real-time
6. Host starts session → all clients navigate to Questionnaire
7. Each participant answers:
   - Mood (how are you feeling?)
   - Genre preferences
   - Movie length preference
   - Known films (from TMDB suggestions)
8. On all answers submitted → backend aggregates
9. AI module sends all answers to Claude API
10. Claude returns 5 movie recommendations
11. TMDB API enriches with posters + metadata
12. Results broadcast to all clients via WS
13. Host screen shows shared TV view, participants see personal view
```

## Questionnaire Questions
1. מה המצב רוח שלך הערב? (mood selector)
2. איזה ז'אנר הייתה רוצה לראות? (multi-select: אקשן, קומדיה, דרמה, אימה, מדע בדיוני, רומנטיקה, תיעודי)
3. כמה זמן יש לך? (short <90min / medium 90-120min / long 2h+)
4. מה רמת האנרגיה שלך? (low/medium/high)
5. הכר סרטים — 5 כרטיסים של סרטים מ-TMDB, האם ראית / אהבת? (swipe-style)

## Claude API Prompt Structure (ai.service.ts)
```
System: You are a movie recommendation expert. Given group preferences, return exactly 5 movie recommendations as JSON.

User: A group of {N} people answered these questions:
{aggregated answers summary}

Return JSON: { movies: [ { tmdbId, title, reason, matchScore } ] }
```

## Key Implementation Notes
- roomCode: 6 uppercase alphanumeric chars, stored as Firestore doc ID
- Participants are anonymous — no Firebase Auth, identified by nickname + socketId
- Auth Guard applies only to Host routes (POST /sessions, PATCH /sessions/:id/start)
- TMDB images base URL: `https://image.tmdb.org/t/p/w500`
- Frontend uses `qrcode.react` for QR generation
- Use `@nestjs/platform-socket.io` for WebSocket Gateway

## Commands
```bash
# Backend
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev
```

## Current Status
- [ ] Firebase project created and configured
- [ ] NestJS project scaffolded
- [ ] React project scaffolded
- [ ] firebase.service.ts (Admin SDK)
- [ ] auth.guard.ts
- [ ] sessions.module + controller + service
- [ ] sessions.gateway.ts (WebSockets)
- [ ] questionnaire.module + service
- [ ] ai.service.ts (Claude + TMDB)
- [ ] Frontend pages (HostDashboard, Lobby, Questionnaire, Results)
- [ ] End-to-end session flow tested