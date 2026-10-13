# Service-free preparation hosting — 2026-10-12

`PreparationController.prepare(request,{signal})` now isolates existing portable
`prepareSketch` in a fresh standard module worker. It requires no service bytes,
WASI execution, resource loader, device, Swift or Node in the consumer path. A
trusted wrapper may supply the same narrow `{postMessage,terminate,listen}` worker
capability shape used by compilation. One active operation is admitted per controller;
concurrent calls reject busy rather than queue. The request's at-most-60-second
deadline covers worker startup and parent verification. Cancellation or deadline
terminates work before promise settlement; cleanup failure prevents success.

The worker consumes one request and emits one correlated prepared/failure envelope.
The parent validates closed fields/diagnostics/error bounds and independently calls
the same production preparation function to compare every output field before
publication. Unknown/stale IDs, altered source/unit identities and substitution
fail. Returned preparation retains original/generated hashes, revision, request
identity, line count and BOM metadata. Compiler syntax/ABI checking, service
execution, packaging and deployment are not implied by preparation.

`export-web` now includes a classic `preparation-worker.js` alongside its existing
compiler and compile-worker bundles. The source archive/recreation inputs include
the new worker/controller; total source records are 49. No binary is bundled.
The current development export SHA-256 is
`65c40e9f33a6ae2838f19c3a1597d4094374fec827df790c5a72c7480792b3a5`.
Existing package, service, interface and recipe pins are unchanged except this
explicit source-package identity. Earlier package receipts remain historical facts.

FirmingoKit's two public preparation overloads now wrap this controller in its
private WebKit host; its duplicate Swift lexical scanner is removed. Typed source,
revision, generated hash/layout, line mapping and existing receipt schemas remain
compatible. Native independent output hashing/closed-field checks stay in the SDK.
Missing/corrupt assets or host failure throw explicitly through the existing async
API. First-line diagnostics now include original BOM bytes, and diagnostic text
comes from this portable policy. No service approval or visible view is required.
The SDK origin for preparation contains only the page, without a service resource.
Its default compilation still fails pending review and its catalogue stays empty.

SDK runtime manifest:
`edba580f8c47fbe4b7a74b97d57d5e5fb4a3630d5b5d16ce69ad518c0389ae7b`;
pending inventory:
`0ca0c5a50b32674d9656112fbcd22dca82adca79897ff4e5366e86b27301e258`.
Runtime provenance consequently changes; no saved receipt, association, journal,
recipe, service identity or firmware wire format is silently rewritten.

Local checks: 94 fast cases pass and one actual memory-adaptation case explicitly
skips; four new actual worker/controller cases exercise normalization/error parity,
BOM byte positions, busy/cancellation/deadline/fresh operations, stale/altered
response rejection, asynchronous termination ownership and cleanup failure. Export
recreation compares every output byte. Eight actual Node/WASM cases pass. Chrome
without a service passes three browser checks and skips six actual compiler cases;
its first check now runs preparation through the actual default module worker with
busy/cancellation/deadline/error and recovery cases. No compiler pass is claimed
for that service-absent run.

The SDK's original ten preparation tests pass through real WebKit with independent
hash vectors. Its full explicit-service run reports 153 passing tests in 17 suites,
including nine actual Clang/WebKit cases and new service-free native identity/BOM/
timeout/cancellation cases. Both generic iOS builds and native DocC pass without documentation warnings. Separate SwiftPM consumers
successfully compile the known Blink vector with an explicit service and prepare
source with no service, using SDK packaged resources only. Fixture integrity
remains 34 SDK files. Source preparation now uses WebKit in ordinary SDK tests.
SDK native DocC and exact commands are recorded in its same-named guide.

Compiler logs are `.build/shared-preparation-{contracts,check,runtime,chrome}.log`;
SDK checks/consumer/platform logs are recorded in its guide. CI uses the same fast,
SDK/consumer and browser entries; workflow definitions remain unverified on GitHub.
No signed sandbox/minimum-OS or physical iOS/iPadOS/hardware result is claimed.

Public SDK supplied-ELF conversion remains deliberate compatibility work: its
legacy caller-declared recipe provenance needs a distinct portable packaging design,
not weakened compiled-build pins or silently rewritten metadata. Independent SDK
capsule/report/device/deployment validation remains retained ownership.
