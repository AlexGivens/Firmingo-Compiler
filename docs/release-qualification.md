# Next qualification gates

The initial release scope is the constrained Nano RP2040 Connect managed-sketch
recipe. The exact service has reviewed paired source delivery and local
Node/Chrome/macOS WebKit evidence. This does not establish arbitrary Arduino
libraries, conventional complete firmware images, another board, a signed sandbox,
minimum-OS execution or device behavior. [Delivery evidence](evidence/service-delivery.md)
records the existing passes; [transport evidence](evidence/service-release.md)
records provisioning separately.

| Gate | Owner and required evidence | Current boundary |
| --- | --- | --- |
| Provision exact compiler | Compiler: deterministic transport, independent inventory anchor, all source/notices, fresh extraction and actual wrapper compile | Local transport; no hosted binary release or automatic downloader |
| Select static resident contract | Firmware: exact build/export hashes, source contract, board/profile/layout and independent capsule validator; Compiler imports only a trusted anchored export | Experimental exports exist; default production catalogue stays empty |
| Qualify wrapper host | FirmingoKit: actual compiler through the host's private origin/sandbox, integrity failures, cold/warm builds, errors, busy/cancel/deadline cleanup, fresh reentry | macOS local test host passes; signing, minimum OS and physical iOS/iPadOS remain open |
| Qualify device deployment | Firmware and FirmingoKit: selected recoverable board, exact installed resident evidence, capability recheck, two actual sketches, upload reconciliation, startup and measured bytes/GPIO | No device operation or hardware qualification from compiler tests |

For the next host check, select an exact macOS app signing/sandbox configuration
and record entitlements, OS, architecture, Xcode/Swift/WebKit versions, SDK commit,
source-only runtime manifest, release inventory, service/source/review hashes,
recipe and resident binding. Run actual SDK build APIs with the extracted service.
Record cold and repeated builds separately, compiler failure diagnostics,
cancellation/deadline disposal and successful fresh builds. Reuse the existing
SDK `ManagedWebKitCompilerTests` and separate resource-consumer checks for local
preflight. A package test executable is not evidence of a signed application.
Do not widen SDK platform claims from a build against the latest SDK.

Physical iPhone/iPad qualification needs selected models/OS versions, a provisioned
host app and the same provenance. Record memory-pressure/termination outcomes and
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
