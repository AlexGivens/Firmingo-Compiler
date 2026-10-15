# Next qualification gates

The initial release scope is the constrained Nano RP2040 Connect managed-sketch
recipe. The exact service has reviewed paired source delivery and local
Node/Chrome/macOS WebKit evidence. This does not establish arbitrary Arduino
libraries, conventional complete firmware images, another board,
minimum-OS execution or device behavior. [Delivery evidence](evidence/service-delivery.md)
records the existing passes; [transport evidence](evidence/service-release.md)
records provisioning separately.

| Gate | Owner and required evidence | Current boundary |
| --- | --- | --- |
| Provision exact compiler | Compiler: deterministic transport, independent inventory anchor, all source/notices, fresh extraction and actual wrapper compile | Local transport; no hosted binary release or automatic downloader |
| Select static resident contract | Firmware: exact build/export hashes, source contract, board/profile/layout and independent capsule validator; Compiler imports only a trusted anchored export | One exact experimental descriptor is packaged; installed-image evidence and broader firmware provenance remain open |
| Qualify wrapper host | FirmingoKit: actual compiler through the host's private origin/sandbox, integrity failures, cold/warm builds, errors, busy/cancel/deadline cleanup, fresh reentry | Development-signed ARM64 macOS 27.0, physical iPad Pro/iPadOS 27.0.1 and iPhone 15 Pro Max/iOS 27.0 Release hosts pass six checks; minimum OS, other model/OS combinations, total memory and forced deadline remain open |
| Qualify device deployment | Firmware and FirmingoKit: selected recoverable board, exact installed resident evidence, capability recheck, two actual sketches, upload reconciliation, startup and measured bytes/GPIO | No device operation or hardware qualification from compiler tests |

The first signed macOS host check now passes with an exact prepared SDK, Apple
Development signing, app sandbox and hardened runtime. FirmingoKit records source,
signature, measured journal and CI boundaries in `docs/compiler-host-qualification.md`
and `docs/compiler-host-macos.json`. These wrapper-owned records change no compiler
pins or board claims. Two launches on one physical iPad Pro (11-inch, 3rd generation),
iPadOS 27.0.1 now pass the same six checks. The SDK's `docs/compiler-host-ipad.json`
records actual signing/profile, reports, times and exported capsule bytes. Both
capsules match desktop output and pass independent firmware image validation for
the selected API, with the stale address rejected. No board communication or
deployment occurred; this is one iPad/model/OS combination.

The identical signed app also passes all six checks in two fresh iPhone 15 Pro
Max launches on iOS 27.0 (24A437), using the existing profile without rebuilding
or provisioning changes. The SDK's `docs/compiler-host-iphone.json` records both
reports, exact source/signature context and exported capsule bytes. First-launch
GPIO/console times are 0.858/0.663 seconds. Both capsules match the iPad/desktop
vectors and independently validate for the selected API, with the stale address
rejected. This adds one iPhone/model/OS combination, without a board operation or
total-memory/lifecycle qualification.

FirmingoKit's updated build-2 host now also completes 20 baseline and 20 fresh
post-interruption builds on each physical Apple device. Two explicit whole-app
SIGKILL tests preserve rejected incomplete journals without replay/overwrite;
the original six-check mode still passes. The SDK's `docs/compiler-host-reliability.json`
records exact inputs and measurements. Sampled host footprints reach about
790 MiB while WASM linear bytes remain 27,983,872; investigate resource loading,
temporary buffers and native/WebKit transfer ownership before broader host
qualification. These are self-process samples, not aggregate app/WebKit peaks
or a leak-free/memory-budget pass. App-scoped profiling could not attach; pressure,
background/foreground, child-process termination and deadline expiry remain open.
Compiler/service/recipe/catalogue bytes are unchanged and no board is contacted.

For additional host checks, select an exact app signing/sandbox configuration
and record entitlements, OS, architecture, Xcode/Swift/WebKit versions, SDK commit,
source-only runtime manifest, release inventory, service/source/review hashes,
recipe and resident binding. Run actual SDK build APIs with the extracted service.
Record cold and repeated builds separately, compiler failure diagnostics,
cancellation/deadline disposal and successful fresh builds. Reuse the existing
SDK `ManagedWebKitCompilerTests` and separate resource-consumer checks for local
preflight. A package test executable is not evidence of a signed application.
Do not widen SDK platform claims from a build against the latest SDK.

Additional physical iPhone/iPad qualification needs selected models/OS versions,
a provisioned host app and the same provenance. Record memory-pressure/termination outcomes and
source/selection changes during an active build. Source snapshots stay local;
compilation does not require a board. Signed installation and physical execution
must actually occur before those matrix rows become qualified.

Before device testing, select an exact Nano board/revision and recoverable firmware
image using Firmingo's release/testing guidance. The wrapper must bind a trusted
descriptor to installed-image evidence and current capabilities; hello alone does
not attest the resident image. Compile two supported sketches against that exact
resident, independently validate each capsule, then deploy through an explicitly
authorized SDK hardware workflow. Record upload/commit acknowledgement, startup
and exact useful behavior as separate outcomes. Use firmware stream tests for
binary integrity and manual host checks for USB authorization/routing. Preserve
reset/flash/install as separately selected actions.

Keep synthetic compiler fixtures, test descriptors and generated parser capsules
out of deployment. Record unavailable hosts/boards as untested, and report failures
at their owning layer. A completed transport or checksum match cannot clear a
missing host, installed-image or hardware result. The next release may be explicitly
experimental with narrower claims; publication remains a requested final action.
