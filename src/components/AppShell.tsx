import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-amber-400 text-sm font-bold text-white shadow-lg shadow-accent/30">
              CS
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">CreatorSight</p>
              <p className="text-xs text-muted">Creative x-ray for YouTube</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="cs-pill text-[12px] font-semibold uppercase tracking-[0.18em]"
              scroll={false}
            >
              New analysis
            </Link>
            <a
              className="cs-pill text-[12px] font-semibold uppercase tracking-[0.18em] hover:border-accent hover:text-foreground"
              href="#analysis"
            >
              Jump to form
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
