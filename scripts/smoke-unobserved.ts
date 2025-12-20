import { buildDefaultAdvancedMetrics } from "../src/lib/analysis/fingerprint/defaults";

// Simple smoke check to ensure we can read advanced metrics even when unobserved.
// Usage: tsx scripts/smoke-unobserved.ts

const main = () => {
  const adv = buildDefaultAdvancedMetrics();
  const sections = Object.entries(adv).map(([section, metrics]) => {
    const observed = Object.values(metrics ?? {}).some((m) => m.observed);
    return `${section}: observed=${observed}`;
  });
  console.log("Advanced metrics smoke (expected all false/unobserved):");
  sections.forEach((line) => console.log(` - ${line}`));
};

main();
