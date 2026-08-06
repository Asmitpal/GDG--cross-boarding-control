# Cross-Boarding Automation System

Enterprise-grade, event-driven employee cross-boarding automation built with Node.js, PostgreSQL, Redis, React, and WebSockets.

## Stack

| Layer | Technology |
|---|---|
| **Backend API** | Node.js · TypeScript · Express |
| **Database** | PostgreSQL 16 · Prisma ORM |
| **Queue / Cache** | Redis 7 · BullMQ |
| **Real-time** | Socket.io (WebSockets) |
| **Frontend** | React 18 · TypeScript · Vite · CSS Modules |
| **Validation** | Zod |
| **Integrations** | Slack Block Kit · Okta · GitHub |

---

## Quick Start (Docker)

```bash
# 1. Copy env
cp .env.example .env

# 2. Boot services
docker compose up -d

# 3. Install backend + run migrations
cd packages/backend
npm install
npx prisma migrate dev --name init
npm run db:seed

# 4. Install frontend (new terminal)
cd packages/frontend
npm install

# 5. Open app
open http://localhost:5173         # Frontend (Vite dev server)
open http://localhost:3001/health  # Backend health check
```

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7

```bash
# Install all dependencies
npm install

# Backend
cd packages/backend
cp .env.example .env        # Edit DATABASE_URL / REDIS_URL
npx prisma migrate dev
tsx prisma/seed.ts           # Seed demo hires
npm run dev                  # Starts on :3001

# Frontend (new terminal)
cd packages/frontend
npm run dev                  # Starts on :5173
```

---

## API Reference

All endpoints require `X-API-Key: <your-key>` header.

### Hires
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/hires` | Create hire + generate task graph |
| `GET`  | `/api/v1/hires` | List hires with readiness metrics |
| `GET`  | `/api/v1/hires/:id` | Full hire detail with grouped tasks |

### Approvals
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/hires/:id/approval` | Process approve/reject decision |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| `PATCH` | `/api/v1/tasks/:id` | Toggle task completion |

### Escalations & Rules
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/escalations` | SLA breach feed |
| `GET` | `/api/v1/rules` | Fetch rule config |
| `PUT` | `/api/v1/rules` | Update rule config |

### Webhooks
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/webhooks/hris` | HRIS hire.created trigger (Workday/BambooHR) |

---

## WebSocket Events

Connect via Socket.io to receive real-time updates:

| Event | Payload | Description |
|---|---|---|
| `hire:updated` | `{ hireId, status }` | Hire status changed (approval / completion) |
| `task:escalated` | `{ hireId, taskId, taskLabel, owner, overdueHours }` | SLA breach detected |

---

## Background Workers

| Worker | Schedule | Description |
|---|---|---|
| `SlaMonitorWorker` | Every 15 min | Detects overdue tasks, flags BLOCKED, creates escalations |
| `SlackNotifier` | On-demand | Sends Block Kit messages for approvals + SLA breaches |
| `IdpProvisionWorker` | On-demand | Triggers Okta/GitHub provisioning after approval |

---

## Environment Variables

See `.env.example` for a full annotated list.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `API_KEY` — Shared secret for `X-API-Key` header
- `SLACK_WEBHOOK_URL` — Leave blank to use console.log mock mode

---

## Project Structure

```
packages/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Data models
│   │   └── seed.ts           # Demo data
│   └── src/
│       ├── index.ts          # App entry + Socket.io
│       ├── config.ts         # Typed env config
│       ├── db.ts             # Prisma client
│       ├── routes/           # Express routers
│       ├── services/         # Business logic
│       ├── workers/          # BullMQ workers
│       ├── integrations/     # Slack, Okta, GitHub
│       ├── middleware/       # Auth, rate limiting
│       └── schemas/          # Zod validation
└── frontend/
    └── src/
        ├── api/              # Axios client + React Query hooks
        ├── socket/           # Socket.io hook
        ├── components/       # Reusable UI components
        ├── views/            # Page-level views
        └── styles/           # CSS design tokens
```
