# Firmingo-Compiler — coding assistant guide

## Mission and ownership

Firmingo-Compiler is a reusable WebAssembly-based compiler for sketches targeting
Firmingo firmware. Its primary deliverable is compiler assets and a versioned,
language-neutral interface that wrapper libraries can run in a web environment.
Conventional Arduino firmware compilation is a secondary goal, developed from
shared compiler capabilities where practical.

This repository must not require Swift, Apple frameworks, FirmingoKit, or an
installed native compiler to perform a consumer build. FirmingoKit is one wrapper;
future wrappers may target other languages and operating systems. JavaScript web
hosting is appropriate, but the public data contract must not depend on Swift
types, WebKit message handlers, or a particular application's lifecycle.

| Repository or component | Owns |
| --- | --- |
| Firmingo-Compiler | Sketch preprocessing, WASM execution, board recipes, compile/link orchestration, ELF/capsule packaging, compiler diagnostics, and build metadata |
| FirmingoKit | Swift integration, web-runtime hosting adapters, device communication, installation, uploads, device associations, and host-side deployment checks |
| Firmingo | Device firmware, resident ABI and memory-layout contracts, device-side validation, authorization, execution, and installation |
| Host application | Editing, source snapshots, build selection, presentation, and user decisions |
| ArduinoKit | Read-only historical proof-of-concept reference for WASM Arduino compilation and early Ethernet-over-USB communication |

Compilation must work without an attached device. Static firmware-build metadata
may be a compiler input; physical-device identity, association, communication,
upload authorization, and installed-image evidence belong to wrappers. A compiled
artifact is not permission to install it or proof of useful hardware behavior.

## Initial scope and current facts

At creation of this guide on 2026-10-12, the repository contained only its README,
GPL-3.0 license text, and Git metadata. The first implementation increment now
provides dependency-free portable build/cancel/descriptor validation, bounded JSON
parsing, canonical input identities, draft request schemas/interface documentation,
synthetic fixtures, developer inspection/validation/check commands, regression
and bounded mutation tests, and a CI definition. The portable-stage increment adds
source preparation/location mapping, strict ELF/FMS1 validation, independent
packaging/report/receipt, unchanged Nano recipe assets/integrity/fixed jobs, and
explicit developer preparation/packaging commands; JSON and ELF mutation have
separate CI jobs. Node 22.12.0 is the pinned
maintenance/test runtime; production `src/` modules have no Node imports.

`docs/baseline.json` pins the experimental Nano reference inputs and service
identities. M1 inventory and portable M3 stages are recorded; see
`docs/portable-pipeline.md` for those APIs/compatibility limits.
The initial GitHub browser cleanup failure is corrected; all six jobs at
`9eef0f8` are verified passing, with actual-service compilation explicitly skipped.
See `docs/evidence/browser-cleanup.md` for exact results; recheck facts as work lands.

The current increment implements actual isolated WASI verification/compile/link/
validation/packaging with explicit pinned local service bytes, default browser-capable
module worker and a Node developer adapter. M2 events/receipt/codec and M4 local
execution are implemented; real-service CLI/regressions pass. Vendored unmodified
browser_wasi_shim 0.4.2 retains both notices and its receipt. No compiler binary is
bundled. Standard browser module workers now pass nine headless Chrome 154.0.8037.93
cases on macOS arm64/HTTP loopback, through a minimal readonly developer harness.
The source-only package and Swift hosting adapter now pass nine real macOS WebKit cases
and a separate SwiftPM consumer; see `docs/sdk-adapter.md`. Physical iOS/iPadOS, other
browsers/wrappers, approved distribution and hardware remain unqualified. Missing-service web CI explicitly skips six compilation
cases; see `docs/web-harness.md` and `docs/evidence/web-host.md`.
See `docs/runtime.md` and `docs/evidence/wasm-runtime.md`. Ordinary tests need no
service or sibling checkout. The old SDK standalone runtime/recipe/vendor stack and inactive ELF-only bridge are retired after adapter gates. Both public Swift preparation and supplied-ELF conversion APIs now use the shared service-free worker; native ELF parsing/capsule production are retired while independent deployment validation remains. See `docs/declared-elf-packaging.md` and `docs/sdk-retirement.md`. Explicit original-service memory adaptation lives in `tools/bound-service.mjs`; distribution remains unresolved.

