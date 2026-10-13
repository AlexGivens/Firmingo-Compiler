# Experimental WASM runtime

The Nano managed path now performs real WASM verification, preprocessing, two
Clang compilations, LLD linking, independent ELF/FMS1 validation and packaging.
It accepts an explicitly provisioned **local development service**; no service
binary is committed, fetched or bundled. Service redistribution/reproducible-build
review and hardware qualification remain open; the [macOS Swift adapter](sdk-adapter.md) is implemented. The standard
module-worker path now passes headless Chrome 154.0.8037.93 on macOS arm64/HTTP
loopback and the explicit macOS WebKit adapter; other browsers/embedded origins remain unqualified. See
[web harness](web-harness.md) and [browser evidence](evidence/web-host.md). Ordinary tests need no compiler service or sibling checkout.

## Public host boundary

Import `CompilerController` from `src/index.js`. The default host uses a standard
ES module Worker at `runtime/browser-worker.js`; a wrapper must serve/package the
relative module graph, recipe and vendored shim under an origin/policy that permits
module workers and WASM. Required primitives include wasm32 WebAssembly,
WASI Preview 1, TextEncoder/fatal UTF-8 TextDecoder, local SHA-256, timers and
structured cloning with ArrayBuffer transfer. Event serialization also uses
`btoa`/`atob`. Web Crypto is preferred; the portable SHA-256 path handles opaque origins.
The explicit classic-worker macOS WebKit host has [separate evidence](sdk-adapter.md). No filesystem, socket, fetch, telemetry,
native compiler, Swift or WebKit bridge exists in the portable path.

```js
import { CompilerController, parseBuildRequest } from "./src/index.js";
const compiler = new CompilerController();
const result = await compiler.build(parseBuildRequest(requestJSON), {
  serviceBytes,                  // Uint8Array: exact pinned bounded service
  recipeManifest,                // Uint8Array: recipes/.../manifest.json
  recipeAssets: {
    "Recipe/Arduino.h": headerBytes,
    "Recipe/Entry.cpp": entryBytes,
    "Recipe/Module.ld": linkerBytes,
    "Sources/ManagedRecipe.js": generatorBytes,
  },
}, { signal, onEvent: event => receiveEvent(event) });
// result.bytes is a copied FMS1 capsule; no device action follows.
```

Hosts provision bytes from their trusted package context. Integrity anchors live in
`runtime/pins.js` and the existing recipe pin, not caller-supplied hashes. The service
is exactly 101196044 bytes/SHA-256
`3e2544acf7f88f6f1d5fbce34648df8eb96dfff47afa242a3e008bc8f86e2f33`, ABI two,
Clang/LLD 22.1.8. Wrong-size/corrupt resources fail; alternate services and automatic
fallbacks are unavailable. The original unbounded service is intentionally rejected.
Recipe manifest and all four resources are checked before the compiler starts.

A trusted host may supply `workerFactory` returning `{postMessage, terminate,
listen}`. `listen(onMessage,onError,onExit)` returns a nonthrowing unsubscribe;
`terminate()` must actually stop work and may return a completion promise.
Factory/observer objects are host capabilities, never serialized build input.
The Node developer adapter implements only that boundary and executes the same
portable worker core. A hostile substituted worker can fabricate execution claims;
these receipts are integrity/correlation evidence from a trusted host, not signed
attestations. The default browser adapter has separate Chrome/HTTP-loopback evidence; other web
hosts still require their own tests.

## Isolation, budgets and disposal

Each accepted build gets a new worker, compiled module, WASI instance and workspace;
there is no cache, warm instance, retry or cross-build mutable state. Repeated builds
through one controller are tested. One active request is allowed per controller;
wrappers should retain one controller within their chosen resource budget.
Additional independent controllers allocate additional workers/memory.

