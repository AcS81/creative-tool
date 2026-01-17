import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const startWorker = async () => {
  const { runAnalysisWorker } = await import("../src/lib/analysis/jobs");
  await runAnalysisWorker();
};

void startWorker().catch((error) => {
  console.error("Failed to start analysis worker", error);
  process.exit(1);
});
