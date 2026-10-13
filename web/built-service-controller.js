/** Maintenance worker lifetime only; production asset pins and compiler controller are never replaced. */
export class BuiltServiceController {
  #active = null;
  #sequence = 0;
  /** Admits one job, correlates events, and terminates before settling every terminal result. */
  run(config, { mode = "all", signal, timeout = 60000, compilationTimeout, onPhase = () => {}, corruptRecipe = false } = {}) {
    const failure = code => Object.assign(new Error(code), { code });
    if (this.#active) return Promise.reject(failure("busy"));
    if (signal?.aborted) return Promise.reject(failure("cancelled"));
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60000
        || (compilationTimeout !== undefined && (!Number.isInteger(compilationTimeout) || compilationTimeout < 1 || compilationTimeout > 60000)))
      return Promise.reject(failure("invalid_deadline"));
    return new Promise((resolve, reject) => {
      const id = ++this.#sequence;
      const worker = new Worker("/web/built-service-worker.js", { type: "module" });
      let timer, compilationTimer;
      const finish = (error, result) => {
        if (this.#active !== id) return;
        this.#active = null; clearTimeout(timer); clearTimeout(compilationTimer);
        signal?.removeEventListener("abort", cancel);
        worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate();
        error ? reject(error) : resolve(result);
      };
      const cancel = () => finish(failure("cancelled"));
      this.#active = id;
      signal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => finish(failure("timed_out")), timeout);
      worker.onerror = worker.onmessageerror = () => finish(failure("worker_failed"));
      worker.onmessage = event => {
        if (this.#active !== id) return;
        const message = event.data;
        if (message?.id !== id) { finish(failure("uncorrelated_worker_result")); return; }
        if (message.phase) {
          if (!["compiling", "linking"].includes(message.phase)) { finish(failure("invalid_worker_phase")); return; }
          if (message.phase === "compiling" && compilationTimeout !== undefined && compilationTimer === undefined)
            compilationTimer = setTimeout(() => finish(failure("timed_out")), compilationTimeout);
          try { onPhase(message.phase); } catch (error) { finish(error); }
        } else if (message.error) finish(Object.assign(new Error(message.error.message), { code: message.error.code }));
        else if (message.result?.builds?.length) finish(null, message.result);
        else finish(failure("invalid_worker_result"));
      };
      try { worker.postMessage({ id, config, mode, corruptRecipe }); } catch (error) { finish(error); }
    });
  }
}
