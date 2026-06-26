# MeetPoint

A real-time collaborative whiteboard application. Teams join shared rooms, draw freely, drop sticky notes, chat, cast star votes, and export the board as PNG / JPG / PDF — all synchronized live via WebSocket.

---

## Feature List

| Feature | Description |
|---------|-------------|
| **Auth** | JWT dual-token (15 min access + 7 day refresh), bcrypt 12 rounds, HttpOnly refresh cookie |
| **Rooms** | Create / join by invite code, lock, close, transfer ownership |
| **Whiteboard** | tldraw infinite canvas, real-time sync (Redis hot-path + PostgreSQL debounced) |
| **Sticky Notes** | 4 types (Idea / Problem / Solution / Action), drag-and-drop, inline edit, per-user auth |
| **Live Cursors** | Color-coded cursors at 30 FPS with name badges, auto-remove after 3 s idle |
| **Chat** | Real-time room chat, reply-to threads, @mention autocomplete, paginated history |
| **Voting** | 1–5 star rating per sticky note, live average + vote count leaderboard |
| **Export** | PNG / JPG / PDF of the full whiteboard (html2canvas + jsPDF, lazy-loaded) |
| **Audit Log** | Fire-and-forget log for key actions (register, login, draw, chat, vote) |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS + |
| npm | 9 + |
| PostgreSQL | 16 |
| Redis | 7 |
| Docker + Docker Compose | any recent version |

---

## Quick Start — Docker

```bash
# 1. Clone
git clone <repo-url>
cd meet_point

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and JWT_REFRESH_SECRET

# 3. Start all services (postgres, redis, server, client, nginx)
docker-compose up --build

# 4. Run database migrations (first time only)
docker-compose exec server npx sequelize-cli db:migrate
# OR apply the SQL files directly via psql / Flyway (see Database Migrations below)

# App is now live at http://localhost
```

---

## Manual Setup

### Server

```bash
cd server
npm install

cp ../.env.example .env   # fill in DB/Redis/JWT values

npm run dev          # nodemon, watches src/
npm start            # production: node src/index.js
```

### Client

```bash
cd client
npm install

echo "VITE_SERVER_URL=http://localhost:3001" > .env.local

npm run dev          # Vite HMR on :5173
npm run build        # production bundle → dist/
npm run preview      # serve dist/ locally
```

---

## Database Migrations

Migration SQL files live in `database/migrations/` (`V1__create_users.sql` through `V8__create_audit_logs.sql`).

### Via Flyway (Docker)

```bash
docker run --rm \
  -v "$(pwd)/database/migrations":/flyway/sql \
  flyway/flyway:latest \
  -url=jdbc:postgresql://host.docker.internal:5432/meetpoint \
  -user=postgres -password=secret migrate
```

### Via psql (manual)

```bash
for f in database/migrations/V*.sql; do
  psql -U postgres -d meetpoint -f "$f"
done
```

---

## Environment Variables

| Variable | Example | Notes |
|----------|---------|-------|
| `PORT` | `3001` | Express server port |
| `NODE_ENV` | `development` | `development` enables Sequelize `sync({alter:true})` |
| `CLIENT_URL` | `http://localhost:5173` | CORS allowed origins, comma-separated |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `meetpoint` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `secret` | Database password |
| `DATABASE_URL` | `postgres://...` | Full DSN — overrides individual `DB_*` vars |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(blank)* | Leave blank for local Redis |
| `JWT_SECRET` | `at_least_32_random_chars` | Access token secret **— change in prod** |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | `another_32_random_chars` | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `RATE_LIMIT_WINDOW_MS` | `900000` | General rate-limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `CSRF_SECRET` | `csrf_secret_here` | CSRF cookie signing secret |
| `VITE_SERVER_URL` | `http://localhost:3001` | *(client-only)* API base URL |

---

## Available Scripts

### Server (`cd server`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon (auto-restart on change) |
| `npm start` | Start in production mode |
| `npm run lint` | Run ESLint |