Start with the **Arduino Nano RP2040 Connect** and the existing constrained
Firmingo managed-sketch experiment. Structure recipes so other boards, broader
sketch support, and libraries can be added explicitly without duplicating the
compiler or replacing the public contract. Raspberry Pi Pico support does not
follow merely from sharing the RP2040 chip.

The starting FirmingoKit implementation includes experimental preprocessing,
WebKit/WASI compilation, a Node/WASI development runner, and strict Nano ELF-to-FMS1
packaging. Its constrained managed path is not general Arduino compatibility.
Existing evidence uses synthetic resident bindings for compiler tests and does
not establish physical-device deployment or every wrapper environment.

The existing compiler-service binary's redistribution and reproducible
build-provenance review remains unresolved and is tracked here in M7. Repository creation and code
migration do not resolve that status. Preserve it until evidence supports a change.

M7 maintenance now includes `tools/dev.mjs audit-service` with 27 pinned reference
files/exact 13-patch LLVM reconstruction, and `import-resident` with an explicit
trusted manifest anchor and independent UF2/FAPI checks. See `docs/service-provenance.md`
and `docs/resident-import.md`. The historical exact M9 export supplies experimental
metadata only; default catalogue, distribution and hardware qualification remain open.
All six CI jobs at `54c1803` are inspected passing; exact counts and unavailable
service skips are in `docs/evidence/provenance-ci.md`.

Owned service maintenance now lives in `service/` and `tools/service_build.py`,
with optional isolated Python 3.12.14 and explicit input-manifest anchors. Actual
source capture/build is currently exercised only on the recorded Darwin host;
separate macOS/Linux CI exercises owned synthetic maintenance fixtures. See
`docs/service-build.md` and `docs/evidence/owned-service-build.md` for source,
bootstrap, runtime, source-license and repeat-build boundaries. New development
service outputs never automatically replace consumer pins or enter packages.
Two clean native source builds now reproduce all 96 archives and the complete
bounded WASM service on the recorded host. Actual maintenance execution and
independent firmware capsule validation pass; all eight CI jobs at `04aaed0`
are inspected passing with unavailable-service checks explicitly skipped. See
`docs/evidence/owned-service-build.md` and `docs/evidence/owned-service-ci.md`.

`runtime-build capture|build|compare` now provides owned source maintenance for
the pinned WASI Preview 1 libc/compiler-rt/libc++/libc++abi inputs. Separate
`test-runtime-build` cases cover safe archives, isolated source-local generation,
failure receipts and observed-byte repeat checks; fake inputs are not compiler
evidence. See `docs/runtime-source-build.md` for exact scope and source-generation
limits. Keep native bootstrap provenance, development assets, consumer promotion
and distribution distinct.
Two fresh Preview 1 source builds now reproduce all 2,353 sysroot/resource files
and pass the actual C++ header-discovery gate. A fresh complete service build
against those verified bytes passes real Node compilation/error/reentry checks
and independent firmware image validation. See `docs/evidence/runtime-source-build.md`.
The new asset remains a local development input. Explicit Chrome and macOS HTTP-loopback
WebKit maintenance checks now pass nine cases each, with artifact identity across
Node/Chrome/WebKit and independent firmware validation; see `docs/built-service-web.md`
and `docs/evidence/built-service-web.md`. Public SDK/private-scheme/package promotion,
complete source/notice packaging and distribution remain unresolved. Normal CI observes
candidate absence rather than fetching it; Swift hosting stays in FirmingoKit.

The author confirmed ArduinoKit and local LLVM patch ownership on 2026-10-13.
`service/source/` now preserves all 23 pinned service/header/patch input bytes
under his GPL-3.0-only grant, with the upstream LLVM root license retained.
Use the explicit `serviceSourceRoot` maintenance provider for these owned inputs;
the historical reference remains read-only. `export-service-materials` creates
a deterministic source-and-selected-notice review directory, not complete
Corresponding Source or binary distribution approval. See
`docs/service-licensing.md`. Do not add a generated-output license exception or
replace upstream terms based on the author's original-contribution grant.

