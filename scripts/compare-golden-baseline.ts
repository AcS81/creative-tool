import fs from "node:fs";
import path from "node:path";
import { FINGERPRINT_SCHEMA_VERSION } from "../src/lib/schemas/fingerprintContract";
import { compareGoldenSummaries, type GoldenBaseline, type GoldenSummary } from "./golden-set-baseline-utils";

const args = process.argv.slice(2);
const getArgValue = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const SUMMARY_PATH =
  getArgValue("--summary-path") ?? path.resolve(process.cwd(), "scripts/golden-set.summary.json");
const BASELINE_PATH =
  getArgValue("--baseline-path") ??
  path.resolve(process.cwd(), `scripts/golden-set.baseline.v${FINGERPRINT_SCHEMA_VERSION}.json`);

const readJson = <T,>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
};

const summary = readJson<GoldenSummary>(SUMMARY_PATH);
if (!summary) {
  console.error(`Summary not found at ${SUMMARY_PATH}. Run the golden set runner with --write-summary.`);
  process.exit(1);
}

const baseline = readJson<GoldenBaseline>(BASELINE_PATH);
if (!baseline) {
  console.error(`Baseline not found at ${BASELINE_PATH}. Run the golden set runner with --write-baseline.`);
  process.exit(1);
}

const { failures, maxCoverageDropPct } = compareGoldenSummaries(baseline, summary);
if (failures.length) {
  console.error("\n=== Golden set baseline check failed ===");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(`Max coverage drop allowed: ${maxCoverageDropPct}%`);
  process.exit(1);
}

console.log("Baseline check: PASS");