### Client (`cd client`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR on `:5173` |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Run ESLint |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Browser  (React 18 + Vite + Tailwind)             │
│                                                                      │
│  ┌──────────┐   ┌──────────────────────────────────────────────┐    │
│  │/dashboard│   │  /room/:id                                   │    │
│  │          │   │  ┌──────────┬───────────────┬─────────────┐  │    │
│  │AuthStore │   │  │Whiteboard│  StickyNotes  │  ChatPanel  │  │    │
│  │RoomStore │   │  │ (tldraw) │  drag + vote  │  socket     │  │    │
│  └──────────┘   │  ├──────────┴───────────────┴─────────────┤  │    │
│                 │  │  CursorOverlay · VotingPanel · Export  │  │    │
│                 │  └────────────────────────────────────────┘  │    │
│                 └──────────────────────────────────────────────┘    │
└──────────────────┬────────────────────────────┬─────────────────────┘
                   │  HTTP / REST  (Axios)       │  WebSocket (Socket.io)
                   ▼                             ▼
          ┌────────────────────────────────────────────┐
          │              Nginx  :80                    │
          │   /api/*  →  :3001     /*  →  :5173        │
          └────────────────────────────────────────────┘
                   │                             │
                   ▼                             ▼
   ┌───────────────────────────┐   ┌───────────────────────────────┐
   │    Express  :3001         │   │   Socket.io  (same process)   │
   │                           │   │                               │
   │  /api/auth/*              │   │  joinRoom   → roomData        │
   │  /api/rooms               │   │  boardUpdate→ boardUpdated    │
   │  /api/rooms/:id           │   │  cursorMove → cursorMoved     │
   │  /api/rooms/:id/notes     │   │  moveNote   → noteMoved       │
   │  /api/rooms/:id/chat      │   │  chatMessage→ newMessage      │
   │  /api/rooms/:id/notes/    │   │  leaveRoom  → participantLeft │
   │    :nId/vote              │   │                               │
   └─────────────┬─────────────┘   └───────────────────────────────┘
                 │
       ┌─────────▼──────────┐    ┌────────────────────────┐
       │  PostgreSQL  :5432  │    │    Redis  :6379         │
       │                     │    │                         │
       │  users              │    │  board:{roomId}         │
       │  rooms              │    │  refresh:{userId}       │
       │  room_participants  │    │  blacklist:{token}      │
       │  board_elements     │    │  room:{id}:participants │
       │  sticky_notes       │    │  ratelimit:socket:*     │
       │  votes (+ trigger)  │    │                         │
       │  chats              │    └────────────────────────┘
       │  audit_logs         │
       └─────────────────────┘
```

### Board update data flow

```
User draws  →  tldraw editor.store.listen (source: 'user')
           →  100 ms client debounce
           →  socket.emit('boardUpdate', { snapshot, version })

Server socket.js:
  1. Optimistic concurrency: reject if version < currentVersion
  2. setEx('board:{roomId}', 86400, { snapshot, version })   ← Redis (hot path)
  3. socket.to(room).emit('boardUpdated', …)                 ← peers sync instantly
  4. debounce 10 s → boardService.saveSnapshot()             ← PostgreSQL (cold path)
```

---

## Performance Notes

| Layer | Strategy | Detail |
|-------|----------|--------|
| Board persistence | Debounced DB flush | Max 1 write to Postgres per 10 s per room; Redis serves all interim reads |
| Board concurrency | Optimistic versioning | Server rejects stale writes (`version < current`); client receives `boardUpdateRejected` |
| Cursor sync | Dual throttle | 33 ms server-side + 30 ms client-side = max ~30 FPS cursor events |
| Bundle size | Route-level code splitting | `React.lazy` + `Suspense` for all pages; html2canvas + jsPDF loaded only on first export |
| DB connections | Sequelize pool | max 10 / min 2 connections |
| Auth brute force | express-rate-limit | 5 attempts / 15 min per IP on login + register |
| Socket abuse | Redis counter | 100 events / 60 s per user via `checkSocketRate()` |
| Refresh tokens | Single session | `refresh:{userId}` in Redis — second login silently revokes the first |

---

## Known Limitations

1. **tldraw export fidelity** — `html2canvas` captures the DOM/CSS layer; tldraw's internal canvas may not render perfectly. Consider using tldraw's native SVG export API for pixel-perfect output in a future iteration.

2. **Single session per user** — Only one concurrent session is supported per account. A second login revokes the first refresh token.

3. **Last-write-wins board conflicts** — Version-based rejection means a slower sender loses their update with no merge. Suitable for small teams; a CRDT approach would be required for large concurrent editing.

4. **No offline / PWA support** — All edits require an active WebSocket. Disconnection during editing results in lost changes.

5. **Touch drag not supported** — Sticky note drag uses mouse events only (`mousemove` / `mouseup`). Touch devices cannot drag notes.

6. **Chat history is not virtualized** — Very large chat histories (1000+ messages) loaded at once may affect render performance. A windowed list (e.g., `react-window`) would be needed for high-volume rooms.

7. **Redis hard dependency** — Board caching, presence tracking, and token blacklisting all require Redis. There is no graceful degradation if Redis is unavailable.

---

## Project Structure

```
meet_point/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── CursorOverlay.jsx
│   │   │   ├── ExportButton.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── StickyNoteBoard.jsx
│   │   │   ├── StickyNoteCard.jsx
│   │   │   ├── VotingPanel.jsx
│   │   │   └── Whiteboard.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── RoomLobby.jsx
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   ├── boardStore.js
│   │   │   ├── chatStore.js
│   │   │   ├── roomStore.js
│   │   │   ├── stickyStore.js
│   │   │   └── voteStore.js
│   │   ├── utils/
│   │   │   └── exportUtils.js
│   │   ├── App.jsx
│   │   └── socket.js
│   ├── index.html
│   └── vite.config.js
│
├── server/
│   └── src/
│       ├── config/
│       │   ├── db.js
│       │   ├── redis.js
│       │   └── socket.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── chatController.js
│       │   ├── roomController.js
│       │   ├── stickyNoteController.js
│       │   └── voteController.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── validate.js
│       ├── middlewares/
│       │   ├── errorHandler.js
│       │   └── rateLimiter.js
│       ├── models/
│       │   ├── index.js
│       │   ├── AuditLog.js
│       │   ├── BoardElement.js
│       │   ├── Chat.js
│       │   ├── Room.js
│       │   ├── RoomParticipant.js
│       │   ├── StickyNote.js
│       │   ├── User.js
│       │   └── Vote.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── chatRoutes.js
│       │   ├── rooms.js
│       │   ├── stickyNoteRoutes.js
│       │   ├── users.js
│       │   └── voteRoutes.js
│       ├── services/
│       │   ├── boardService.js
│       │   └── roomService.js
│       ├── utils/
│       │   ├── auditLogger.js
│       │   └── jwt.js
│       └── app.js
│
├── database/
│   └── migrations/           V1–V8 SQL files
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

---

*Built with React 18 · tldraw · Socket.io 4 · Express 4 · PostgreSQL 16 · Redis 7*
