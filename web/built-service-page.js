/** Fixed maintenance entry point; a native host keeps the page active by awaiting this promise explicitly. */
globalThis.firmingoHarnessReady = Promise.resolve();
globalThis.firmingoRunOwnedChecks = async () => {
  const { runBuiltWebChecks } = await import("./built-service-checks.js");
  return JSON.stringify(await runBuiltWebChecks({ onCase: item => {
    globalThis.webkit?.messageHandlers?.firmingoBuiltService?.postMessage(JSON.stringify({ schema: 1, progress: item }));
    if (item.outcome === "failed") throw new Error(item.name + ": " + item.message);
  } }));
};
