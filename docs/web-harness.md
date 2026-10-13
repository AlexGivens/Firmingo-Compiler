# Minimal web developer harness

Browser startup now waits for the DevTools readiness event from stdout or stderr
with a bounded 30-second startup budget, retaining the existing whole-run limit.
`browser-startup.json` records selected/resolved executable, first output and ready/
failure timing plus bounded diagnostics. Two cold Ubuntu CI starts exceeded the
previous 12-second budget; no automatic retry or unconditional delay is added.
Timeout/exit/error still fail and dispose the isolated browser/profile.

The browser host exercises the production `CompilerController` and its default
standard module Worker, rather than the Node adapter. Real compile/link/packaging
and lifecycle checks pass in **headless Chrome 154.0.8037.93 on macOS arm64**, using
HTTP loopback as a secure context. This qualifies that tested host only. Safari,
WebKit custom schemes, iOS/iPadOS, signed sandboxes and hardware remain unqualified.
No UI screenshots or visual/native UI inspection were used. Interactive controls
and accessibility have not been manually qualified.

## Local use

Use pinned Node 22.12.0 for the developer server/automation only. Consumer compiler
modules remain independent of Node, Swift and a native compiler. The harness
provides the web environment and package resources; all source compilation happens
inside the browser's WASM worker, with no build server or remote fallback.

```sh
# Start without a bundled service; select the pinned local WASM file in the browser:
node tools/dev.mjs serve-web
# Or provision the explicitly selected local development input explicitly:
node tools/dev.mjs serve-web path/to/compiler-bounded.wasm
# Headless checks, with real compilation when the explicit service is present:
node tools/dev.mjs test-web path/to/compiler-bounded.wasm
# Observe service absence: 3 browser checks pass, 6 compilation cases skip:
node tools/dev.mjs test-web
# Select an already installed Chromium executable explicitly:
node tools/dev.mjs test-web path/to/compiler-bounded.wasm --browser path/to/chromium
```

`serve-web` prints an ephemeral `http://127.0.0.1:<port>` URL. Open it in a browser,
select a build request JSON file and pinned WASM service, or use the sample and
explicitly provisioned server service. Build and cancellation use the same public
contract as wrappers. Save output downloads one `.build.json` portable result envelope containing
canonical base64 capsule bytes, receipt and report. `parseRuntimeEvent` restores
the byte buffer; no result is uploaded or installed. Stop the server with Ctrl-C/SIGTERM. The sample
and every automated-test descriptor contain **synthetic resident metadata: NEVER
DEPLOY**. Normal request validation does not authenticate a selected firmware build.

There is no editor, network/device client or native compiler in this page. User
source is read from a local File into browser memory, never posted to the server.
Only fixed package resource paths, the marked sample and an explicitly selected
service are served. No service binary is staged or bundled into tracked files.
The server snapshots/verifies the service's pinned size/hash/memory cap before
listening, and the worker independently verifies it again before execution.

## Requirements and resource policy

The host requires module workers, wasm32/WASI Preview 1, Web Crypto SHA-256,
TextEncoder/fatal UTF-8 TextDecoder, structured cloning/transfer, AbortSignal and
base64 helpers. Local HTTP loopback supplies the tested secure context. CSP permits
only local scripts/workers/resources and WASM compilation (`'wasm-unsafe-eval'`),
without general eval or inline scripts. There are no COOP/COEP requirements, shared
memories, service workers, custom origins or browser extensions in this harness.
Opaque WebKit schemes are a separate SDK integration problem; Chrome success does
not resolve their origin/worker/crypto constraints.

The Node server binds **127.0.0.1 only** and exposes an exact readonly route list:
no directory browsing, dotfiles, `.build`, sibling paths, arbitrary uploads, path
aliases or query variants. It accepts GET/HEAD only, validates Host/Origin and
same-origin request metadata, supplies no CORS permission, and disables caching.
Browser reads enforce declared/observed byte limits and a 15-second loading deadline.
HTTP requests/headers and request metadata logs are bounded; logs omit source/body
bytes. The public build deadline applies after admission, independently of loading.

`test-web` also checks the real HTTP server's MIME/length/CSP/no-cache headers,
HEAD behavior, missing-service route and denied file/write/origin/Host requests.
The automated browser uses a fresh temporary profile under ignored `.build`, stops
its process and removes that profile afterward. It never opens the user's normal
profile. Node's built-in WebSocket drives the browser's own DevTools protocol; no
Playwright/npm dependency or browser download is required. The browser executable
is explicitly supplied or discovered among already installed Chrome/Chromium paths.
Its exact product/revision/JS/protocol versions are recorded per run; this is an
externally provisioned test host, not an implicitly upgraded compiler dependency.

## Observable checks and qualification limits

Nine bounded cases cover secure-context preparation, actual default-worker import/
resource rejection, two distinct real sketches/repetition/receipt serialization,
frontend/BOM diagnostics, linker restrictions, busy/cancel/stale behavior, deadline/
fresh-build behavior, resource integrity and external-access policy. Two compiled
capsule hashes must equal the previously independently validated Node/firmware
outputs. No worker factory substitution, native compile or mocked build is used.

With the exact local service, all nine cases pass (six actual-compiler cases).
Without it, three browser cases pass and six explicitly skip; actual compiler
passes are zero. Without any available browser, all nine skip with zero passes.
An explicitly invalid browser or service path fails rather than silently falling
back. Browser initialization, HTTP or case failures exit nonzero. Results live
under ignored `.build/logs/web-results.json`, with distinct
`web-results-present.json`/`web-results-absent.json` copies and bounded failure logs.

The page's external-request probe is blocked by CSP before access. Automation also
rejects page requests outside the harness origin, and no such requests occurred
in the recorded runs. Internet services are not required after package/local-service
provisioning; local resource hosting remains available throughout each build.
This is not a claim that the entire browser process performs no background networking
or that compilation works after removing its local module host. The user's network
settings were unchanged.

CI observes the web-host entry point in its own job and reports passed/skipped/actual
compiler counts. With no redistributed service, actual compilation remains explicitly
skipped. A missing hosted browser is likewise a skip, not browser qualification.
No GitHub run has been verified. See [browser evidence](evidence/web-host.md),
[runtime requirements](runtime.md), [interface](interface.md) and
[development workflow](development.md).
