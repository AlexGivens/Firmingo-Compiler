# Rebuild the paired service

Verify the source archive against the independent delivery inventory, then extract
it into a new directory. Its root is `firmingo-compiler-source/`. Use its scripts
and raw sources; no sibling repository or upstream Git cache is required.

Provision native Clang/LLVM/LLD 22.1.8, CMake 4.4.0, Ninja 1.13.2, Python 3.12.14
and Node 22.12.0. These general-purpose tools and system libraries are prerequisites,
not redistributed native binaries. Their original input identities are recorded
in `build-identities/`. Actual asset production was verified on the recorded
Darwin host; synthetic Linux fixtures do not establish a Linux native rebuild.

1. Follow `docs/runtime-source-build.md` in the extracted source. Select explicit
   tool/module/component paths. Set `llvmSourceRoot` to `upstream/llvm` instead of
   `llvmGit`. Select `archives/libc.tar.gz` and `archives/wasiHeaders.tar.gz`.
   Capture the runtime inputs, review their manifest anchor, then build in a new
   directory using that anchor. This rebuilds the statically linked WASI runtime;
   it is included source, not an excluded host system library.
2. Follow the extracted `docs/service-build.md`. Select `serviceSourceRoot` as
   `service/source`, `llvmSourceRoot` as `upstream/llvm`, and the rebuilt runtime's
   sysroot/resources. Capture and review the new input anchor, then build in a
   new directory. The scripts apply the thirteen patches exactly once. Keep the
   `compiler.wasm` basename, whose identity affects the linked module.
3. Compare the result against the delivery service identity. The recorded rebuild
   reproduces all 2,353 runtime files, all 96 LLVM archives and the complete WASM
   service. Captures differ with provider/provenance context; do not bypass their
   gates or claim identical input manifests merely because output bytes match.

Invoke the explicitly provisioned Python directly with `-I -S -B` for both
capture and build, preserving its launch context. Each maintenance command has
`--help`. Configurations use explicit local paths; no script silently installs
tools or fetches sources. The committed libc bindings are retained, so the Rust
header generator was not run. Raw upstream sources, generation inputs, patches,
runtime adaptations, licenses and instructions remain in the archive.
