import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startWebHarness, harnessResources } from "./web-server.mjs";
import { checkWebServer } from "./web-server-check.mjs";
import { findChromium, runChromiumChecks } from "./chromium-runner.mjs";

/** Observable browser entry point; missing browser skips, explicit invalid paths fail, service-absent compiler cases skip. */
export async function webChecks({ servicePath, browserPath } = {}) {
  const browser = findChromium(browserPath);
  const logs = fileURLToPath(new URL("../.build/logs/", import.meta.url)); mkdirSync(logs, { recursive: true });
  if (!browser) {
    if (servicePath) await harnessResources(servicePath); // Explicit bad service inputs must fail, even without a browser.
    const report = { schema: 1, status: "skipped", passed: 0, failed: 0, skipped: 9, actualCompilerPasses: 0,
      reason: "Provision Chromium or select --browser explicitly; no automatic installation" };
    writeFileSync(resolve(logs, "web-results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report)); return;
  }
  const host = await startWebHarness({ servicePath });
  try {
    await checkWebServer(host);
    const report = await runChromiumChecks(browser, host);
    writeFileSync(resolve(logs, "web-results.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(resolve(logs, host.serviceAvailable ? "web-results-present.json" : "web-results-absent.json"), JSON.stringify(report, null, 2) + "\n");
    for (const item of report.cases) console.log(JSON.stringify(item));
    console.log(JSON.stringify({ status: report.failed ? "failed" : "browser_checks_completed", passed: report.passed, failed: report.failed,
      skipped: report.skipped, actualCompilerPasses: report.actualCompilerPasses, browser: report.browser.product }));
    if (report.failed || report.externalRequests.length || report.protocolFaults.length) throw new Error("Browser checks failed; see .build/logs/web-results.json");
  } catch (error) {
    writeFileSync(resolve(logs, "web-failure.json"), JSON.stringify({ schema: 1, status: "failed", message: String(error.message).slice(0, 4096) }, null, 2) + "\n");
    throw error;
  } finally { await host.close(); }
}
