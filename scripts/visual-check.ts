import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function main() {
  const outDir = path.join(process.cwd(), "artifacts", "screenshots");
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const base = process.env.CREATORSIGHT_BASE_URL ?? "http://localhost:3000";

  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "landing.png"), fullPage: true });

  const sampleButton = page.getByRole("button", { name: /try a sample/i });
  if (await sampleButton.isVisible()) {
    await sampleButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, "analysis-overview.png"), fullPage: true });
  }

  const performanceTab = page.getByRole("tab", { name: /performance/i });
  if (await performanceTab.isVisible()) {
    await performanceTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, "performance.png"), fullPage: true });
  }

  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
