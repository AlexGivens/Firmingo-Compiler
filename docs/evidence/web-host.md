# Standard browser-worker evidence — 2026-10-12

Host: macOS arm64; developer Node 22.12.0; externally provisioned headless
**Chrome 154.0.8037.93**, revision `@f89f3a4363808e117c592adedcf9947882ac3b79`,
DevTools protocol 1.3, V8 `15.4.80.19`. Exact observed metadata/results are in
[web-output-identities.json](web-output-identities.json). Browser versions in other
runs must be recorded separately; this observation is not a universal support matrix.

The browser used the production default `CompilerController`, standard module
workers, WASI workspace/service, portable source/ELF/capsule gates and receipts.
Node only served fixed local resources and drove textual test functions through
the browser's own automation protocol. It did not compile source. No Swift/native
compiler, network build fallback, screenshot, normal user profile or visual/native
UI inspection was involved. Profiles were isolated under ignored `.build` and
removed after browser shutdown. Manual UI/accessibility remains unqualified.

The same explicit local bounded WASM service was used as in the prior Node checks:
101196044 bytes, SHA-256
`3e2544acf7f88f6f1d5fbce34648df8eb96dfff47afa242a3e008bc8f86e2f33`.
It is verified before local serving and again in each browser worker. No service
binary is copied into tracked files or bundled; redistribution/build provenance
remains unresolved. Every descriptor is synthetic, **NEVER DEPLOY**.

## Checks actually run

| Check | Result |
| --- | --- |
| `node tools/dev.mjs check` | Syntax, pinned fixture/recipe/vendor identities pass |
| `node tools/dev.mjs test` | 86/86 fast tests pass, including readonly web route/capability policy |
| `node tools/dev.mjs test-runtime ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm` | Existing 7/7 actual Node/WASI regression cases pass |
| `node tools/dev.mjs test-web ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm` | 9/9 browser cases pass, including 6 real-compiler cases |
| `node tools/dev.mjs test-web` | 3 browser cases pass, 6 compilation cases explicitly skip, 0 actual compiler passes |
| Real loopback HTTP checks in both web runs | Headers/MIME/length, HEAD, unavailable service, private/arbitrary/write/origin/Host routes behave as specified |
| Ruby workflow YAML assertions | Five independent jobs, explicit Bash and fail-fast false retained |
| `git diff --check` | Compiler and affected SDK documentation pass |

The filesystem sandbox blocked native browser launch/loopback access, so the
headless test operation ran with authorized tool escalation. The app/user's network
settings and normal browser profile were unchanged. No automatic browser installation
or service acquisition occurred. Actionlint remains unavailable; no GitHub CI run
was verified. Workflow data validation and local test evidence are separate.

## What the browser exercised

Nine cases cover secure-context primitives/source preparation; actual module-worker
imports and unpinned-service rejection; two different supported sketches and repeated
bytes/receipts; frontend errors/BOM byte columns; statelessness/helper linker errors;
cancellation during compile progress/busy/stale IDs; startup deadline/fresh build;
corrupt resources/fresh build; and CSP denial of external access. Exactly one
correlated terminal result is checked for failure/cancel/timeout/success. Output copies
and portable event codecs preserve capsule/receipt identity.

A and B capsule hashes are exactly the previously validated Node/SDK/Firmingo results:

| Sketch | Capsule bytes | SHA-256 |
| --- | --- | --- |
| A (pin/byte-delay APIs) | 316 | `a23bc8cc24d960dc60283e3d5dc9bd80d61a7d8c6cbe0f08f5248bc14848231a` |
| B (serial text/byte APIs) | 392 | `ba26c3a28700b8ae177eb05c81434e35c16d8f6306bf5e9822f8c85adf6ea063` |

Those exact bytes were independently accepted by Firmingo's production validator
in [the prior execution audit](wasm-runtime.md). Browser checks validate the capsule
and original/generated input identities and reproduce the same output hashes;
they do not replace a device execution check. Final WASM memory remained below the
hard 256-MiB maximum; total browser/host heap peaks were not qualified.

The page and worker resources used HTTP loopback secure context with self-only
script/worker/connect policy and `'wasm-unsafe-eval'`; general eval/inline scripts
were not enabled. Shared memory, cross-origin isolation headers and service workers
were not required. The intentional external probe was denied by CSP. The automation
observed zero page requests outside the local host and zero protocol faults. No
Internet source/resource is needed once local package/service bytes are provisioned;
the local module host remains available. This does not certify zero background
network traffic from every browser process.

Final logs are retained locally under ignored `.build/web-{check,fast,real,absent}.log`,
`.build/web-node-regression.log`, and `.build/logs/web-results-{present,absent}.json`.
The HTTP test initially exposed that Node Fetch controls its Host header; the corrected
negative check sends that header using the standard HTTP client and confirms rejection.
These logs/test artifacts are not release images.

## Remaining gates

The separate web-host CI job runs the same entry point without a bundled service:
compiler cases skip, and browser absence is likewise explicit. No CI recipe compilation
is claimed. Safari/WebKit/iOS/iPadOS/custom origins, signed wrapper sandboxes, trusted
production firmware metadata, versioned SDK package consumption and hardware remain
open. Next is the FirmingoKit Swift/WebKit adapter while retaining its current public
APIs and deployment safeguards. No existing SDK executable implementation was removed.

Subsequent macOS SDK adapter/source-package checks are recorded in [SDK adapter](../sdk-adapter.md); the original browser observations above remain unchanged.

The later Linux CI cleanup correction and verified GitHub job results are recorded
in [browser cleanup](browser-cleanup.md). The service-absent Ubuntu browser run
passes three checks and skips six compiler cases; the original local real-service
observations above remain separate.
