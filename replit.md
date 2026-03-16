# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Resume Analyzer web app that uses OpenAI to analyze resumes against job descriptions.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── resume-analyzer/    # React + Vite frontend (mounted at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server integration
│   └── integrations-openai-ai-react/   # OpenAI React integration
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `resumes` — stores user resumes (id, name, content, fileName, createdAt)
- `analyses` — stores analysis results (id, resumeId, jobDescription, matchScore, matchedSkills, missingSkills, suggestions, summary, createdAt)

## API Routes

All routes under `/api`:

- `GET /api/healthz` — health check
- `GET /api/resumes` — list all resumes
- `POST /api/resumes` — create a resume `{ name, content, fileName }`
- `GET /api/resumes/:id` — get one resume
- `DELETE /api/resumes/:id` — delete a resume
- `POST /api/analysis` — analyze resume `{ resumeId, jobDescription }` → returns `{ matchScore, matchedSkills, missingSkills, suggestions, summary, analysisId }`
- `GET /api/analysis/history/:resumeId` — get analysis history for a resume

## Key Features

1. Upload resume (PDF or TXT file, or paste text)
2. Paste a job description
3. AI match score (0-100%)
4. Matched skills (green) and missing skills (orange)
5. Improvement suggestions (numbered list)
6. Analysis summary
7. Resume history and switching between saved resumes

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Codegen

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

## Database Migration

Push schema: `pnpm --filter @workspace/db run push`
