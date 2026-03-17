# Resume Matcher (Monorepo)

Resume Analyzer web app that compares a resume against a job description and returns an evidence-based fit score with breakdowns and suggestions.

## Apps

- **Backend API**: `artifacts/api-server` (Express, `/api/*`)
- **Frontend**: `artifacts/resume-analyzer` (React + Vite)

## Prerequisites

- **Node.js**: 22+ recommended
- **pnpm**: required (the repo enforces it)
- **Postgres**: local Postgres or hosted (e.g. Supabase)
- **OpenAI-compatible API** credentials

## Install

From repo root:

```bash
pnpm install
```

## Environment variables

### Backend (`artifacts/api-server`)

See `artifacts/api-server/.env.example`.

Required:

- `PORT`
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`

Recommended:

- `CORS_ORIGIN` (comma-separated list of allowed origins, e.g. your Vercel URL)

### Frontend (`artifacts/resume-analyzer`)

See `artifacts/resume-analyzer/.env.example`.

- `VITE_API_BASE_URL` (recommended for production)
  - Example: `https://your-railway-service.up.railway.app`
  - If not set, the frontend calls relative `/api/*` URLs (works when frontend+backend share an origin or you proxy locally).

## Database migrations (Drizzle)

From repo root (ensure `DATABASE_URL` is set in the shell first):

```bash
pnpm --filter @workspace/db run push
```

## Run locally

### 1) Start backend

In one terminal (set backend env vars first):

```bash
cd artifacts/api-server
pnpm run dev
```

Health check: `GET /api/healthz`

### 2) Start frontend

In a second terminal:

```bash
cd artifacts/resume-analyzer
pnpm run dev
```

## Build (production)

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/resume-analyzer run build
```

Backend start (after build):

```bash
pnpm --filter @workspace/api-server run start
```

## Deployment notes (high level)

- **DB**: Supabase Postgres → set `DATABASE_URL`
- **Backend**: Railway → build `@workspace/api-server`, start `pnpm --filter @workspace/api-server run start`
- **Frontend**: Vercel → build `@workspace/resume-analyzer`, set `VITE_API_BASE_URL` to Railway URL

