# Owned WASI runtime source builds

This optional developer operation builds only `wasm32-wasip1`: compiler-rt
22.1.8 builtins, wasi-libc `wasi-sdk-32`, and LLVM 22.1.8 libc++/libc++abi
with ABI version 2. It installs into a new ignored output directory, never the
system, ArduinoKit, consumer resources, or a release. Consumer compilation still
needs no Python or native compiler. Distribution remains unresolved.

`service/runtime-recipe.json` fixes the LLVM commit, tarball SHA-256s, target,
`lime1` CPU profile and source selection. The source references and archive URLs
are in `service/component-sources.json`. Provision those exact archives explicitly;
the maintenance tool neither downloads them nor changes dependencies. It rejects
archive traversal, links, devices, duplicates, oversized entries and expansions
before extraction. LLVM source comes from verified raw Git blobs, without reading
the reference worktree or applying its compiler-service patches to these runtimes.

Run with the selected Python maintenance host, isolated from site packages:

```sh
FIRMINGO_SERVICE_BUILD_PYTHON=/absolute/python3.12 \
  node tools/dev.mjs runtime-build capture /absolute/runtime-config.json .build/runtime-inputs
FIRMINGO_SERVICE_BUILD_PYTHON=/absolute/python3.12 \
  node tools/dev.mjs runtime-build build /absolute/runtime-config.json \
  REVIEWED_INPUT_MANIFEST_SHA256 .build/runtime-source-first --jobs 4
FIRMINGO_SERVICE_BUILD_PYTHON=/absolute/python3.12 \
  node tools/dev.mjs runtime-build build /absolute/runtime-config.json \
  REVIEWED_INPUT_MANIFEST_SHA256 .build/runtime-source-second --jobs 4
node tools/dev.mjs runtime-build compare .build/runtime-source-first .build/runtime-source-second
node tools/dev.mjs test-runtime-build
```

Review the capture before supplying its hash to `build`. Every output must be new.
Use the same explicit Python host for capture, build and compare. A hash identifies
reviewed bytes; it does not authenticate a publisher or authorize redistribution.

The closed configuration has `schema: 1`, `llvmGit`, `archives` (exactly `libc`
and `wasiHeaders`), `nativeResourceDirectory`, `cmakeModules`,
`pythonStandardLibrary`, `components`, `dependencyInspector`, and `tools`.
All locators are absolute. `tools` selects exactly `clang`, `clangxx`, `ar`,
`ranlib`, `nm`, `linker` (22.1.8), `cmake` (4.4.0) and `ninja` (1.13.2).
`components` names explicit real bootstrap roots for permitted header/module
links. Select Clang's actual resource directory and the actual CMake/Python module
roots. No installed WASI libc or C++ libraries are required as build inputs.
Actual bootstrap capture is currently Darwin-only through the selected `otool`;
CI covers owned synthetic archive/receipt fixtures on macOS and Linux.

The clean environment excludes inherited compiler, include, library, SDK and
loader settings. Clang default configurations are disabled. The owned toolchain
sets target, sysroot, resource directory, linker, archive tools and mapped build
paths. Native Clang builtin headers, CMake modules and Python's standard library
are inventoried; header bytes are copied. Native tools, their non-system dynamic
library closure, named OS dependencies and the system `sed`/`diff` bytes are
recorded. Tool/module/header identities are rechecked before success. CMake and
Python still run from the selected bootstrap installation; this is not a build
of native Clang, CMake, Python, or macOS from source.

Build order is compiler-rt, libc, then libc++/libc++abi. Builtins are supplied
explicitly to libc. The owned libc adaptation adds explicit resource headers and
removes Preview 2/3 wasm-tools/WIT helper includes; `BINDINGS_TARGET=OFF` prevents
binding-tool downloads. The exact before/after identities and reason are recorded.
The libc++ IWYU generator receives one recorded adaptation to import its pinned
source-local package under isolated Python; user paths and site packages remain
excluded. Dependency test runners are explicitly disabled.
The C++ recipe retains the reference ABI, no exceptions, static libraries and
filesystem support. Its pthread declarations do not enable shared WASM memory
or the `-threads` target. Other WASI targets and conventional Arduino sysroots are
outside this recipe.

The separately pinned WASI archive is staged under libc's header-generator input
path. The Rust generator is **not run**: the build uses libc's committed generated
WASI headers. This reproduces the selected build sources, not a demonstration of
regenerating those bindings or reproducing every Homebrew formula target.

Successful outputs include source inventories, native input manifest, exact
commands, configuration/compile/install logs, complete sysroot/resource inventories
and `operation.json`. Failure retains phase logs and `failure.json`, without a
success receipt. `compare` rechecks input manifests, inventories and every actual
output file, including extra/missing files, before reporting identical builds.
Use [service-build.md](service-build.md) to capture these new runtime outputs as
explicit service inputs; a runtime receipt alone does not establish compiler
service, browser, wrapper or device compatibility.
