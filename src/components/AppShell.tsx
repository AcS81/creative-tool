import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-indigo-500 text-sm font-bold text-white shadow-lg shadow-accent/30">
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
      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-12">{children}</main>
    </div>
  );
}