`source-package build|verify` now assembles an anchored source-only candidate
archive with both recipes' raw LLVM sources, complete pinned WASI source inputs,
grant/notices, source headers and rebuild scripts. `llvmSourceRoot` allows both
maintenance paths to consume verified raw snapshots without a Git cache or
sibling checkout. Real packaged-runtime and full service rebuilds now reproduce
all runtime files, the module, 96 archives and 6,182 compiler dependency bytes.
Actual WASM checks and independent firmware validation pass; see
`docs/evidence/packaged-service-rebuild.md`. Preserve unresolved distribution
status until the remaining final binary-notice/delivery review is supported. See
`docs/source-package.md` and `docs/evidence/source-package.md`.

`verify-service-notices [unpacked-source-root]` now checks a pinned documentation
bundle with 232 source-comment excerpts and 30 license/grant texts. The optional
root verifies selected whole-source identities and reconstructs the notice texts;
it is not full archive verification. Normal tests and the deterministic review
export include the bundle. Treat conservative compiled-input coverage separately
from final binary/delivery clearance; see `docs/service-upstream-notices.md` and
`docs/evidence/packaged-service-rebuild.md`.

## Working across the repositories

The exact reproduced service `a7648688…` now has a completed scoped source/notice
and paired-delivery review in `service/delivery-review.json`. `service-package`
stages/verifies nine binary/source/documentation roles locally; it never publishes.
Public consumer pins select that service and the source-only export is `4cbdf856…`.
Historical candidate/grant/inspect records retain their original status fields;
the historical `3e2544ac…` binary remains unresolved. SDK private-origin and fresh
consumer checks are tracked in `docs/evidence/service-delivery.md`. No service is
committed or bundled, no production descriptors are added and hardware remains
unqualified. Do not describe this scoped review as permission for arbitrary assets.

`service-release build|verify|extract` now prepares deterministic stored-ZIP
transport with an independently anchored release inventory. It verifies the paired
delivery and every source member, bounds archive parsing/extraction and rechecks
transport identities after source verification. It never downloads or publishes.
See `docs/service-release.md` and `docs/release-qualification.md`; keep binary
provisioning, trusted resident catalogue and signed/physical/device claims separate.

`consumer-package` assembles/verifies 33 offline payloads under immutable
`consumer/review.json` selection. The experimental Nano catalogue derives from
firmware CI export `9246a7da…` at `e0a79d1…`, build `c44d25ef…`, API `0x10022c9c`.
This supplies no installed-image/hardware evidence. FirmingoKit owns clean SDK
package preparation/default loading; binaries remain outside Git. See
`docs/consumer-package.md`.

