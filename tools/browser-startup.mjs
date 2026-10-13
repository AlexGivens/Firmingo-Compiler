/** One event-driven readiness wait with bounded time, cleanup and no automatic retry. */
export function waitForBrowserEndpoint(browser, { diagnostic, deadlineMilliseconds = 30000, record = () => {} }) {
  if (typeof diagnostic !== "function" || !Number.isInteger(deadlineMilliseconds)
      || deadlineMilliseconds < 1 || deadlineMilliseconds > 30000) throw new Error("Invalid bounded browser startup options");
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      browser.stderr.off("data", output); browser.stdout?.off("data", output);
      browser.off("error", failed); browser.off("exit", exited);
    };
    const finish = (status, error, endpoint) => {
      cleanup();
      try { record({ status, deadlineMilliseconds, endpointFound: Boolean(endpoint) }); }
      catch (failure) { reject(failure); return; }
      if (error) reject(error); else resolve(endpoint);
    };
    const output = () => {
      const match = /DevTools listening on (ws:\/\/127\.0\.0\.1:[0-9]+\/devtools\/browser\/[A-Za-z0-9-]+)/.exec(diagnostic());
      if (match) finish("ready", null, match[1]);
    };
    const failed = error => finish("failed", error instanceof Error ? error : new Error(String(error)));
    const exited = (code, signal) => finish("exited", new Error(`Headless browser exited during startup (${code}/${signal}): ${diagnostic()}`));
    const timer = setTimeout(() => finish("timed_out", new Error("Headless browser startup deadline exceeded: " + diagnostic())), deadlineMilliseconds);
    browser.stderr.on("data", output); browser.stdout?.on("data", output);
    browser.once("error", failed); browser.once("exit", exited); output();
  });
}
