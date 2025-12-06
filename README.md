# CreatorSight (Iteration 1 Foundation)

CreatorSight is a local Next.js app for analyzing YouTube videos (mocked for now). This iteration sets up the base project with Tailwind, Prisma + SQLite, and landing copy for the upcoming pipeline.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Prisma + SQLite (file-based)
- ESLint + Prettier
- Vitest for unit tests, Recharts for radar visualization

## Getting started
1) Prerequisites: Node 18+ (tested on Node 24), npm.
2) Install dependencies: `npm install`
2) Copy envs: `cp .env.example .env` (adjust if you prefer a different DB path). The default `ANALYSIS_MODE=mock` keeps everything local; switch to `gemini` when you have API keys set.
3) Run the initial migration (keeps Prisma cache inside the repo):  
   - `npm run prisma:migrate -- --name init`  
   - or `CACHE_DIR=.prisma/cache npx prisma migrate dev --name init`
4) (Optional) Seed reference creators: `npm run seed`
5) Start the app: `npm run dev` then open http://localhost:3000.

## Useful scripts
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run format` / `npm run format:fix`
- `npm run prisma:migrate -- --name <label>` (SQLite)
- `npm run prisma:studio` (opens Prisma Studio)
- `npm run seed` (populate reference creators + fingerprints)
- `npm run test` (Vitest)

## Notes
- The analysis is mock/deterministic for this iteration (no Gemini or YouTube APIs yet).
- `/` lets you paste a YouTube URL, calls the mock analysis API, and shows archetype, radar chart (with reference average), nearest references, and simple domain tabs.
- Prisma models include core entities; more detail will arrive in later iterations.

## Analysis modes
- `mock` (default): deterministic, offline-friendly analysis. Works without any external API keys.
- `gemini`: enables real Gemini + YouTube Data API analysis (coming in Iteration 2). Requires `GEMINI_API_KEY` and `YOUTUBE_API_KEY`; requests fail fast with a `MisconfiguredEnvironment` error if keys are missing.
