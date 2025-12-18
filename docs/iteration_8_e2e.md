# Iteration 8 UI E2E Checklist (desktop + mobile)

Use mock mode (`ANALYSIS_MODE=mock`) unless otherwise noted.

## Desktop (1440x900)
- Landing hero shows red/amber/blue theming, primary/secondary CTAs, and “How it works” strip.
- Submit a valid YouTube URL (or sample) → loading skeleton shows; overview renders radar, diagnostics chips, alignment/load timelines, and tabs are keyboard-navigable.
- Voice tab shows radar + pace mini-chart + callout; Delivery shows relational map + humor timing chart; Narrative/Visual/Editing timelines show silence spans; Performance tab renders mock metrics/retention chart.
- Alignment & Load panel shows interactive timelines; hover markers/tooltips visible; glossary link present.
- Recent analyses card shows items or empty/error state messaging.

## Mobile (iPhone 12/Chrome device toolbar)
- Hero stacks vertically; CTAs fit viewport; form grid stacks; status chips wrap.
- Tabs are reachable via swipe/keyboard; panels read correctly with screen reader (aria labels on radars).
- Alignment & Load and domain timelines remain readable; cards maintain padding and scroll without overflow.

## Accessibility/state checks
- Tablist supports arrow-key navigation and indicates active tab; focus ring visible.
- Form errors/analysis errors announce via aria-live; loading skeleton uses polite status.
- Diagnostics chips render when advanced metrics are missing/defaulted or fallback occurs; hidden in pure mock unless flagged.

## Visual regression (optional)
- Start dev server (`npm run dev`), then `npm run visual:check` (requires `npm install` to fetch Playwright). Screenshots saved to `artifacts/screenshots` for landing, sample overview, and performance.