FirmingoKit's minimal development-signed ARM64 Release host now passes six actual
compiler checks on macOS 27.0 and in two physical iPad Pro (11-inch, 3rd generation)
launches on iPadOS 27.0.1. The SDK owns `docs/compiler-host-qualification.md` and
`docs/compiler-host-ipad.json`, including signing/provenance, measured reports and
independent validation of exported capsules. The identical signed app also passes
two physical iPhone 15 Pro Max launches on iOS 27.0; the SDK records exact reports
and exported capsule validation in `docs/compiler-host-iphone.json`. These are
scoped wrapper results; minimum OS, other model/OS combinations, total memory
and board deployment remain open.
The SDK's resource-reader fix at `4edc6aa…` now passes two fresh 20-build runs per
device, with unchanged compiler inputs/capsules and highest sampled host footprints
of 214 MiB on iPad and 209 MiB on iPhone, down from about 790 MiB. See its
`docs/compiler-resource-memory.json`. This changes no compiler assets or board
claims; aggregate app/WebKit memory and real pressure/active-build lifecycle remain open.
The SDK's build-4 host also passes one actual manual idle background/return check
on each physical device, with the same launch PID/context and known exported
capsules before/after. See its `docs/compiler-host-lifecycle.json`. Scene events
do not establish OS suspension, active-build interruption or pressure recovery.
The SDK's build-6 host adds explicit cancellation on inactivity while a public SDK
call is pending. Both physical devices pass with last reported progress `verifying`,
no returned artifact and known fresh console bytes after background/return. See
its `docs/compiler-host-active-lifecycle.json`. Worker compile/link interruption,
real pressure and automatic SDK lifecycle policy are not qualified by these passes.
The SDK's build-7 host separately passes first-source-compilation interruption on
both devices with a pinned 227,505-byte compile-time fixture and complete measured
preflights. Attempt 1 cancels on inactivity with exactly one compiling notification,
19.6/10.2-ms typed cancellation settlement, no artifact and known fresh console
bytes after real background/return. See its `docs/compiler-host-worker-lifecycle.json`.
This is explicit test-host policy and callback-phase evidence; entry-wrapper/link
interruption, OS suspension and real pressure remain open. Compiler assets,
recipes, catalogue and device claims are unchanged.
The SDK's build-8 host separately passes actual public 60-second runtime expiry
on both physical devices: typed timeout without artifact after 60.201/60.155
seconds, exactly one source-compiling notification, then known same-instance
fresh console capsules in 0.694/0.681 seconds. Its `docs/compiler-host-deadline.json`
pins the derived workload, source/signature, launch context, foreground events
and exported bytes. No timer, SDK implementation or compiler asset is changed.
Entry-wrapper/link interruption, aggregate memory, real pressure and child
termination remain separate open gates.
The SDK's signed ARM64 macOS build 9 separately passes the same production
deadline workload on macOS 27.0: typed timeout at 60.344 seconds without artifact,
first-source progress and known same-instance fresh console bytes in 1.018
seconds. Its `docs/compiler-host-deadline-macos.json` preserves independent
launch PID/context, real foreground observation, exact source/signature and
two bounded stdout capsule exports checked against the known vectors. Sandbox,
hardened runtime and the existing two entitlements are verified; compiler assets,
recipes, SDK implementation and timers are unchanged.
FirmingoKit now also prepares a separate Nano hardware-qualification app and
fourteen resident-evidence roles from this exact consumer package. Its
`docs/nano-hardware-preparation.json` records signed macOS offline compilation
with the same known capsules and complete macOS/iOS Release builds. A separately
selected Firmware-owned initial composite now combines the exact exported
resident with the SDK GPIO capsule, initializes the first managed sector, passes
full ROM verification before boot and answers a matching macOS hello. The signed
iOS host is installed/launched on iPad over Wi-Fi; that initial setup alone does
not qualify SDK upload/startup/behavior or physical Apple USB operation. See Firmware's
`docs/evidence/nano-sdk-initial.json` and SDK `docs/nano-hardware-initial.json`.
Compiler assets, descriptor identities and recipe claims are unchanged.
SDK `docs/nano-hardware-ipad.json` now records the scoped physical iPad two-sketch
pass through that exact package: actual exported capsule bytes, reviewed resident
association, verified RAM stage, one host commit attempt and fresh boot-confirmed
status per sketch, exact 256-byte console echo, and a manual D13 off-to-on GPIO
transition after a RESET baseline. Both saved per-boot transaction records and
earlier failures remain pinned. This is experimental iPadOS 27.0.1/build-3 evidence,
not minimum OS, general Arduino, timing, cold-attachment/authorization matrix,
Internet routing or power-loss qualification. The iPhone has separate evidence
below. The compiler gains no device
I/O or installation responsibility from the wrapper result.
The same signed build 3 now passes the equivalent two-sketch workflow on iPhone
15 Pro Max/iOS 27.0, pinned in SDK `docs/nano-hardware-iphone.json`. Its initial
access-prompt inspection failed with Network is down; a later explicit read-only
retry passed, and the failure remains recorded. Both independent final journals
and per-boot records confirm the scoped outcomes; the D2 upload arm was removed
after completion. No compiler service/recipe/descriptor/ABI change was required.

The user has authorized this coding agent to work across Firmingo-Compiler,
FirmingoKit, and Firmingo. Earlier sibling guidance treating Firmingo as read-only
or assigning compilation to FirmingoKit is superseded by that ownership decision
for this split. Inspect each repository's applicable guidance and working state;
retain unrelated conventions and preserve other work.

- Make cross-repository changes when needed for the requested task, not simply
  because access is available. This guide's creation does not request the migration
  or changes to firmware behavior.
- ArduinoKit remains strictly read-only. Do not edit it, generate files in it,
  run commands that write into it, or change its Git state. Put adaptations and
  validation outputs in the destination repository.
- Do not reset, stash, clean, discard changes, or switch another working checkout
  to obtain a convenient reference. Use pinned commits or supplied exports when a
  consistent snapshot is necessary.
- Track exact source commits, relevant file hashes, and any uncommitted reference
  differences used for migration or contract work. Avoid developer-specific paths
  in implementation, tests, and distributed assets.
- Ordinary consumer builds and tests must not require sibling checkouts. Import
  versioned, checksummed contract resources or declare an explicit dependency.
