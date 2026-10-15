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
| Qualify wrapper host | FirmingoKit: actual compiler through the host's private origin/sandbox, integrity failures, cold/warm builds, errors, busy/cancel/deadline cleanup, fresh reentry | Development-signed ARM64 macOS 27.0 and recorded physical iPad/iPhone Release hosts pass six checks and scoped first-source deadline recovery below; both physical devices also pass inactivity cancellation. Minimum OS, other model/OS combinations and aggregate memory remain open |
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
790 MiB while WASM linear bytes remain 27,983,872. A subsequent SDK-only reader
fix (`4edc6aa…`) reserves the bounded owned snapshot and drains Foundation chunk
temporaries. Two fresh 20-build runs per device now pass all 80 builds with
unchanged compiler/capsule identities; highest host samples are 214 MiB on iPad
and 209 MiB on iPhone. Both original six-check modes also pass. The SDK's
`docs/compiler-resource-memory.json` records exact source, signing and observations;
the earlier reliability record remains unchanged. These are self-process samples,
not aggregate app/WebKit peaks or a leak-free/memory-budget pass.
App-scoped profiling could not attach; pressure,
remaining active-build lifecycle stages and child-process termination remain open.
Compiler/service/recipe/catalogue bytes are unchanged and no board is contacted.

The SDK's build-4 host now passes an actual manual **idle** background/return check
on each recorded physical device. The same launch PID/context persists through
10.235 seconds between background/active observations on iPad and 20.166 seconds
on iPhone; known GPIO/console builds and exported bytes pass before/after. Its
`docs/compiler-host-lifecycle.json` records source/signing, scene events, report
hashes and capsule bytes. An iPhone snapshot taken during the final build is
rejected; the completed same-process snapshot passes without relaunch. This does
not establish OS suspension, background compilation or real memory-pressure
recovery. No compiler asset or board claim changes.

The SDK's build-6 host now also passes an explicit **host-policy** cancellation
test on both devices. On scene inactivity it cancels the pending public SDK call;
both calls last reported `verifying`, settle with `CancellationError` without an
artifact in 11.3/4.6 ms, then accept fresh known console builds after actual
background/active return. Its `docs/compiler-host-active-lifecycle.json` pins the
source/signature, exact launch PID/context, attempts, scene events and exported
capsules. This is scoped SDK-call verification-phase evidence. Interruption
inside worker compilation/linking, OS suspension, real pressure and any automatic
SDK lifecycle policy remain unqualified. Compiler inputs and board claims stay
unchanged.

The SDK's build-7 host separately qualifies cancellation on inactivity during the
first **source-compilation** interval on both devices. Its pinned 227,505-byte
compile-time fixture completes a preflight producing the unchanged GPIO capsule,
with measured source intervals of 10.001 seconds on iPad and 8.830 on iPhone.
Both manually started attempts cancel after exactly one compiling notification,
settle with `CancellationError` and no result in 19.6/10.2 ms, then produce the
known console capsule after actual background/return in the same process.
The SDK's `docs/compiler-host-worker-lifecycle.json` preserves exact source/signing,
workload, launch PID/context, reports, events and four checked exported capsules.
Both devices remain connected over `localNetwork` before/after. This is scoped
test-host policy and callback-phase evidence, not an instruction-pointer trace or
OS-suspension/pressure result. Entry-wrapper/link interruption, aggregate memory,
forced child termination remain open. Compiler inputs and
board claims are unchanged.

The SDK's build-8 host now also passes actual **public runtime deadline expiry**
on both physical devices. A pinned 227,646-byte derived compile-time workload
keeps the first source compile pending without changing compiler assets, recipe,
SDK implementation or its native/portable 60-second timers. The iPad returns
`ManagedCompilerError.timedOut` after 60.201 seconds and the iPhone after 60.155,
without artifacts. Known fresh console capsules then build through the same
compiler instances in 0.694/0.681 seconds. Both remain foreground and connected
over `localNetwork`; losing foreground invalidates this particular test.
The SDK's `docs/compiler-host-deadline.json` preserves source/signing, workload,
independent launch PID/context, progress/events, report hashes and four checked
exported capsules. This is first-source deadline/cleanup/reentry evidence;
which native/portable timer wins, entry-wrapper/
link interruption, real pressure and aggregate memory remain separate questions.
No board operation or compiler/binary publication occurs.

The SDK's signed sandboxed/hardened ARM64 macOS build 9 now passes that same
public deadline workload on macOS 27.0 (26A428). The public call returns typed
timeout without artifact after 60.344 seconds, with one source-compiling
notification and real foreground observation; the same compiler instance then
produces the known console capsule in 1.018 seconds. Its
`docs/compiler-host-deadline-macos.json` records exact committed/generated source,
OS/toolchain/WebKit framework, signature, independent launch PID/context,
report/events and two bounded stdout capsule exports independently checked
against the known byte vectors. Existing sandbox/network-client entitlements and
the development certificate are retained. The identical signed app also passes
the original six-check regression. No private-container permission, new compiler
asset, timer change or device operation is introduced. Minimum OS, aggregate
memory, real pressure, forced child termination and entry-wrapper/link-stage
interruption remain separate open gates.

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
