# Owned development-service web checks

`test-built-web` qualifies an explicitly anchored, unpromoted service through real
standard browser module workers. It shares the actual production WASI, recipe,
ELF and capsule check program with `test-built-service`. It does not replace the
public controller, consumer asset pins, source export, or catalogue.

Provision Node 22.12.0, a locally built service with an independently reviewed
SHA-256, an exported resident descriptor, and a Chromium executable:

```sh
node tools/dev.mjs test-built-web path/to/built/compiler.wasm TRUSTED_SHA256 \
  path/to/descriptor.json .build/new-chrome-results
# Optional final arguments: --browser path/to/chromium
node tools/dev.mjs test-built-service path/to/built/compiler.wasm TRUSTED_SHA256 \
  path/to/descriptor.json .build/new-node-results
node tools/dev.mjs test-built-web # Explicit nine-case availability skip, no asset fetched
```

The candidate must have bounded WASM memory and match the explicit digest before
any resource server starts. The read-only HTTP server binds an ephemeral numeric
IPv4 loopback port and serves exact snapshotted routes only. It rejects source
uploads, query aliases, external origins and arbitrary files. CSP restricts script,
worker and network resources to that origin. The standard pinned-service route is
absent; candidate bytes use a separate maintenance route. Chromium runs headless
in an isolated temporary profile with bounded DevTools text messages and external
request observation. No screenshots or UI inspection are used.

Nine checks cover worker primitives; two sketches, three unsupported-build errors,
byte repeat and reentry; wrong service digest; corrupt recipe; busy/cancellation at
the compile phase; fresh worker after cancellation; startup deadline; compile-phase
deadline followed by a fresh worker; and unchanged public pin rejection/external
request blocking. Four cases reach actual compilation, including lifecycle cases.
Compile-phase events establish phase entry, not the exact machine instruction at
which a worker was stopped. Every terminal result terminates its worker; stale
messages cannot notify observers or publish artifacts. Worker deadlines are at
most 60 seconds; the browser runner has its own overall bound.

Success writes two `.elf`/`.fms` pairs and `operation.json` to a new directory.
The host independently validates fixed case outcomes, the selected descriptor,
canonical bounded base64, hashes, ELF structure, capsule binding and matching
ELF/capsule code before writing any artifact. Failure publishes no successful
artifact set; bounded diagnostics remain under `.build/logs/`.

## Native macOS WebKit host

FirmingoKit owns `Tools/ManagedWASM/VerifyBuiltServiceWebKit.swift`. Build it using
that repository's documented Xcode/Swift command, then explicitly select its
executable when running this maintenance command:

```sh
node tools/dev.mjs test-built-webkit path/to/built/compiler.wasm TRUSTED_SHA256 \
  path/to/descriptor.json path/to/VerifyBuiltServiceWebKit .build/new-webkit-results
```

The host accepts only an exact `http://127.0.0.1:PORT/` origin. It uses an invisible,
nonpersistent WKWebView, an isolated content-rule store, closed navigation/resource
policies, main-frame progress messages, a fixed awaited page function and a
120-second overall deadline. Awaiting the page promise is necessary for the
recorded background host's execution lifetime. The CLI bounds the native process
at 145 seconds, validates returned artifacts and removes its temporary host files.
No compiler build or consumer requires Swift, this executable, or a sibling checkout.

This qualifies standard workers on the recorded macOS HTTP host. It does not
qualify the candidate in public Swift build APIs, the SDK's private resource
scheme, a signed sandbox, minimum OS versions, or physical iOS/iPadOS devices.
Consumer pins remain strict. Licensing, package promotion, distribution and
hardware gates remain separate. See [actual evidence](evidence/built-service-web.md).

Normal compiler CI runs the deterministic protocol/report rejection tests and
observes candidate absence separately. It does not fetch or distribute a candidate.
SDK manual CI compiles the native host and runs its real address checks; actual
source-asset execution needs explicit local provisioning. Full native LLVM source
builds and cross-repository opt-in qualification remain deliberate CI exclusions.
