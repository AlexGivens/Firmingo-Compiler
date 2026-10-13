import { rmSync } from "node:fs";

/** Tracks process exit separately from closure of inherited stdio, including browser helper writers. */
export function trackBrowser(browser, signal = name => {
  if (!browser.pid) return;
  try {
    if (process.platform === "win32") browser.kill(name);
    else process.kill(-browser.pid, name); // Only the dedicated group created for this isolated browser.
  } catch (error) { if (error.code !== "ESRCH") throw error; }
}) {
  let closed = false;
  const completion = new Promise(resolve => browser.once("close", () => { closed = true; resolve(); }));
  // Spawn failures are reported by startup, but must not become an unhandled event during disposal.
  browser.on("error", () => {});
  return { get closed() { return closed; }, completion, signal(name) { if (!closed) signal(name); } };
}

function waitForClose(lifetime, milliseconds) {
  if (lifetime.closed) return Promise.resolve(true);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), milliseconds);
    lifetime.completion.then(() => { clearTimeout(timer); resolve(true); });
  });
}

/** Gives orderly shutdown time before escalating; profile deletion never substitutes for process cleanup. */
export async function closeBrowser(lifetime, requestClose, { graceMilliseconds = 3000, terminateMilliseconds = 1000, killMilliseconds = 1000 } = {}) {
  if (requestClose && !lifetime.closed) {
    try { await requestClose(); } catch {} // A closed protocol is normal; bounded process cleanup still follows.
    if (await waitForClose(lifetime, graceMilliseconds)) return;
  }
  if (lifetime.closed) return;
  lifetime.signal("SIGTERM");
  if (await waitForClose(lifetime, terminateMilliseconds)) return;
  lifetime.signal("SIGKILL");
  if (!await waitForClose(lifetime, killMilliseconds)) throw new Error("Isolated browser did not close after termination; profile retained");
}

/** Bounded retries handle transient helper/filesystem races; permanent failures remain errors. */
export function removeBrowserProfile(profile) {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
