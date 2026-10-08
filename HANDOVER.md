# SketchTrude — Developer Handover Document

> **Last updated:** October 2026  
> **Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Tailwind CSS v4 · Vitest · PWA (Serwist)

---

## 1. What Is This?

**SketchTrude** is a browser-based **architectural sketching Progressive Web App (PWA)** built by NM Studio. It lets users create projects, sketch on layers, add dimensions, scale measurements, import PDFs as trace underlays, model 3D massing, and export their work — all with offline-first support and cloud sync via Supabase.

The app is a full Next.js migration of what was originally a standalone HTML/JS PWA. The legacy engine has been kept as an **iframe-isolated IIFE bundle** (`public/engine/studio.js`) and the modern Next.js shell communicates with it via `postMessage`.

---

## 2. Tech Stack at a Glance

| Concern | Technology |
|---|---|
| Framework | Next.js 16.2.10 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Auth & DB | Supabase (email/password, Postgres, RLS) |
| File Storage | Supabase Storage |
| Local offline cache | IndexedDB (`idb` v8) |
| Canvas engine | Custom TypeScript, esbuild-bundled to IIFE |
| PDF rendering | `pdfjs-dist` v6 |
| State management | Zustand v5 (engine side only, via `S` scope) |
| PWA / Service Worker | Serwist v9 (`@serwist/next`) |
| Testing | Vitest v3 |
| Deployment | Vercel |

---

## 3. Repository Structure

```
sketchtrude/
├── src/
│   ├── app/                     # Next.js App Router pages & API routes
│   │   ├── (auth)/              # /login, /register — public routes
│   │   ├── (protected)/         # /dashboard, /studio/[id] — auth-gated
│   │   ├── api/projects/        # REST API handlers for projects
│   │   └── layout.tsx           # Root layout (fonts, Providers)
│   │
│   ├── components/
│   │   ├── auth/                # LoginForm, RegisterForm
│   │   ├── dashboard/           # DashboardClient, NewProjectModal, ProjectThumbnail
│   │   ├── landing/             # Hero, Features, SiteHeader
│   │   ├── pwa/                 # InstallPrompt
│   │   └── studio/              # StudioApp (iframe host), StudioPageClient, StudioErrorBoundary
│   │
│   ├── engine/                  # Source-of-truth for the canvas engine (compiled by esbuild)
│   │   ├── app/                 # Core subsystems (boot, state, layers, viewport, etc.)
│   │   ├── brushes/             # Stroke engine, brush library & presets
│   │   ├── document/            # Serialize/deserialize project documents
│   │   ├── interaction/         # Selection manager, shape/placed adapters
│   │   ├── layers/              # Layer engine, transform, snap, coordinates
│   │   └── rendering/           # Tile store, image pyramid renderer, vector stroke store
│   │
│   ├── features/projects/       # Feature-sliced domain for projects
│   │   ├── application/         # ProjectSession, load/save/recovery controllers
│   │   ├── domain/              # Schema (Zod), types, migrations, errors, save-status
│   │   ├── hooks/               # use-project-loader, use-project-autosave, use-project-save-status
│   │   └── infrastructure/      # ProjectApiRepository (cloud), ProjectIndexedDbRepository (local)
│   │
│   ├── persistence/
│   │   ├── autosave/            # AutosaveManager (debounce), SaveQueue (single-flight)
│   │   └── recovery/            # RecoveryManager, RecoveryPolicy
│   │
│   ├── lib/
│   │   ├── supabase/            # client.ts, server.ts, middleware.ts, admin.ts
│   │   ├── persistence/         # local.ts, sync.ts, thumbnails.ts
│   │   ├── projects/            # document.ts, thumbnails.ts, pending-canvas-source.ts
│   │   └── storage/             # IndexedDB wrappers
│   │
│   ├── shared/logging/          # ProjectPersistenceLogger
│   ├── middleware.ts             # Supabase session refresh + auth route guard
│   └── sw.ts                    # Service worker entry (Serwist)
│
├── public/engine/               # Built engine artifacts (DO NOT EDIT — auto-generated)
│   ├── studio.js                # Bundled canvas engine (IIFE)
│   ├── studio-frame.html        # iframe shell that loads studio.js
│   └── pdf.worker.min.mjs       # PDF.js worker
│
├── scripts/
│   ├── build-engine.mjs         # esbuild pipeline: src/engine → public/engine/studio.js
│   └── convert-engine.mjs       # Legacy migration helpers (historical)
│
├── supabase/migrations/         # SQL migration files (run in order)
│   ├── 001_initial_schema.sql
│   ├── 002_storage_buckets.sql
│   └── 003_document_revision.sql
│
└── tests/                       # Vitest unit tests
```

> [!IMPORTANT]
> **Never edit `public/engine/studio.js` directly.** It's auto-generated from `src/engine/`. Make changes in `src/engine/` and rebuild.

---

## 4. First-Time Setup

### 4.1 Prerequisites

- Node.js 20+ (LTS recommended)
- A Supabase project (free tier works)

