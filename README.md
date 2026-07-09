# SketchTrude

Next.js web application and PWA for architectural sketching — migrated from the HTML PWA with Supabase auth, Postgres metadata, and cloud storage.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in Supabase credentials.
2. Run SQL migrations in `supabase/migrations/` via the Supabase SQL editor.
3. Create storage buckets (or run `002_storage_buckets.sql`).
4. Enable email/password auth in Supabase dashboard.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Deploy to Vercel with the same environment variables. Set `NEXT_PUBLIC_APP_URL` to your production URL.

## Project structure

- `src/app/` — Next.js routes (landing, auth, dashboard, studio)
- `src/components/` — React UI components
- `src/engine/` — Canvas engine (modularized from legacy PWA)
- `public/engine/` — Legacy engine runtime bundle
- `supabase/migrations/` — Database schema and storage policies
