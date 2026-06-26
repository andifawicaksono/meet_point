PROJECT: MeetPoint - Real-Time Collaborative Whiteboard
Tech Stack:
  Frontend  : React 18 + Vite + Tailwind CSS + JavaScript
  Realtime  : Socket.io (client + server)
  Backend   : Node.js + Express
  Canvas    : Tldraw SDK
  Export    : html2canvas + jsPDF
  Database  : PostgreSQL
  Cache     : Redis
  Auth      : JWT + Refresh Token

Performance : 500 concurrent users, 100 rooms, 60 FPS
Security    : JWT, RBAC, CSRF, Rate Limiting, Audit Logs

Features:
  1. Room Meeting (create, join via link, participant list)
  2. Realtime Whiteboard (draw, text, erase, color, brush size)
  3. Sticky Notes (Idea, Problem, Solution, Action Item)
  4. Realtime Cursor (see other users' mouse position)
  5. Chat Room (chat, mention, reply)
  6. Voting (star rating per idea)
  7. Export (PDF, PNG, JPG)