### 4.2 Environment Variables

Create `.env.local` in the repo root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key     # server-only, not exposed to browser
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4.3 Supabase Database Setup

Run the SQL migrations **in order** in the Supabase SQL editor:

1. `supabase/migrations/001_initial_schema.sql` — tables: `profiles`, `projects`, `layers`, `exports`, `user_assets`
2. `supabase/migrations/002_storage_buckets.sql` — creates 4 storage buckets + RLS policies
3. `supabase/migrations/003_document_revision.sql` — adds `document_revision` column for optimistic concurrency

Then in the Supabase dashboard:
- **Authentication → Providers → Email** — enable Email/Password auth.

### 4.4 Install & Run

```bash
npm install
npm run dev       # starts both the engine watcher AND Next.js dev server concurrently
```

Open [http://localhost:3000](http://localhost:3000).

> [!TIP]
> `npm run dev` runs `concurrently` with two processes: `dev:engine` (esbuild watch) and `dev:next` (Next.js). Both must be running for live engine changes to reflect.

---

## 5. Development Workflow

### 5.1 Working on the Next.js App (UI, API routes, auth)

Normal Next.js App Router patterns. Files live in `src/app/`, `src/components/`, `src/lib/`. Server Components are default; add `"use client"` only where needed.

### 5.2 Working on the Canvas Engine

All engine source lives in `src/engine/`. After editing:

- In dev mode: changes are picked up automatically by the esbuild watcher (`dev:engine`).
- For production: run `npm run build:engine` (this is called automatically by `prebuild`).

The engine is bundled as an **IIFE** (self-contained, no ESM imports) and served as a static file at `/engine/studio.js`, loaded inside an `<iframe>` by `StudioApp`.

**Key engine files:**

| File | Purpose |
|---|---|
| `src/engine/app/boot.ts` | Entry point — calls all `init*()` subsystems in order |
| `src/engine/app/scope.ts` | Global `S` singleton — the engine's shared state/scope object |
| `src/engine/app/host-bridge.ts` | `postMessage` API exposed to the Next.js host |
| `src/engine/app/state.ts` / `state-init.ts` | Application state |
| `src/engine/app/layers.ts` | Layer management |
| `src/engine/app/persistence.ts` | Local save/load within the engine |
| `src/engine/brushes/stroke-engine.ts` | Core stroke rendering |

### 5.3 The iframe / postMessage Contract

The studio page (`/studio/[id]`) renders an `<iframe>` pointing to `/engine/studio-frame.html`. Communication is entirely via `window.postMessage`:

**From engine → host (Next.js):**

| Message type | Meaning |
|---|---|
| `sketchtrude-engine-ready` | Engine booted; host can now call `importProjectDocument` |
| `sketchtrude-content-ready` | Project data has been applied to the canvas |
| `sketchtrude-save-done` | A `sketchtrude-save` request completed |
| `sketchtrude-mode-loading` | Switching between Draw/Navigate/3D modes |
| `sketchtrude-conflict-resolve` | User resolved a cloud vs local conflict |
| `sketchtrude-canvas-source-import-result` | PDF/image import succeeded or failed |

**From host → engine:**

| Message type | Meaning |
|---|---|
| `sketchtrude-import-project-document` | Push a loaded document into the engine |
| `sketchtrude-save` | Tell engine to flush to local storage |
| `sketchtrude-save-status` | Push save status label into engine UI |
| `sketchtrude-import-canvas-source` | Send a PDF/image file to import |

---

## 6. Persistence Architecture

This is the most complex part of the codebase. There are **two persistence layers**:

### 6.1 Local (IndexedDB)

- Managed by `ProjectIndexedDbRepository` (`src/features/projects/infrastructure/project-indexeddb-repository.ts`)
- Debounced at **400ms** after any canvas mutation
- Acts as crash recovery / offline cache
- Uses the `idb` library

### 6.2 Cloud (Supabase)

- Managed by `ProjectApiRepository` (`src/features/projects/infrastructure/project-api-repository.ts`)
- Debounced at **2000ms** after mutations
- Calls the Next.js API routes (`/api/projects/[id]/document`, `/api/projects/[id]/layers`, etc.)
- Uses **optimistic concurrency** via `document_revision` (migration 003)

### 6.3 How They're Wired Together

```
StudioApp (React)
  └── useProjectLoader hook
        └── ProjectSession
              ├── ProjectLoadController   ← loads cloud, merges with local on open
              ├── ProjectSaveController   ← drives autosave
              │     └── AutosaveManager  ← debounces 400ms local / 2000ms cloud
              │           └── SaveQueue  ← single-flight, coalesces rapid saves
              └── RecoveryController     ← detects conflicts, prompts resolution
```

### 6.4 Document Schema

Validated at runtime with **Zod**. See `src/features/projects/domain/project-document-schema.ts`. When adding new fields, update `CURRENT_PROJECT_SCHEMA_VERSION` and add a migration to `project-document-migrations.ts`.

---

## 7. API Routes

All routes live under `src/app/api/projects/`. Every route:
1. Creates a Supabase server client
2. Checks `auth.getUser()` — returns 401 if not authenticated
3. Supabase RLS policies enforce ownership at the database level (defence-in-depth)

| Route | Methods | Purpose |
|---|---|---|
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/[id]` | GET, PATCH, DELETE | Read / update / delete a project |
| `/api/projects/[id]/document` | GET, PUT | Read / write full project document |
| `/api/projects/[id]/document/layer` | PUT | Update a single layer |
| `/api/projects/[id]/document/tile` | GET, PUT | Tile raster blob storage |
| `/api/projects/[id]/layers` | GET, POST | List / create layers |
| `/api/projects/[id]/assets/image` | POST | Upload image asset |
| `/api/projects/[id]/assets/pdf` | POST | Upload PDF asset |
| `/api/projects/[id]/export` | POST | Trigger / record export |
| `/api/projects/[id]/thumbnail` | PUT | Update thumbnail |

---

## 8. Database Schema (Summary)

```
profiles       → one-to-one with auth.users (auto-created on signup)
projects       → belongs to profiles; stores metadata + document_revision
layers         → belongs to projects; stores raster_url + vector_data JSONB
exports        → belongs to projects + profiles; records export file URLs
user_assets    → belongs to profiles; stencils, brushes, hatches, fill textures
```

**Storage buckets** (all private, user-scoped paths `{user_id}/{project_id}/...`):
- `layer-rasters` — canvas raster tiles per layer
- `exports` — exported PNG/PDF files
- `thumbnails` — project card thumbnails
- `user-assets` — user-uploaded stencils/textures

---

## 9. Auth Flow

1. **Middleware** (`src/middleware.ts`) refreshes the Supabase session on every request and guards `/dashboard` and `/studio/*` — redirects unauthenticated users to `/login`.
2. **Login / Register** pages (`src/app/(auth)/`) use client-side Supabase auth.
3. On signup, a Postgres trigger (`handle_new_user`) auto-creates a `profiles` row.
4. Server Components and API routes use `src/lib/supabase/server.ts`; client components use `src/lib/supabase/client.ts`.

---

## 10. PWA / Service Worker

- Managed by `@serwist/next` and configured in `next.config` (check for `withSerwist` wrapper).
- Service worker source: `src/sw.ts`
- Manifest: `public/manifest.webmanifest`
- The app works offline for previously opened projects (IndexedDB cache) and shows `/offline` when navigating to new pages without a connection.

---

## 11. Running Tests

```bash
npm test           # run all Vitest tests once
npm run test:watch # watch mode
npm run typecheck  # TypeScript check (no emit)
npm run lint       # ESLint
```

Test files are in `tests/`. They cover: autosave manager, brush engine, layer engine, interaction, PDF persistence, scale system, tile store, wall massing model, etc.

---

## 12. Building for Production

```bash
npm run build    # runs build:engine (esbuild) then next build
npm run start    # serves the production build locally
```

Deploy to Vercel with the same environment variables as `.env.local`. Set `NEXT_PUBLIC_APP_URL` to your production URL.

---

## 13. Important Conventions

> [!NOTE]
> The project uses **Next.js 16 with the App Router**. This version has breaking API differences from what most LLM training data knows. Always read the docs in `node_modules/next/dist/docs/` before touching routing or middleware.

- **Route groups**: `(auth)` and `(protected)` in `src/app/` are Next.js route groups (no URL segment).
- **`params` is a Promise** in App Router route handlers — always `await context.params`.
- **No direct DB access from the engine** — the engine iframe only talks to the Next.js host via `postMessage`; the host owns all persistence.
- **Zod schemas** are the contract for document data — validate at boundaries (API in/out).
- **RLS is the security layer** — server-side auth checks are defence-in-depth but Postgres RLS is the authoritative ownership enforcement.
- **`S` is the global engine scope** — a plain object that all engine subsystems attach methods and state to. Think of it as the engine's dependency injection container.
- **`public/engine/` is build output** — never edit those files manually.

---

## 14. Known Quirks / Gotchas

- `CLAUDE.md` just re-exports `AGENTS.md` — see `AGENTS.md` for agent/LLM rules.
- Several `scripts/phase*.mjs` files are migration helpers from the original PWA port. They are **historical artifacts** and do not need to run again.
- `src/engine/studio-body.html` is the source for `public/engine/studio-body.html` and is copied by the engine build.
- The `feedback.txt` and `build-engine-out.txt` files in the root are dev scratch files — safe to ignore.
- The `vercel.json` at the root handles any necessary Vercel-specific headers or rewrites for production.

---

## 15. Quick Command Reference

```bash
npm run dev              # Start dev server (engine watch + Next.js)
npm run dev:next         # Next.js only (no engine rebuild)
npm run dev:engine       # Engine watch only
npm run build            # Production build (engine + Next.js)
npm run build:engine     # Rebuild engine bundle only
npm test                 # Run tests
npm run test:watch       # Watch tests
npm run typecheck        # TypeScript check
npm run lint             # ESLint
```