- Update affected ownership documentation, wrapper adapters, tests, and dependency
  references with each actual migration. Do not leave duplicate implementations
  with unclear authority or remove a working path before its replacement is tested.
- Preserve public FirmingoKit compatibility where practical. Explain necessary API,
  schema, asset, or recipe compatibility changes and provide a migration path.

Start research with these repository-relative references:

| Reference checkout | Starting points |
| --- | --- |
| FirmingoKit | `AGENTS.md`, `docs/compiler.md`, `docs/compiler-catalogue.md`, `docs/compiler-service-observations.md`, `Tools/ManagedWASM/README.md`, `Sources/FirmingoKit/Compiler/`, and compiler runtime/resources referenced there |
| Firmingo | `docs/README.md`, `docs/integration/managed-sketch-sdk.md`, `docs/protocol.md`, `experiments/managed_sketch/`, relevant board definitions, fixtures, and evidence |
| ArduinoKit | `README.md`, `Tools/ArduinoDirectWASM/README.md`, and referenced compiler-service/runtime sources and licenses |

Read only what the task needs. Historical records are evidence, not instructions
to reproduce old limitations or claim current support. If specification, code,
fixtures, and observations disagree, describe the conflict and resolve the
affected contract rather than silently choosing convenient behavior.

## Architecture and public contract

Keep preprocessing, execution, recipes, artifact validation, and resource loading
separate behind small, explicit interfaces. Prefer straightforward modules and
immutable build inputs over a broad framework. Share production logic between web
hosting and developer tools; tests must exercise that logic.

Before freezing the interface, document it in `docs/interface.md` with exact
request, response, event, error, and binary-transfer examples. Define:

- Interface, service ABI, recipe, manifest, and artifact-format versions, including
  compatibility and unsupported-version behavior.
- Explicit target/recipe selection, source filenames and bytes, source revision or
  equivalent caller token, and allowed build options. Do not select a moving
  latest firmware or infer another board's recipe.
- Source encoding, bounded virtual paths, binary artifact representation, and
  integer ranges that remain unambiguous across languages.
- Correlated build identifiers, ordered progress/diagnostic events, terminal
  results, busy behavior, cancellation, deadlines, and runtime cleanup.
- Structured diagnostics with severity, stage, file/range when available, stable
  error codes, and preserved compiler details. Map generated-source locations
  back to caller source where possible.
- Distinct preprocessing, compile, link, validation, and packaging outcomes. A
  successful intermediate stage must not become a successful build result.
- Build receipts covering source, target, recipe, toolchain, resources, static
  firmware metadata, and artifact identity. Caller-supplied provenance is not
  authenticated merely because it is well formed.

Keep the data contract portable through documented serialization and typed binary
buffers. Do not expose native filesystem paths, browser UI objects, or wrapper
device models as required inputs. Validate messages at every boundary; reject
malformed or unsupported inputs explicitly without substituting another recipe.

Do not introduce a cloud build service, IDE, general web editor, network protocol
client, flashing backend, or device discovery into the compiler. A minimal
developer CLI or web test harness is appropriate when it exercises the library.

## Web execution and resource limits

- Consumer compilation runs locally through WASM in a wrapper-provided web
  environment. Do not require native compiler processes, shell execution, Node,
  a visible web view, or a remote fallback in the consumer path.
- Node or another pinned host may power the development CLI. CLI success does not
  establish browser compatibility; keep host-specific code outside compiler logic.
- Document required WASM/WASI features, imports/exports, worker and resource-loading
  behavior, and relevant browser restrictions. Do not assume unrestricted files,
  shared memory, network access, or browser headers a native web wrapper cannot set.
- Use isolated bounded workspaces per build. Validate paths; prevent traversal and
  cross-build file leakage. Never execute the resulting microcontroller artifact
  in the compiler host.
- Bound source and library inputs, file counts, compiler output, diagnostics,
  virtual filesystem size, WASM memory, artifacts, pending events, and duration.
  Reject resources whose declared or observed limits violate policy.
- Start with one active build per runtime and an explicit busy response. Add
  concurrency only with a documented isolation and resource-budget policy.
- A deadline or cancellation must terminate unresponsive compiler work, settle
  pending results once, discard partial artifacts, and permit a fresh clean build.
  Do not rely solely on a cooperative callback from synchronous WASM work.
