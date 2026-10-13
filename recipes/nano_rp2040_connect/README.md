# Experimental stateless Nano recipe

The manifest and four declared assets were imported unchanged from FirmingoKit
commit `05cae8fa8e58c706eceb6a15812d7ca500375d7b`, `Tools/ManagedWASM/Recipe/` and
`Tools/ManagedWASM/Sources/ManagedRecipe.js`. The manifest SHA-256 remains
`b7869f6fc863e1905deb6974408c6e7dc63943a1fb3e342a357fdf757b1e23d9`; source/asset
pins and original provenance are in `docs/baseline.json` at the repository root.

These are the independently authored FirmingoKit facade/entry/linker/job generator,
not copies of ArduinoKit's custom service or conventional sysroot. This repository's
GPLv3 license applies to the maintained adaptation; upstream/reference provenance
remains identifiable. No third-party WASI shim, service binary, or native firmware
image is included by this recipe import.

The original generator comment names the Swift preprocessor. To preserve recipe
byte identity, that historical comment is retained: the new portable `prepareSketch`
and `createNanoJobs` now enforce the same prepared prefix and constrained lexical
policy before invoking it. SDK implementation remains active during migration.

Nano/application, Cortex-M0+, Thumb, ARMv6-M base/soft float, GNU C++17 freestanding,
ABI one and code at `0x10200100` remain explicit. The linker caps code at 3840 bytes
and rejects mutable storage/constructors; all three fixed jobs are source/wrapper
compile then link. No source discovery, arbitrary flags/libraries or conventional
Arduino support is added. `verifyNanoRecipe` validates the manifest/assets;
`createNanoJobs` constructs fixed response-file bytes, without executing a compiler.
