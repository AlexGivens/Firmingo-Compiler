# Reviewed service delivery and consumer qualification — 2026-10-14

The exact service/source/notice review is complete for the reproduced module,
SHA-256 `a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
The scoped 3,256-byte review SHA-256 is
`2627a80ee5845929f030cfec6253f05e3cfc4f8c98bff69a0117b3d78114cb26`.
It binds the completed [packaged rebuild](packaged-service-rebuild.md), source
archive `dcdbe2d1…`, 232 source-notice excerpts and all retained license/grant texts.
Historical candidate flags are unchanged; the new paired envelope records later
review. The legacy service remains unresolved. No release is published.

Actual paired delivery build and independent verification:

```sh
node tools/dev.mjs service-package build .build/final-packaged-service-build \
  .build/candidate-source-package-final/source.tar.gz .build/reviewed-service-delivery-r1
node tools/dev.mjs service-package verify .build/reviewed-service-delivery-r1 \
  261dcdfd80b39c11d522289d8ac411b0882cdc36ec91f370b0f92f11f2957d39
```

The isolated Python 3.12.14 maintenance host was selected explicitly through
`FIRMINGO_SERVICE_BUILD_PYTHON`. All nine payloads and 140,303 source members pass;
its delivery manifest SHA-256 is
`261dcdfd80b39c11d522289d8ac411b0882cdc36ec91f370b0f92f11f2957d39`.
Source accompanies the compiler, rather than an offer to provide it later.
GPL, full licenses, source-specific credits, modified-origin notice and build
instructions accompany both. The verifier rechecks role bytes after source
verification; a focused fixture mutates the binary during that phase and rejects
stale success. Other fixtures cover wrong anchors/reviews, corruption, missing
source/credits, unsafe/duplicate/unlisted roles, Boolean schemas and symlinks.
Six tiny paired-delivery fixtures pass; these are not actual compiler evidence.

## Deliberate consumer migration

Public service pins now select the reproduced module. ABI, memory cap, language-
neutral interface and Nano recipe stay unchanged; historical output/association/
journal records are not rewritten. The old memory-adjustment helper keeps its
own historical pin and does not produce the accepted current service.

The actual source-only export remains fifty records; its manifest is
`4cbdf856304063dbac59a27ea8703f74ffedbc534521b0d40d13013913d4dba5`.
SDK maintenance imports that export, adds its own bridge, and verifies the
paired delivery before copying four notice/review documents. No binary or source
archive is copied into SwiftPM resources. The SDK runtime manifest is
`9fbf7807c22468083fd38fcf7870bd3c71b1b6d002b849631aa7a5cb31572c47`;
its twelve-role resource inventory is
`a2621c2010df4094b43e789d3e5de83c1ae94ad13444cc771ce83b5e19bb3729`.
The native toolchain identity is
`3eda5778fdc515f974d683570a6d6d8e1891ec9a64d0285e473401ebae14dd86`.
The SDK verifies retained notice/provenance roles even for an explicit service.
Defaults report absent `compiler.wasm`; the production descriptor catalogue
remains empty. Reviewed source distribution does not supply a binary or descriptor.

## Actual runtime and wrapper checks

On the recorded macOS arm64 host, Node 22.12.0/Xcode 27.0/Swift 6.4:

- Portable compiler tests: 140 passes and one optional historical-service skip;
  syntax/source/recipe/vendor checks pass. Eight actual Node/WASI tests pass.
- Standard-worker Chrome 154.0.8037.93: nine passes, six actual compiler cases;
  frontend/link errors, cancellation/deadline/fresh-state checks and blocked
  external resources are observed through the normal promoted consumer path.
- Focused SDK resource/preparation/ELF-adapter checks: 22 test functions pass.
  Notice corruption, exact-service identity, missing binary, pending internal
  test review, integrity anchors, cancellation and compatibility remain checked.
- Full ordinary SDK suite: 152 test functions pass, with nine real-service tests
  explicitly unavailable/skipped. A separate explicit-service run passes all
  nine public SDK/private-origin WebKit tests, including both build APIs,
  known sketch artifacts, errors, busy/cancellation/deadline/fresh-state behavior.
- A new separate SwiftPM consumer builds from a fresh generated directory, using
  an SDK-local paired delivery copy and no compiler sibling lookup at execution.
  Actual WASM compilation reproduces synthetic Blink capsule SHA-256
  `018c94a4a49b71880d6f04aecbe08e809c8ecf49e4278261c45dad3ead205720`.
  Service-free preparation and independent declared-ELF conversion also pass.
  All consumer bindings are synthetic; these capsules must never be deployed.
- The existing default-resource controller harness passes with the actual SDK
  bundle: no fallback/device operation, stale readiness discard and explicit
  fresh retry. Link inputs use current SwiftPM products and exclude the app entry.
- iOS Simulator and generic device-target SDK builds pass with signing disabled.
  Native DocC generation passes. These are compilation/documentation checks,
  not physical iOS/iPadOS execution or signed sandbox qualification.

Initial WebKit execution had eight functional passes and one stale expected
fingerprint from the previous SDK assets. Updating that explicitly reviewed
asset identity, with unchanged behavior expectations, makes all nine pass.
An initial sandboxed Swift invocation could not write the native toolchain cache;
reruns with local build permission pass. Neither limitation was reported as a
successful compiler run or hidden behind retry/reset behavior.

Commands/logs use Compiler `.build/delivery-{portable-tests,check,real-node,chrome}.log`
and SDK `.build/reviewed-delivery-{focused,sdk-tests,webkit-final,fresh-consumer,ios-simulator,ios-device,docc}.log`.
Compiler/SDK CI remain aligned with their production entry points; the compiler
maintenance matrix now includes six paired-delivery fixtures. SDK CI still needs
its explicitly provisioned Xcode 27 runner. Local results are not a verified
remote run. Subsequent verified compiler CI is recorded separately below.

No hardware, upload, reset, flash, visual inspection or device-network action
occurred. Firmware is unchanged and its pre-existing `AGENTS.md` edit is retained;
ArduinoKit remains read-only. Remaining work is binary/release provisioning with
paired source availability, trusted default firmware catalogue, signed/minimum-OS
and physical wrapper qualification, and selected hardware deployment evidence.