- Associate every result with its exact input identity. Reject late/stale results;
  do not automatically retry, reuse artifacts, or publish success after cancellation.
- Keep user source and payloads out of routine logs. No build-time network access
  or telemetry is required after approved assets have been provisioned.

## Board recipes, preprocessing, and artifacts

Every offered target needs an explicit pinned recipe: board/profile, CPU/triple,
compiler and linker flags, facade or core, headers/libraries, linker script,
memory limits, output format, and compatible firmware ABI/build metadata.
Share assets where compatible; board IDs and support states remain explicit.

For Firmingo managed builds, the selected firmware contract governs capsule
format, API-table binding, entry points, relocations, permitted sections, and
memory layout. Independently validate ELF and capsule bytes before returning a
deployable artifact. Reject incompatible architecture, addresses, unsupported
state, oversized images, invalid digests, or inconsistent metadata.

The existing Nano path has a constrained Arduino-shaped facade and stateless
module requirements. Do not silently relax those rules, invent supported calls,
or advertise arbitrary Arduino libraries. Broader support requires deliberate
compiler and firmware contract work, tests, and board-specific evidence.

Preprocessing must preserve reproducible source identity and useful diagnostics.
Document supported `.ino` behavior, generated declarations/includes, multiple-file
rules, and library resolution. Unsupported syntax or APIs must produce explicit
diagnostics rather than accidental acceptance or misleading success.

Conventional Arduino firmware is a separate target mode with its own complete-image
recipe and validation. UF2 or another complete image must not be confused with a
managed capsule. Such a build can replace Firmingo on a board; the compiler must
not promise retained Firmingo communication or recovery after installation.
Programming remains the wrapper's responsibility.

Hashes establish byte identity, not publisher trust or installed-image attestation.
Build reports should distinguish structural validity, recipe compatibility,
measured runtime behavior, and hardware qualification.

## Dependencies, licensing, and asset distribution

Pin compiler/service, toolchain, core, runtime shim, libraries, and packaging tools
with version/source and integrity records. Evaluate upgrades intentionally; do
not silently fetch latest assets or patch a developer's global installation.

Keep vendor sources, licenses, notices, modifications, and patch reasons
identifiable. Record how WASM services and sysroots were produced and how to
reproduce them. The repository license does not automatically license referenced
or copied third-party assets.

Preserve unresolved status for historical/unreviewed assets. Use the exact rebuilt
service's pinned delivery review for local packaging; do not put an
unreviewed binary into committed resources or releases to make tests pass. An
explicit local development input may support opt-in tests with its provenance and
limits recorded. Continue independent interface, recipe, and validation work while
distribution evidence is missing; do not invent approval requirements for unrelated
work.

Distributed assets need a bounded versioned inventory of paths, byte counts,
hashes, service ABI, recipes, and notices. Verify resources before execution.
Integrity anchors must come from a trusted package/release context rather than
the same unchecked input they purportedly authenticate. Document any release
source/notice obligations established by the dependency review.

## Repository structure and developer tools

Create structure incrementally; do not create empty modules just to match a plan.

| Proposed path | Responsibility |
| --- | --- |
| `src/` | Language-neutral compiler orchestration, preprocessing, diagnostics, and validation |
| `runtime/` | Web/WASI execution and narrow host boundaries |
| `recipes/<board>/` | Versioned board/profile recipes and required resources |
| `assets/` | Approved compiler resources and integrity manifests |
| `schemas/` | Public request/result/manifest schemas and examples |
| `tests/` | Unit, real-runtime, contract, and integration tests with provenance-bearing fixtures |
| `web/` | Minimal developer harness and actual standard-browser checks, no editor/device client |
| `tools/` | Minimal CLI, asset build/package/verify workflows, and maintenance tools |
| `docs/` | Interface, architecture, development, migration, compatibility, and evidence |
| `third_party/`, `patches/` | Identifiable vendor dependencies and reviewable changes |

Provide documented entry points with help for setup inspection, tests, real WASM
builds, and packaging as they become necessary. Setup checks should explain missing
tools without silently modifying the system. The CLI must use the library's actual
inputs, execution, validators, diagnostics, and artifacts; keep it a test/development
tool rather than a parallel compiler implementation or device client.

## Validation and evidence

