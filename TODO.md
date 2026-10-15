# Firmingo-Compiler — project work ledger

Read [AGENTS.md](AGENTS.md) for scope, ownership, and engineering rules. This file
tracks changing priorities, implementation tasks, acceptance checks, and evidence;
it is not a second policy file or authorization to implement the entire roadmap.

## How to maintain this file

- Keep tasks unchecked until their acceptance checks have evidence in this
  repository. Existing FirmingoKit functionality is a migration input, not a
  completed Firmingo-Compiler implementation.
- Use `Status: in progress` on at most one milestone. For blocked work, identify
  the dependency and next action; continue tasks that do not need it.
- Record exact commands actually run, results, source commits/resource hashes,
  and report links for meaningful increments. Keep long reports under `docs/`.
  Do not invent commands, dates, commit IDs, support claims, or test results.
- Track unit tests, actual WASM compilation, CLI execution, browser execution,
  wrapper integration, distributable assets, and hardware behavior separately.
  Missing services or hardware are skipped or blocked, never passed.
- Update current position, affected checkboxes, and evidence before handoff.
  Preserve unresolved failures and compatibility decisions.
- Deferred work remains deferred until selected. This checklist does not authorize
  publication, flashing, or destructive hardware checks.

## FMS2 adoption — 2026-10-15