| Resource | Bound |
| --- | --- |
| Caller source / prepared source | 256 KiB / recipe's bounded preparation limit |
| Service bytes | Exact pinned 101196044 bytes |
| WASM memory | One ordinary defined wasm32 memory; hard maximum 4096 pages (256 MiB) |
| Mutable workspace | 64 entries, 2 MiB/file, 8 MiB aggregate lifetime growth |
| Readonly assets | Exact pinned recipe; no host filesystem or external path access |
| Console output | 64 KiB each stdout/stderr |
| Service diagnostics | 256 KiB buffer; 128 records, 4096 UTF-8 bytes/message |
| ELF / capsule / code | 2 MiB / 4096 bytes / 3840 bytes |
| Worker / public events | At most 16 worker envelopes / 136 public events |
| Build duration | Explicit 1–60000 ms request deadline |

Source/resource snapshots occur before asynchronous operations. Shared service,
recipe or source binary storage is rejected. Transfers detach controller-owned
service copies only. Workspace paths cannot traverse preopens; readonly behavior
survives child/file descriptors. Allocations and positioned writes are checked
before resizing. Native host heap/module/resource copies are **additional** to the
WASM memory cap; this is not a 256-MiB total-process budget.

The deadline begins after request/options validation and admission, before resource
snapshotting/worker creation, and remains active through parent-side validation.
Bounded synchronous host validation/copies and event-loop scheduling can delay
observing a timer; synchronous compiler execution occurs only in the worker.
Cancellation/deadline stops that worker without requiring a callback from WASM.
Ownership is held through termination, late replies are suppressed, partial output
is discarded, and a clean subsequent build is allowed. No result is published until
termination completes. A host cleanup failure is `cleanup_failed`, never success.

## Phases, diagnostics and receipts

Worker progress must follow `verifying → preprocessing → compiling → compiling →
linking → validating → packaging`; failures can stop any prefix. C++/facade and
linker diagnostics retain underlying text and their stage. The observed service
sometimes returns zero after frontend errors, so diagnostics independently prevent
entry compilation/linking and artifacts. Physical `/workspace/Sketch.cpp` locations
are mapped once; already logical filenames are preserved. Original first-line
BOM byte columns include the removed three UTF-8 bytes.

The parent checks message/version/ID/sequence/shape/bounds and independently reruns
ELF packaging. It compares capsule bytes, report and complete expected receipt
against the exact accepted request. Missing phases, stale receipts, corrupt bytes
or resource substitutions fail. Output `bytes` and `linkedELF` are copied on access;
receipt data is deeply frozen. Timing observations (three actual calls) and initial/
final WASM memory are returned, without claiming exhaustive peak process memory.

`firmingo-compiler-build-v1` is distinct from independent packaging and existing SDK
receipts. It records `operation: wasm_compile_link_package` and
`provenanceStatus: pinned_assets_executed`, request/source/revision/translation-unit
and firmware descriptor identities, service ABI/hash/size, shim receipt identity,
recipe resource paths/sizes/hashes, toolchain manifest, linked ELF and capsule.
`buildInputSHA256` hashes all receipt fields except itself and the three output
fields `linkedELFSHA256`, `capsuleSHA256`, `capsuleBytes`. Timings are excluded.
The canonical `{schema:1,service:...}` toolchain manifest is included in the receipt;
its hash is report `source_sha256["toolchain/manifest.json"]` and provenance's
`toolchainSHA256` (currently
`0b5502ab4ffcc2138a5bdc03c59200c6b286702ea121fd367f7c07b5bf08d409`).
Recipe and shim manifest hashes transitively cover their recorded files.

The packaging report retains its conservative status/field vocabulary for SDK
comparison. The distinct execution receipt supplies the real compilation claim;
importing or validating a serialized receipt alone cannot authenticate execution.
Firmware metadata remains caller-selected and is not attested by the compiler.
Deployment authorization, fresh device identity and association checks belong in
FirmingoKit or another wrapper.

See [interface](interface.md), [development commands](development.md),
[execution evidence](evidence/wasm-runtime.md) and
[runtime migration provenance](runtime-migration.json).
