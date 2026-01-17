# CreatorSight UI Tokens (Iteration 8)

This token set gives the UI a YouTube-forward vibe (primary red) with amber warmth and minimal blue support. Tokens live in `src/app/globals.css` and are wired into Tailwind via the `@theme inline` block.

## Palette
- `--background` `#fff7f2` – warm canvas.
- `--surface` `#ffffff`, `--surface-strong` `#fff1e3` – cards and panels.
- `--foreground` `#0f172a`; `--muted` `#52586d`; `--muted-strong` `#1e2535`.
- `--border` `#e3d6c8` – default stroke for cards, inputs, pills.
- `--accent` `#ff2f45` (YouTube red), `--accent-amber` `#f6c344` (status/highlight), `--accent-blue` `#1f67d6` (sparingly for contrast).
- `--accent-foreground` `#fff7f9`; `--accent-contrast` `#2e0b14`.
- Signal colors: `--signal-blue` `#1d4ed8`, `--signal-amber` `#f8aa1a`.

## Typography
- Headline/display: **Sora** (500/600/700) → fallback to Inter/System (`--font-display`).
- Body: **Inter** (400–700) → system (`--font-body`).
- Mono: `--font-mono` uses `SFMono-Regular, Menlo, monospace`.
- Sizes: `--text-xs 12px`, `--text-sm 14px`, `--text-base 16px`, `--text-md 18px`, `--text-lg 22px`, `--text-xl 30px`.

## Spacing, Radius, Shadows
- Spacing scale (px): `4, 8, 12, 16, 20, 24, 28, 32`.
- Radius: `--radius-lg 18px`, `--radius-md 12px`, `--radius-sm 10px`.
- Shadows: `--shadow-soft 0 22px 54px rgba(15,23,42,0.10)`, `--shadow-strong 0 18px 48px rgba(255,47,69,0.20)`.

## Component Hooks
- `cs-button`: red→blue gradient primary; focus ring adds amber glow.
- `cs-button-secondary`: neutral surface with warm gradient tint; accent border on hover/focus.
- `cs-input`: softly tinted surface with red/blue focus halo.
- `cs-card` / `cs-panel`: gradient washes on light surfaces with shared border/shadow tokens.
- `cs-pill` and `cs-badge`: rounded pills using border token and gradient fills (amber highlights for badge text).
