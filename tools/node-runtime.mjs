import { Worker } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { CompilerController } from "../runtime/controller.js";

/** Local developer adapter; web consumers use the portable controller's module-worker default. */
export function createNodeCompiler() {
  return new CompilerController({ workerFactory: () => {
    const worker = new Worker(new URL("./node-worker.mjs", import.meta.url));
    return {
      postMessage: (message, transfers) => worker.postMessage(message, transfers), terminate: () => worker.terminate(),
      listen(message, error, exit) {
        worker.on("message", message); worker.on("error", error); worker.on("messageerror", error); worker.on("exit", exit);
        return () => { worker.off("message", message); worker.off("error", error); worker.off("messageerror", error); worker.off("exit", exit); };
      },
    };
  } });
}

/** Reads this package's tiny pinned recipe; an explicit bounded service reader is supplied by the CLI/tests. */
export function localResources(serviceBytes) {
  const root = new URL("../recipes/nano_rp2040_connect/", import.meta.url);
  return { serviceBytes, recipeManifest: new Uint8Array(readFileSync(new URL("manifest.json", root))),
    recipeAssets: Object.fromEntries(["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"]
      .map(path => [path, new Uint8Array(readFileSync(new URL(path, root)))])) };
}