Ordinary tests must be deterministic, bounded, and independent of hardware, sibling
checkouts, live network services, Swift, and Apple tools. Use pinned fixtures and
fixed seeds, print useful failures and rerun commands, and avoid timing-sensitive
sleeps where controllable state suffices.

Cover substantive boundaries and error paths:

- Preprocessing/source mapping, supported sketches, unsupported libraries/options,
  explicit target selection, and invalid source inputs.
- Malformed requests, missing/corrupt assets, incompatible service ABI, invalid
  paths, memory/output limits, and worker or compiler failures.
- Isolation, busy behavior, cold/warm runs, cancellation during real compilation,
  deadline termination, late results, and a successful fresh build after failure.
- Invalid/truncated ELF and capsules, boundary addresses/sizes, wrong board/ABI or
  firmware binding, artifact-mode confusion, receipts, and binary byte preservation.
- Reproducibility and asset packaging, including successful execution without
  undeclared development dependencies or network access.

Add real compile/link/package tests using the actual WASM service. Mocks do not
establish source-to-code support. Validate outputs with independent firmware
vectors/validators where available, not just a producer/consumer round trip sharing
the same implementation. Synthetic records and non-executable parser fixtures must
be clearly labeled and never deployed.

Keep fast tests, real WASM integration, web-runtime tests, and hardware qualification
separate. Opt-in tests with unavailable assets or hardware are skipped or blocked,
never passed. Establish browser execution as well as CLI execution before claiming
web support. Wrapper platform qualification remains a separate integration result.

Hardware checks require a selected board and an authorized device workflow. Compile
through the real runtime, deploy through a wrapper, verify startup and exact expected
behavior, then repeat with another sketch. Record board, resident/artifact hashes,
compiler and recipe identities, wrapper/runtime, OS, procedure, and observations.
Compilation, capsule validation, upload, startup confirmation, and useful behavior
are separate outcomes. Do not make hardware changes part of default compiler tests.

Add CI with implementation and keep it aligned with the same documented local
entry points. Observe fast tests, real-runtime integration, and maintained recipe
builds independently. Preserve failing exit status and diagnostic artifacts; use
`shell: bash` for GitHub Actions pipelines using `tee`, retain matrix
`fail-fast: false`, and validate workflow edits with actionlint when available.
A local pass does not establish a GitHub pass. Documentation-only changes need
factual/link review and diff hygiene, not new compiler or hardware tests.

## Implementation order and completion

1. Inventory the existing FirmingoKit compiler and pin the source/firmware references,
   service provenance, constraints, and migration boundaries.
2. Define the language-neutral interface and extract a coherent Nano managed path
   with actual preprocessing, compile/link, independent validation, and receipts.
3. Add the minimal CLI and real WASM regression tests, including bounded failure,
   cancellation, workspace cleanup, and fresh-build behavior.
4. Integrate FirmingoKit through a wrapper adapter; update ownership guidance and
   preserve tested API behavior without a runtime dependency on sibling checkouts.
5. Establish reproducible approved assets and web-host integration evidence; qualify
   specific Firmingo compiler/recipe/resident combinations separately on hardware.
6. Add other boards and broader sketch/library support through explicit recipes;
   pursue conventional Arduino outputs as the secondary workflow.

Implement the requested increment, not the whole roadmap automatically. Resolve
routine implementation choices independently; ask when an unresolved decision
changes compatibility or observable behavior, while continuing unaffected work.

For each change, report what changed, why, exact checks actually run, results, and
remaining limitations. Keep changes reviewable, preserve unrelated behavior, and
never claim compiler, web-runtime, distribution, or hardware support solely from
source inspection, a mocked success, or another project's historical result.

The service-free `PreparationController`/worker now isolates portable source preparation
and backs both SDK preparation APIs; see `docs/service-free-preparation.md` for current
source-package identities and actual checks. No binary is needed for that stage.

## Candidate inventory and source-contract maintenance

`import-resident` supports legacy schema 1 and schema 2 with six exact firmware
source/license resources and a reviewed Nano contract-to-recipe mapping. Schema-1
imports explicitly have no verified source contract. `inventory-candidate` requires
schema 2 and independently anchored successful owned-build inputs; it verifies
static service shape and recreates the unchanged source-only package, then emits
metadata only. No candidate instance, binary package, public pin promotion or
device operation occurs. See `docs/candidate-inventory.md` and its actual evidence.
Keep native proof sources as pinned fixture/reference data, never another compiler.