- [x] Import the pinned schema-three firmware contract and actual API/RAM/upload facts.
- [x] Add explicit schema-two descriptors/bindings, ABI-two WASM recipe, strict ELF/FMS2 packaging and receipts while preserving ABI one.
- [x] Exercise real WASM stateful compilation, independent firmware host validation and bounded ELF mutations for both profiles.
- [x] Export both recipe resource sets and coordinate SDK native validation/target-two upload handling.
- [x] Record signed macOS FMS2 compilation and the exact Nano/iPad two-sketch upload, in-boot replacement, state/echo and manual-reboot pass through the SDK. See [scoped evidence](docs/stateful-adoption.md#selected-nanoipad-hardware-result); other host and production gates remain separate.
- [ ] Qualify this exact candidate through signed macOS/iPad/iPhone hosts and selected-board replacement/reboot/interruption/recovery tests before promoting FMS2 into the default catalogue.

Evidence and exact input/command identities: [FMS2 adoption](docs/stateful-adoption.md).

## Starting point — inspected 2026-10-12

- [x] Inspect the new repository's README, license, and working state.
- [x] Create [AGENTS.md](AGENTS.md) from the user's ownership and scope decisions.
- [x] Review Firmingo and FirmingoKit's TODO structures and create this ledger.

At kickoff the repository had a short README and GPL-3.0 license text. The new
guide and this ledger established the initial plan. The current position below
records implementation since kickoff; no compiler/runtime/board combination is
qualified merely by the initial documents or new input validators.

FirmingoKit's experimental Nano preprocessing, WebKit/WASI runtime, Node/WASI
runner, ELF validation, capsule packaging, metadata, tests, and provenance records
are the migration starting point. ArduinoKit is a read-only proof-of-concept
reference. Existing experiments and hardware observations remain evidence from
their originating projects, not proof that the extracted compiler works.

Starting references:

- [FirmingoKit compiler status](../FirmingoKit/docs/compiler.md),
  [compiler catalogue](../FirmingoKit/docs/compiler-catalogue.md), and
  [WASM development workflow](../FirmingoKit/Tools/ManagedWASM/README.md).
- [Firmingo documentation index](../Firmingo/docs/README.md) and
  [experimental managed-sketch handoff](../Firmingo/docs/integration/managed-sketch-sdk.md).

These links are local research conveniences. Distributed resources, normal tests,
and consumer builds must not require sibling checkouts.

## Current position and next action

Production direction accepted on 2026-10-15: follow the shared
[Nano-first 1.0 gates](https://github.com/AlexGivens/Firmingo/blob/main/docs/integration/production-v1.md).
Prioritize a useful bounded mutable-state sketch contract from Firmware, an
explicit multi-file source bundle and diagnostics, reviewed provisioned delivery,
and one exact release compatibility matrix. Retain current stateless/ABI-one
validators, recipes and consumer pins until the new versioned contract and
independent fixtures exist. Pico and conventional Arduino remain later milestones.

The agreed deliverable is a language-neutral, web-hosted WASM compiler focused on
Firmingo managed sketches, starting with **Arduino Nano RP2040 Connect**.
Conventional Arduino builds are secondary. Firmingo-Compiler owns preprocessing,
execution, recipes, artifact packaging, diagnostics, and static build metadata.
FirmingoKit retains Swift hosting, communication, installation, uploads, and
device associations; Firmingo owns device firmware and resident contracts.

M1 inventory, M2 portable interface/lifecycle and M3 portable preparation/packaging
are complete. M4's local development path now runs actual WASM compile/link through
the pinned explicit service, with bounded workspaces, diagnostics, cancellation,
deadlines, independent output verification and distinct execution receipts. The
minimal compiler CLI and opt-in real-service suite work without Swift or implicit
sibling dependencies. Synthetic test bindings remain NEVER DEPLOY.

M5 now provides the minimal readonly web harness and actual standard module-worker
checks: nine pass in the recorded headless Chrome host; without the service, three
browser cases pass and six compilation cases skip. All six GitHub jobs at
`2282bae` now pass after the browser cleanup correction; actual-service compilation
remains explicitly skipped there. The inspected results are tracked in
`docs/evidence/browser-cleanup.md`. M6 now connects both SDK build APIs through
a pinned source package, with nine real macOS WebKit tests and a separate consumer.
The old SDK standalone runtime/recipe/vendor stack and inactive bridge are retired with an exact 36-file source inventory. Both public SDK preparation and supplied-ELF conversion APIs now use the shared service-free worker; Swift lexical scanning, ELF parsing and capsule production are removed with compatibility/receipt checks. See `docs/declared-elf-packaging.md`. Next: resolve reproducible service provenance/assets and trusted firmware exports, then qualify signed/physical wrapper hosts. Service
redistribution, production firmware exports and hardware qualification remain open.
M7 now audits exact service reference/patch state and imports an explicitly anchored
historical resident export. Two supported actual WASM capsules pass the independent
firmware validator; no default catalogue changes. [Latest CI](docs/evidence/provenance-ci.md)
at `54c1803` passes all six jobs with actual-service cases explicitly skipped.
See `docs/runtime.md`, `docs/evidence/wasm-runtime.md`, and the support/interface docs.

| Dependency or limit | Current position | Next action |
| --- | --- | --- |
| Compiler service distribution | Owned service/runtime repeat builds and Node/Chrome/WebKit execution verified; custom-source GPL grant recorded | Complete corresponding-source/notice materials and review consumer promotion in M7 |
| Nano resident contract | Exact historical M9 export verified/imported as experimental metadata; production and installed-image evidence unqualified | Complete upstream provenance and wrapper/device qualification before a production offer |
| Runtime portability | Local Node/WASI and Chrome/HTTP-loopback evidence exists; arbitrary wrappers remain unqualified | macOS SDK adapter passes; qualify signed/minimum-OS and physical iOS/iPadOS hosts |
| Board and library breadth | Nano's constrained managed facade is the starting scope | Declare its restrictions; leave other boards and broader libraries unavailable until implemented |

Service-distribution work can proceed alongside interface, extraction, validation,
and opt-in local development tests. Unresolved redistribution does not block all
engineering work or justify packaging an unreviewed service.

## Ordered milestones

### M1 — Inventory the migration and pin the contracts

Status: complete for inventory/selection; service distribution and deployment exports remain open.

- [x] Record full FirmingoKit, Firmingo, and relevant ArduinoKit reference commits,
  local differences, file hashes, and snapshot consistency.
- [x] Map preprocessing, worker/runtime code, recipes, ELF/capsule validation,
  diagnostics, catalogue/build metadata, assets, tools, and tests to their new owners.
  Identify Swift implementations that need a portable replacement.
- [x] Separate static compiler/firmware descriptors from physical-device evidence,
  association persistence, installation, upload, and deployment validation.
- [x] Inspect the Nano resident ABI, facade, linker/memory layout, capsule format,
  fixtures, existing exports, and measured limits. Select a consistent contract;
  record conflicts or required firmware changes without guessing addresses.
- [x] Inventory service source and original/derived binaries, toolchain/core/shim
  pins, licenses, notices, modifications, and reproducible build evidence.
- [x] Create `docs/migration.md` and `docs/compatibility.md` with extraction order,
  API/schema compatibility, ownership changes, fixture provenance, and an initial
  target/runtime status matrix.

Acceptance: every first-path component has an owner and a pinned input; firmware
requirements, source/license gaps, and wrapper compatibility effects are explicit.
Evidence: `docs/baseline.json` records 24 firmware/SDK and five read-only ArduinoKit source/resource hashes, original/bounded service byte identities, and unresolved source/distribution gaps; local service sizes/hashes were reverified without execution or copying. `docs/migration.md` and `docs/compatibility.md` record scope, ownership and qualification limits. No runtime or hardware pass is implied.

### M2 — Define the language-neutral interface and development foundation

Status: complete for implemented version-one experimental interface, lifecycle, codecs and receipt schemas; public freeze/SDK adapters remain future gates.

- [x] Choose and pin the implementation/build/test tooling needed for the first
  portable path; document setup without requiring Swift or Apple tooling.
- [x] Complete `docs/interface.md` and output/lifecycle schemas after the implemented build/cancel request schemas; retain examples for requests,
  progress, diagnostics, terminal results, binary artifacts, and build receipts.
- [x] Specify explicit board/profile/recipe and static firmware-build selection,
  source filenames/bytes/revisions, allowed options, encoding, numeric ranges,
  binary transfer, and interface/service/recipe version compatibility.
- [x] Define build IDs, ordered events, one active build, busy errors, cancellation,
  deadlines, late-response handling, and exactly one terminal result per request.
- [x] Establish production validators and deterministic tests for malformed,
  unsupported, missing, oversized, and boundary inputs, including unsafe paths.
- [x] Add `docs/development.md` with actual setup/test commands and ignored output
  locations as tooling becomes available; create directories only as needed.
- [x] Add initial CI for the implemented checks in the same increment.

Acceptance: a caller can construct and interpret the documented contract without
Swift types, a device, or browser UI objects. A fresh checkout can run the initial
tests independently of reference repositories.
Evidence: portable `src/` production validators, request schemas, independent synthetic fixture identities and developer tools are implemented. Local regression/syntax/fixture and bounded mutation checks pass; results are recorded in `docs/evidence/foundation.md`. Runtime events/serialization and verified execution receipts now pass local lifecycle/real-service tests; see `docs/evidence/wasm-runtime.md`. GitHub execution and actionlint remain unverified.

### M3 — Extract preprocessing, Nano recipes, and artifact validation

Status: complete for portable preparation and independent packaging; M4 now adds actual compilation/facade diagnostics without changing this independent-packaging receipt.

- [x] Implement portable preprocessing with immutable source identity, documented
  normalization/declaration/include rules, generated-source hashes, and source
  mapping. Preserve existing supported behavior or document intentional changes.
- [x] Port lexical/source/include regression cases and explicit library/directive
  diagnostics. C++ syntax/type and unsupported facade-call diagnostics require
  the actual service in M4; no arbitrary Arduino compatibility is claimed.
- [x] Define an explicit pinned Nano managed recipe: CPU/triple, facade/headers,
  compiler/linker flags, script, memory budgets, output format, and resident binding.
- [x] Extract or reimplement strict ELF parsing and independent validation of the
  selected architecture, sections, ranges, entry points, symbols, relocations,
  storage restrictions, and code-size limits.
- [x] Implement FMS1 packaging, capsule validation, and reports against selected
  firmware vectors; preserve exact binary bytes and distinguish complete images.
- [x] Produce receipts covering original/generated source, revision, recipe,
  toolchain/resources, static firmware metadata, ELF, and capsule identities.
- [x] Import provenance-bearing fixtures and test truncation, malformed tables,
  boundary values, wrong board/ABI/binding, digest failures, and source mapping.
  Label synthetic/non-executable fixtures so they cannot be mistaken for deployable
  artifacts.

Acceptance: supported source preparation and independently linked ELF-to-capsule
packaging run here without Swift. Independent firmware vectors/validators agree;
unsupported or malformed inputs fail explicitly. This gate alone is not compilation.
Evidence: `docs/evidence/portable-pipeline.md`, exact firmware capsule and independent Python report/receipt vectors, unchanged recipe/asset hashes, production parser/packager regression tests and bounded ELF mutation. Independent packaging receipts mark provenance as declared; no WASM/SDK/hardware execution is claimed.

### M4 — Run the actual WASM compiler with bounded execution

Status: complete for the explicit local-service Node/WASI path; browser qualification and approved distribution remain M5/M7 work.

- [x] Extract the production browser/WASI worker and narrow host interfaces; isolate
  native wrapper bridges and development-host code from compiler logic.
- [x] Verify service/resource sizes, hashes, imports/exports, ABI, and memory limits
  before execution. Support an explicit local development service while distribution
  evidence remains unresolved.
- [x] Implement verify → preprocess → compile → link → validate → package through
  the real service, with structured phase errors, C++ syntax/type errors and
  actionable unsupported facade/API diagnostics.
- [x] Isolate bounded virtual workspaces and read-only assets; prevent traversal,
  cross-build state leakage, unauthorized resource loads, and unbounded output.
- [x] Enforce source/file/workspace/memory/artifact/event limits and build deadlines.
  Terminate unresponsive workers on cancellation or timeout, discard partial output,
  and settle requests exactly once.
- [x] Test actual supported sketches, syntax/frontend/link failures, concurrent busy
  rejection, cold/warm runs, cancellation during compilation, deadline termination,
  stale messages, worker failure, and clean subsequent builds.
- [x] Record source/service/recipe/artifact identities, memory and timing observations,
  and comparisons with independent firmware validation and the previous SDK path.

Acceptance: actual source reaches validated Nano ELF/capsule output through WASM;
failure, cancellation, and timeout preserve isolation and permit a fresh build.
Synthetic-binding compiler tests remain unsuitable for hardware deployment.
Evidence: `docs/evidence/wasm-runtime.md`: actual compilation/link/failure/disposal tests, repeated byte-identical outputs, explicit absent-service skips, two byte-identical SDK ELF comparisons and independent Firmingo production image validation. No web/Swift/hardware/CI success is inferred.

### M5 — Provide the minimal CLI, web harness, and observable CI

Status: complete for the maintained CLI/web harness and service-free CI scope. All six GitHub jobs at `2282bae` are inspected passing after the browser cleanup correction; actual-service compilation remains deliberately excluded from public CI pending asset provisioning.

- [x] Add a developer CLI with help, explicit request/recipe/resource selection,
  structured diagnostics, artifact/receipt output, meaningful exit codes, cancellation,
  and bounded timeouts. Use production compiler code, not a second implementation.
- [x] Provide readable commands for setup inspection, fast tests, actual WASM builds,
  and asset verification as they become necessary. Explain missing tools/resources.
- [x] Add a minimal web harness exercising the same interface and worker. Document
  local resource loading, worker/WASM requirements, and wrapper-host restrictions.
- [x] Run actual builds and lifecycle/error cases in a web host as well as the CLI.
  Demonstrate offline operation after resources are provisioned and no consumer
  dependency on Node, shell, native compilers, or a remote fallback.
- [x] Keep fast tests, real-service tests, web tests, and recipe builds independently
  observable in CI. Configure pins, bounded jobs, artifacts, and explicit skips;
  never make service-absent runs appear to have passed actual compilation.
- [x] Preserve failing pipeline exit status and pre-test/build logs, retain matrix
  `fail-fast: false`, validate workflows, and inspect the GitHub run before recording
  CI success.

Acceptance: a developer can exercise implemented compiler behavior through documented
CLI and web commands. CI distinguishes actual compilation from tests that lack the
service; web-host compatibility is evidenced rather than inferred from CLI success.
Evidence: actual CLI new-directory/receipt/no-overwrite tests pass; fast/mutation/service-availability jobs remain separate. Real-service CI explicitly skips until approved provisioning exists. See `docs/evidence/wasm-runtime.md` and `docs/evidence/web-host.md`: nine actual local Chrome cases pass, matching the independent capsule outputs; missing service has zero compiler passes. `docs/evidence/browser-cleanup.md` records the six-job GitHub pass, exact counts/skips, artifacts and Linux browser version. Other hosts and hardware remain separate qualification work.

### M6 — Integrate FirmingoKit as a wrapper and retire duplicate ownership

Status: integration and compiler-ownership retirement are complete for the local macOS adapter scope. Both build, preparation and supplied-ELF conversion APIs consume the shared source package with retained Swift receipts/deployment checks. Signed/physical host qualification remains M8 work.

- [x] Implement the Swift/web-host adapter for the portable request/event/result
  contract without moving device models or Apple dependencies into this repository.
- [x] Connect existing compiler APIs, diagnostics, artifacts, catalogue selections,
  and receipts to the new implementation. Preserve source/revision identity and
  stale-build prevention; document any unavoidable compatibility changes.
- [x] Keep device associations, artifact-to-device binding, deployment revalidation,
  networking, installation, uploads, and durability gates owned by FirmingoKit.
- [x] Define an explicit versioned packaging/dependency route; consumer builds must
  not depend on developer sibling paths or generate compiler assets from them.
- [x] Port regression coverage and run actual wrapper compile/link/package,
  cancellation/deadline/reentry, and metadata/artifact compatibility checks.
- [x] Update relevant FirmingoKit and Firmingo guidance, TODOs, resource-maintenance
  tools, and integration documentation to reflect actual changes. Remove duplicate
  compiler ownership only after replacement behavior is tested.
- [x] Record a separate consumer example demonstrating offline compilation without
  a device and host-owned decisions without a visible compiler view.

Acceptance: FirmingoKit uses the shared compiler through a narrow adapter; device
operations remain in the SDK, compatibility effects are documented, and a consumer
does not require sibling checkouts. No hardware qualification is implied.
Evidence: `docs/sdk-adapter.md`: nine real WebKit cases, separate packaged consumer, retained receipt schemas/device gates, deterministic source export and independent receipt/hash rejection; iOS builds/DocC pass. Signed/physical Apple-host and hardware execution are not established.
The later `docs/declared-elf-packaging.md` records service-free conversion, removal of
the two native producer/parser files, unchanged receipt goldens and current package identities.

### M7 — Produce reproducible, distributable compiler assets

Status: in progress. Exact service reproduction, scoped notice review, paired
delivery and local transport are complete. A versioned experimental consumer
package binds exact firmware facts. Hosted provisioning/publication and broader
firmware provenance/signed/physical/hardware qualification remain open.

Owned maintenance now captures raw LLVM Git objects, 23 custom source/header/patch
inputs, complete selected sysroot/resources, CMake modules, isolated Python library
and native bootstrap bytes. One fresh 2,602-step LLVM/Clang/ARM/LLD build produces a
bounded service that passes actual compile/link/error/reentry checks and independent
firmware capsule validation. Two independent fresh source builds now produce
identical bytes for all 96 archives and the complete bounded service. This is
repeat identity for captured inputs on the recorded host. Pinned Preview 1 runtime
source builds now also reproduce all 2,353 output files; a fresh complete service
build using those exact bytes passes actual sketch/error/reentry checks and
independent firmware capsule validation. Explicit standard-worker Chrome and macOS
HTTP-loopback WebKit checks now pass nine cases each; Node/Chrome/WebKit artifacts
are byte-identical and independently firmware-validated. See [owned web evidence](docs/evidence/built-service-web.md).
Distribution and public SDK/private-scheme/package promotion remain open. See [runtime source evidence](docs/evidence/runtime-source-build.md) and
[owned source-build evidence](docs/evidence/owned-service-build.md).
[CI](docs/evidence/owned-service-ci.md) passes all eight jobs at `fa35579`, with
real-service compilation explicitly skipped there. Local ordinary tests now pass
136 cases with one optional-service skip; separate maintenance suites pass twelve
service fixtures, eleven runtime fixtures and ten source-package fixtures.

- [x] Resolve the reproduced service's source, component/notice and build-provenance
  scope. Preserve historical service and firmware provenance limits separately.
- [x] Record the author's ownership confirmation and GPL-3.0-only grant for all
  23 original service/header/patch inputs, preserving their bytes and upstream LLVM
  terms. Add an owned provider, strict grant/source checks and deterministic
  source-and-selected-notice review export. See [licensing](docs/service-licensing.md).
- [x] Add reproducible service/asset maintenance commands, pinned sources/tools,
  identifiable patches, and source/notice materials required by the reviewed assets.
- [x] Assemble and verify a source-only candidate archive containing both recipes'
  raw upstream source selections, complete pinned WASI sources, GPL grant, notices,
  source headers and rebuild scripts. Add bounded raw-snapshot providers and
  archive integrity checks. See [source package](docs/source-package.md).
- [x] Rebuild all 2,353 runtime files from an unpacked candidate archive and
  configure the actual service from its raw/custom sources without a Git cache.
  Record repeated archive identities, input anchors and configuration-only limits.
- [x] Complete the full service rebuild from the final unpacked archive. Reproduce
  the module, all 96 archives and all 6,182 compiler dependency bytes, then run
  actual WASM build/error/repeat checks and independent firmware capsule validation.
  See [packaged rebuild evidence](docs/evidence/packaged-service-rebuild.md).
- [x] Complete the exact rebuilt-service notice/source review and local paired
  delivery, with nine checked payloads and scoped review. Deliberately promote
  its consumer pin; preserve historical archive flags and legacy binary status.
  See [delivery maintenance](docs/service-delivery.md).
- [x] Prepare deterministic local service transport and an independently anchored
  release inventory. Verify bounded fixed-role extraction, complete paired source
  and notices, and actual SDK consumption after transfer. No hosted publication.
  See [transport](docs/service-release.md) and [evidence](docs/evidence/service-release.md).
- [x] Trace all 2,310 LLVM archive objects, runtime compile inputs, custom service
  and installed/generated headers. Preserve 232 checked notice excerpts and 30
  license/grant texts in a pinned review bundle, including internal crypt,
  floating-point, Unicode and Kokkos credits; verify/export it on both CI hosts.
  See [notice trace evidence](docs/evidence/packaged-service-rebuild.md).
  This conservative input review does not establish final binary/delivery clearance.
- [x] Add explicit owned capture/configure/build/compare commands and strict source,
  dependency, manifest, output and failed-phase gates; retain actual generated-header/
  link-archive inventories. Keep OS/shared-cache and upstream runtime-source gaps explicit.
- [x] Add pinned Preview 1 runtime source capture/build/compare commands with explicit
  native inputs, safe archive extraction, source-local isolated generation and
  focused maintenance fixtures. See [runtime maintenance](docs/runtime-source-build.md).
- [x] Record complete clean runtime repeat-build evidence and rebuild/execute the
  compiler service against those exact source-built inputs before consumer promotion.
- [x] Qualify explicit source-built assets in standard Chrome and a native macOS
  WebKit maintenance host, including phase cancellation/deadline cleanup and
  independent artifact validation, without promoting public consumer pins.
- [x] Qualify the promoted asset through all nine actual SDK/private-WebKit cases
  and a fresh separate SwiftPM consumer using a local paired delivery. Retain
  source/notice integrity, service-free APIs and independent deployment gates.
  Signed sandbox/minimum-OS/physical iOS/iPadOS qualification remains M8 work.
- [x] Add a metadata-only candidate inventory binding owned service receipts,
  static module shape, unchanged source package, reviewed firmware source contracts
  and component/notice identities; no binary distribution or pin promotion.
  See [candidate evidence](docs/evidence/candidate-contract-inventory.md).
- [x] Package a bounded versioned inventory of service, runtime, recipes, resources,
  static metadata, sizes, hashes, ABI compatibility, licenses, and notices.
  The 33-payload experimental package includes exact catalogue/evidence; hosted
  provisioning and production/hardware claims remain open.
- [x] Back the offered experimental firmware descriptor with exact trusted export/build evidence;
  exclude synthetic resident metadata and test-only assets from production packages.
  See [consumer packaging](docs/consumer-package.md); firmware upstream input
  reproduction and physical qualification remain explicitly unestablished.
- [x] Test corrupt/missing/truncated assets, unsafe paths, incompatible manifests,
  and independently trusted integrity anchors before execution.
- [x] Verify a packaged consumer build from a fresh environment with no sibling
  references, undeclared inputs, or build-time network access after provisioning.
  Record repeat-build identity or explicitly explained nondeterministic fields.
  [Actual local evidence](docs/evidence/consumer-package.md) covers the clean prepared
  SDK, default APIs, two exact capsules and independent correct/wrong API validation.
  Another host/OS and signed/physical environments remain separate qualification.

Acceptance: another maintainer can reproduce and verify the declared asset set,
its distribution basis is recorded, and consumers can compile with packaged inputs.
Opt-in use of a local service does not complete this gate.
Evidence: [service provenance](docs/service-provenance.md) pins 27 reference files,
13 patches and 19 verified LLVM file changes without modifying the reference or
executing the service. [Resident import](docs/resident-import.md) uses the exact
historical M9 ELF/UF2/report/project-source binding; two supported actual WASM
capsules pass independent production firmware validation, and a repeat build is
byte-identical. Local checks: 117 fast tests passed, one optional-service test
skipped; firmware 20 sanitizer native and 191 host tests passed. Four audit and five
import regressions are part of normal CI. Public assets, full upstream input
reproduction, signed/physical wrapper and hardware qualification remain open.
[GitHub logs](docs/evidence/provenance-ci.md) at `54c1803` confirm all six jobs
passing, with actual-service CI cases explicitly skipped.
The fresh `4d53a28` firmware CI export also imports; its changed API address is
derived correctly and two supported WASM capsules pass independent firmware
validation. The stale historical address is rejected. No hardware qualification.

### M8 — Qualify the initial Nano path through real wrapper environments

Status: partial host evidence. Development-signed ARM64 Release hosts pass six
checks on macOS 27.0, a physical 11-inch iPad Pro (3rd generation), iPadOS
27.0.1, and an iPhone 15 Pro Max, iOS 27.0. Minimum OS, other model/OS combinations,
total memory and Nano deployment remain open. M7 provisioning stays the active
delivery milestone.

The [qualification gate plan](docs/release-qualification.md) records concrete host,
resident and device evidence required next. Existing local macOS wrapper tests are
recorded separately; additional hosts, minimum OS and device deployment remain open.

- [x] Exercise the exact prepared SDK/default compiler in a signed minimal physical iPad host: two fresh app launches pass resources, GPIO/console compilation, diagnostics, busy/cancellation and fresh reentry; exported capsules match desktop bytes and independent firmware validation. This does not qualify the demo, other OS/models or deployment.
- [x] Repeat all six checks in two fresh physical iPhone launches with the identical signed app and existing profile; record measured reports and independently validated exported capsules in the SDK's `docs/compiler-host-iphone.json`. This does not qualify memory/lifecycle, minimum OS or deployment.
- [x] Investigate high wrapper host-memory observations at the owning SDK layer and repeat physical builds. SDK `4edc6aa…` bounds resource-buffer growth/temporary lifetimes; 80 builds pass across two fresh 20-build runs per device with unchanged compiler/capsule inputs. Highest host samples fall from about 790 MiB to 214 MiB on iPad and 209 MiB on iPhone. The SDK's `docs/compiler-resource-memory.json` records exact measurements. Aggregate app/WebKit memory, real pressure/lifecycle and minimum OS remain open.
- [x] Record one actual idle background/return compiler-host check per physical Apple device. The SDK's `docs/compiler-host-lifecycle.json` preserves build-4 source/signing, real scene observations, exact launch PID/context and unchanged exported capsules before/after. These scoped passes do not qualify OS suspension, active-build interruption, memory pressure or Nano deployment.
- [x] Record explicit test-host cancellation of a pending SDK call on inactivity, followed by actual background/return and a fresh known console build, on both physical Apple devices. Build-6 evidence in the SDK's `docs/compiler-host-active-lifecycle.json` records last progress `verifying`, 11.3/4.6-ms typed cancellation settlement and no returned artifact. Worker compile/link interruption and real pressure remain separate open gates.
- [x] Record the separate first-source-compilation inactivity check on both physical devices. The SDK's build-7 `docs/compiler-host-worker-lifecycle.json` pins the compile-time workload and 10.001/8.830-second complete preflights; attempt 1 cancels during the first compiling interval with 19.6/10.2-ms typed settlement, no artifact and known fresh console bytes after background/return. No compiler asset/recipe/catalogue change or board operation; entry-wrapper/link interruption, OS suspension and real pressure remain unqualified.
- [x] Record actual public 60-second runtime deadline expiry on both physical devices. The SDK's build-8 `docs/compiler-host-deadline.json` preserves the pinned derived frontend workload, typed timeout without artifact after 60.201/60.155 seconds, first-source progress, continuous foreground, exact launch/source/signature/context and known same-instance fresh console capsules in 0.694/0.681 seconds. No injected timer or compiler asset/recipe change; signed macOS evidence is recorded separately below, and other interruption/pressure gates remain open.
- [x] Record the same actual public deadline in a signed sandboxed/hardened ARM64 macOS host. The SDK's build-9 `docs/compiler-host-deadline-macos.json` records typed timeout at 60.344 seconds without artifact, first-source progress/foreground, independent launch PID/context and known same-instance console bytes in 1.018 seconds. Two bounded stdout capsule exports independently match the known vectors, without private-container access or new entitlements. Compiler assets/recipes/timers remain unchanged.

- [ ] Select concrete web/wrapper environments and versions to test; create a matrix
  separating portable runtime behavior, wrapper sandbox support, and device behavior.
- [ ] Qualify actual FirmingoKit hosting on intended macOS and physical iOS/iPadOS
  environments. Simulator/device-target builds are separate evidence.
- [x] Select the exact experimental Nano resident and compatible descriptor, compile
  two different supported sketches through the real runtime, and independently
  validate artifacts before a separately authorized deployment workflow.
- [x] Prepare the SDK-owned Nano hardware test host and pinned resident inputs without board access. The SDK's `docs/nano-hardware-preparation.json` records fourteen checked evidence roles, test plan `861e0089…`, guarded one-shot deployment actions, query-only restored records, signed macOS offline compilation with both known capsules and complete macOS/iOS Release builds.
- [x] Complete selected initial Nano setup through Firmware: exact resident plus SDK GPIO capsule in a fully verified ROM composite, then matching macOS hello. SDK `docs/nano-hardware-initial.json` also records signed iOS host installation/launch on iPad over Wi-Fi. Those initial records do not establish managed deployment, startup, GPIO/console behavior or actual Apple USB qualification; later results are recorded below. No compiler pin/recipe change follows from initial setup.
- [x] Deploy both known capsules through the wrapper, verify startup, exact expected
  console bytes and manual GPIO behavior, then replace the sketch on the selected
  iPad and iPhone. Timing/electrical measurements remain unqualified.
- [x] Record the scoped physical iPad two-sketch SDK deployment in `../FirmingoKit/docs/nano-hardware-ipad.json`: both actual capsule identities, reviewed association, verified RAM stage, one host commit attempt and fresh boot-confirmed status per sketch, exact 256-byte console echo and manual D13 off-to-on observation after RESET. Keep prior network/prerequisite failures visible; this does not qualify timing, minimum OS, Internet routing or the authorization/cold-attachment matrix. Equivalent iPhone results are recorded separately below.
- [x] Record the equivalent physical iPhone 15 Pro Max/iOS 27.0 result in `../FirmingoKit/docs/nano-hardware-iphone.json`: identical signed app and capsules, separate console/GPIO stage/commit/startup outcomes, exact 256-byte echo and manual off-to-on observation after RESET. Preserve initial access-prompt Network-is-down failure and explicit read-only retry; upload arm removed after completion.
- [ ] Check relevant cancellation, interrupted operations, reconnect, and stale
  source/selection gates at their owning layer; separate compiler failures from
  firmware/network/upload failures.
- [ ] Record board/revision, resident/source/artifact/service/recipe hashes, wrapper,
  OS/runtime, cable/setup where relevant, actual commands/procedure, and observations.

Acceptance: each claimed combination has evidence from real compilation and useful
hardware behavior. Results distinguish artifact validity, installation, startup,
and behavior; unsupported or untested combinations remain explicit.
Evidence: FirmingoKit's `docs/compiler-host-qualification.md`,
`docs/compiler-host-macos.json`, `docs/compiler-host-ipad.json` and
`docs/compiler-host-iphone.json` record measured signed macOS and physical iPad/iPhone
results. SDK `docs/nano-hardware-ipad.json` adds the scoped Nano two-sketch
managed-deployment result. Minimum OS, aggregate memory, installed-image
attestation and broader platform/device qualification remain pending.

### M9 — Exercise board extensibility and broaden Firmingo sketches

Status: deferred until the Nano path establishes the reusable architecture.

- [ ] Select a second board using its actual Firmingo resident contract, resources,
  capabilities, and memory layout. Assess Pico explicitly rather than assuming support.
- [ ] Add its recipe/descriptor/fixtures without copying runtime infrastructure or
  leaking board-specific behavior into the public interface; update CI and the matrix.
- [ ] Compile and independently validate its artifacts; qualify hardware separately
  before advertising device support.
- [ ] Define the next supported sketch/API/library increment from concrete needs:
  file layout, include/library resolution, pin/core APIs, storage/runtime requirements,
  and reproducible dependency selection.
- [ ] Coordinate necessary firmware ABI/layout changes, version them explicitly, and
  test old/new compatibility and unsupported combinations without weakening validators.

Acceptance: a second explicit recipe exercises the shared architecture; each
broader feature has implemented tests and declared limits. Compile support and
hardware support remain separate claims.
Evidence: pending.

### M10 — Add conventional Arduino compilation as the secondary workflow

Status: deferred. Do not make the initial Firmingo deliverable depend on this track.

- [ ] Select a concrete board/core/sketch subset and pin its conventional toolchain,
  sysroot/libraries, startup, linker script, flash layout, and output format.
- [ ] Add an explicit complete-firmware recipe and artifact mode that shares portable
  preprocessing/runtime code where compatible, without reusing managed ABI assumptions.
- [ ] Validate ELF and complete-image packaging independently; reject managed-capsule/
  UF2 confusion, incompatible libraries, addresses, sizes, and dependencies.
- [ ] Add CLI/web regression builds, CI coverage, and compatibility documentation.
  Keep installation/reading/writing workflows in wrappers.
- [ ] Qualify selected conventional builds on explicitly selected recoverable hardware
  through an authorized wrapper workflow; document the effect on existing Firmingo.

Acceptance: the declared conventional subset builds through WASM to validated
complete images. It does not imply arbitrary Arduino compatibility or continued
Firmingo connectivity after replacement.
Evidence: pending.

### M11 — Document and release the declared scope

Status: not started. Depends on the gates required by the chosen release claims;
deferred M9/M10 features need not delay a Nano Firmingo release.

- [ ] Publish interface examples, a wrapper integration guide, development/asset
  maintenance instructions, migration guidance, and a board/runtime support matrix
  backed by the recorded evidence.
- [ ] Define release versioning, interface/service/recipe compatibility, package
  contents, trusted provenance, and consumer integrity verification.
- [ ] Review the exported package for missing resources/notices, developer paths,
  synthetic descriptors, undeclared dependencies, and stale support claims.
- [ ] Run the applicable fast, actual WASM, web, packaged-consumer, wrapper, and
  hardware checks for the declared scope; record skips and deliberate CI exclusions.
- [ ] Prepare a reviewable release with exact assets/hashes, results, restrictions,
  and migration notes. Publish only when requested and the applicable gates pass.
- [ ] For later toolchain/core/recipe/ABI upgrades, update pins, fixtures, ownership
  docs and CI together; repeat affected validation before expanding support claims.

Acceptance: released contents match tested identities and documented compatibility.
Experimental-only releases clearly state their narrower evidence and limitations.
Evidence: pending.

## Decisions and handoff

User decisions recorded on 2026-10-12:

- Firmingo-Compiler owns the compiler pipeline and build metadata; FirmingoKit owns
  device communication, installation, uploads, and device associations.
- Compiler assets and interfaces are independent of Swift and consumable by wrappers
  providing a web environment. A minimal developer CLI is permitted for testing.
- Firmingo is the primary compilation target; conventional Arduino builds are secondary.
- Nano RP2040 Connect is first; future boards and broader sketches/libraries should
  fit the architecture without implying support before implementation and evidence.
- This agent may work across the three Firmingo repositories when the requested
  change requires it. ArduinoKit remains read-only.

Initial ledger creation involved documentation checks only. The foundation increment
now has input/CLI tests and bounded JSON mutation evidence. M1–M4 are complete for
local development execution; M5's maintained service-free CI scope is verified.
Standard Chrome and macOS SDK hosting are exercised; the scoped development-signed
macOS and physical iPad/iPhone hosts now pass six checks. Other signed/physical hosts,
trusted production firmware exports and hardware remain unqualified. See
`docs/evidence/foundation.md`, `docs/evidence/portable-pipeline.md` and
`docs/evidence/wasm-runtime.md` and `docs/evidence/web-host.md` for the separate
increment records.
