# CreatorSight (Iteration 1 Foundation)

CreatorSight is a local Next.js app for analyzing YouTube videos (mocked for now). This iteration sets up the base project with Tailwind, Prisma + SQLite, and landing copy for the upcoming pipeline.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Prisma + SQLite (file-based)
- ESLint + Prettier

## Getting started
1) Install dependencies: `npm install`
2) Copy envs: `cp .env.example .env` (adjust if you prefer a different DB path).
3) Run the initial migration (keeps Prisma cache inside the repo):  
   - `npm run prisma:migrate -- --name init`  
   - or `CACHE_DIR=.prisma/cache npx prisma migrate dev --name init`
4) Start the app: `npm run dev` then open http://localhost:3000.

## Useful scripts
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run format` / `npm run format:fix`
- `npm run prisma:migrate -- --name <label>` (SQLite)
- `npm run prisma:studio` (opens Prisma Studio)

## Notes
- `/` currently shows the CreatorSight landing stub: “Paste a YouTube URL to get a creative fingerprint (coming soon).”
- Prisma models are placeholder-only for now; later tasks will add real fields and relations.
