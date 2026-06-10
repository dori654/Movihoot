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
│   │   ├── tmdb/
│   │   │   ├── tmdb.module.ts
│   │   │   └── tmdb.service.ts       # TMDB API (details, popular, watch providers)
│   │   └── ai/
│   │       ├── ai.module.ts
│   │       └── ai.service.ts         # Claude API recommendations
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
FRONTEND_URL=                  # optional — CORS origin (any origin when empty)
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
  ├── results: MovieResult[]   # populated after AI call (incl. providers[])
  ├── filmCards: FilmCard[]    # 5 TMDB popular movies, stored at session start
  ├── recommendationsTriggered: boolean  # set atomically — AI fires exactly once
  └── createdAt: timestamp     # sessions expire lazily after 12h

sessions/{roomCode}/answers/{nickname}
  ├── mood: string             # e.g. "happy", "tired", "adventurous"
  ├── genres: string[]         # e.g. ["comedy", "action"]
  ├── length: "short" | "medium" | "long"
  ├── energyLevel: "low" | "medium" | "high"
  ├── knownFilms: number[]     # TMDB movie IDs the participant has seen
  ├── likedFilms: number[]     # subset of knownFilms they liked (taste signal)
  └── submittedAt: timestamp

hosts/{uid}
  ├── email: string
  ├── displayName: string
  └── createdAt: timestamp
```

## WebSocket Events (Socket.io)

Client → server events are validated and answered with an ack envelope:
`{ ok: true, ...data }` or `{ ok: false, code, message }` (Hebrew message,
rendered by the frontend as-is). See `backend/src/sessions/ws.utils.ts`.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `watch_session` | client → server | `{ roomCode, token }` | Host joins broadcast room; Firebase ID token verified against hostId |
| `join_session` | client → server | `{ roomCode, nickname }` | Participant joins room; rejects duplicate live nicknames; rejoin allowed mid-session |
| `user_joined` | server → clients | `{ nickname, count }` | Broadcast new participant |
| `session_started` | server → clients | `{}` | Redirect all to questionnaire (broadcast by REST start endpoint) |
| `answers_submitted` | client → server | `{ roomCode, nickname, answers }` | User finishes questionnaire |
| `answer_received` | server → clients | `{ nickname }` | A participant's answers were stored |
| `all_answered` | server → clients | `{ results: Movie[] }` | All users done, show results |
| `recommendation_error` | server → clients | `{ message }` | AI/TMDB recommendation flow failed |
| `user_left` | server → clients | `{ nickname }` | Participant disconnected (30s grace period mid-session) |
| `host_left` / `host_back` | server → clients | `{}` | Host socket dropped / returned |

Session start is REST-only: `PATCH /sessions/:roomCode/start` (auth + ownership
+ lobby-status checks) — there is no `start_session` WS event. Film cards for
the known-films step are public: `GET /sessions/:roomCode/film-cards`.

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
System: You are a movie recommendation expert. Given group preferences, return exactly 5 movie recommendations as JSON. Never recommend a movie the group has already seen. Use films the group liked as a signal of their taste.

User: A group of {N} people answered these questions:
{aggregated answers summary — moods, genres, lengths, energy levels,
 seen films (excluded), liked films (taste signal)}

Return JSON: { movies: [ { tmdbId, title, reason, matchScore } ] }
```

## Key Implementation Notes
- roomCode: 6 uppercase alphanumeric chars, stored as Firestore doc ID
- Participants are anonymous — no Firebase Auth, identified by nickname + socketId
- Auth Guard applies only to Host routes (POST /sessions, GET/PATCH /sessions/:id)
- WS payloads validated with class-validator (`ws.utils.ts` validatePayload); per-socket rate limiting + @nestjs/throttler on REST
- "All answered" check runs in a Firestore transaction with a `recommendationsTriggered` flag — the AI call fires exactly once
- Disconnected participants get a 30s grace period mid-session before removal (page refresh ≠ leaving); after removal the all-answered check re-runs
- TMDB access goes through `backend/src/tmdb/tmdb.service.ts` (details, popular movies, watch providers with IL→US fallback)
- TMDB images base URL: `https://image.tmdb.org/t/p/w500` (provider logos: w92)
- Frontend uses `qrcode.react` for QR generation
- Use `@nestjs/platform-socket.io` for WebSocket Gateway
- Frontend keeps one Socket.io connection for the app lifetime (`useSocket.tsx`), tracks connection status, and rejoins rooms after reconnect

## Commands
```bash
# Backend
cd backend && npm run start:dev
cd backend && npm test          # unit tests (sessions, questionnaire, ai, tmdb)
cd backend && npm run lint

# Frontend
cd frontend && npm run dev
cd frontend && npm run build    # tsc + vite
```

## Current Status
- [ ] Firebase project created and configured (needs real credentials in .env)
- [x] NestJS project scaffolded
- [x] React project scaffolded
- [x] firebase.service.ts (Admin SDK)
- [x] auth.guard.ts
- [x] sessions.module + controller + service
- [x] sessions.gateway.ts (WebSockets, validated payloads + acks)
- [x] questionnaire.module + service (transactional all-answered)
- [x] ai.service.ts (Claude + TMDB via TmdbService)
- [x] Frontend pages (HostDashboard, Lobby, Questionnaire, Results)
- [x] Known-films questionnaire step (film cards + knownFilms/likedFilms)
- [x] Where-to-watch provider badges on results
- [x] Socket reconnect handling + connection banner + error boundary
- [x] Backend unit tests
- [ ] End-to-end session flow tested (needs real Firebase + API keys in .env)