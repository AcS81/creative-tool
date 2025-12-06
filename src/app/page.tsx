export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <div className="w-full rounded-lg border border-border bg-surface/80 p-10 shadow-[var(--shadow-soft)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          CreatorSight
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">
          Paste a YouTube URL to get a creative fingerprint (coming soon).
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          This locally runnable MVP will validate URLs, run a mock analysis pipeline, and
          show an overview radar of your style. We&apos;re wiring up the experience now,
          starting from this foundation.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="rounded-md border border-border bg-white/70 p-6 shadow-sm">
            <label className="block text-sm font-medium text-muted" htmlFor="url">
              YouTube URL (disabled while we finish the pipeline)
            </label>
            <input
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-md border border-border bg-white/60 px-4 py-3 text-base text-foreground shadow-inner outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
              disabled
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                Overview radar
              </span>
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                Archetype card
              </span>
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                Nearest neighbours
              </span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-white/70 p-6 shadow-sm">
            <p className="text-sm font-semibold text-muted">What to expect</p>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              <li>✅ Next.js 16 + App Router + Tailwind 4 baseline</li>
              <li>✅ Prisma + SQLite ready for migrations</li>
              <li>✅ ESLint + Prettier tooling</li>
              <li>🚧 Mock analysis pipeline landing next</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
