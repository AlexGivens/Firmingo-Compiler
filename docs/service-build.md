# Owned development service builds

This maintenance path builds the custom WASI compiler from captured sources in
new owned directories. It does not install tools, modify a reference checkout,
bundle a binary, change consumer pins, or approve distribution. The recipe is
`service/recipe.json`; CMake's portable explicit-path template is
`service/WASIClangToolchain.cmake`. Consumer compilation still needs only its web
host and verified assets, not Python or a native compiler.

Use Node 22.12.0 and the maintenance Python 3.12.14 selected in `.python-version`.
The optional `FIRMINGO_SERVICE_BUILD_PYTHON` variable selects an explicit
interpreter; no system installation is changed. The developer command launches
Python with `-I -S -B`, excluding user module paths/site packages and bytecode
writes. CMake uses an owned wrapper with those same isolation flags.

```sh
node tools/dev.mjs service-build --help
node tools/dev.mjs test-service-build
node tools/dev.mjs service-build capture path/to/local-config.json .build/service-inputs
# Review the manifest and select its independently recorded SHA-256 before building:
node tools/dev.mjs service-build build path/to/local-config.json \
  reviewed-input-manifest-sha256 .build/service-build-a --jobs 4
node tools/dev.mjs service-build build path/to/local-config.json \
  reviewed-input-manifest-sha256 .build/service-build-b --jobs 4
node tools/dev.mjs service-build compare .build/service-build-a .build/service-build-b
```

`configure` takes the same arguments as `build` and stops after a real clean
configuration. It explicitly reports `compiled: false`. Every operation selects
a new destination with an existing parent; existing directories are refused.
Build outputs can require several GiB and substantial native compilation time.
Choose 1–16 jobs explicitly (default 4). No command downloads or installs inputs.

## Explicit local input configuration

Schema 1 has exactly these fields. Paths below are placeholders for explicitly
provisioned tools/components, not developer-specific defaults:

```json
{
  "schema": 1,
  "referenceRoot": "/path/to/pinned-readonly-reference",
  "llvmGit": "/path/to/git-cache-with-pinned-llvm-commit",
  "sysroot": "/path/to/merged-wasi-sysroot",
  "resourceDirectory": "/path/to/clang-wasi-resources",
  "cmakeModules": "/path/to/selected-cmake/share/cmake",
  "pythonStandardLibrary": "/path/to/selected-python/lib/python3.12",
  "dependencyInspector": "/usr/bin/otool",
  "components": {
    "wasi-libc": "/path/to/real-wasi-libc-32-prefix",
    "wasi-runtimes": "/path/to/real-wasi-runtimes-22.1.8-prefix",
    "llvm": "/path/to/real-native-llvm-22.1.8-prefix",
    "lld": "/path/to/real-native-lld-22.1.8-prefix",
    "cmake": "/path/to/real-native-cmake-4.4.0-prefix",
    "maintenance-python": "/path/to/real-selected-python-prefix"
  },
  "tools": {
    "clang": "/path/to/llvm/bin/clang",
    "clangxx": "/path/to/llvm/bin/clang++",
    "ar": "/path/to/llvm/bin/llvm-ar",
    "ranlib": "/path/to/llvm/bin/llvm-ranlib",
    "llvmTablegen": "/path/to/llvm/bin/llvm-tblgen",
    "clangTablegen": "/path/to/llvm/bin/clang-tblgen",
    "linker": "/path/to/lld/bin/wasm-ld",
    "cmake": "/path/to/cmake/bin/cmake",
    "ninja": "/path/to/ninja/bin/ninja",
    "node": "/path/to/node"
  }
}
```

The source provider currently reads the pinned custom reference files from
ArduinoKit commit `0eb3cd1841147dfc7ea25bf076545e38b01601e4`, selected explicitly
through `referenceRoot`. It neither runs its scripts nor writes there. Those
sources/patches are captured into ignored owned build outputs; their migration
license selection remains unresolved. No ordinary test or consumer needs that
checkout. An independently provisioned checkout of that exact source is sufficient;
there is no implicit sibling lookup.

Native Clang/LLVM/LLD must be 22.1.8, CMake 4.4.0, Ninja 1.13.2 and Node 22.12.0.
Executable bytes, non-system Darwin loader dependencies, inspector identity,
Python identity, actual CMake modules and actual Python standard-library files
are inventoried. Installed component receipt/SBOM/formula/license records are
captured where present. Python `site-packages` is excluded because all maintained
invocations disable site loading. The selected CMake/Python roots are checked
against the actual tools. Native capture currently supports Darwin; Linux CI
exercises owned fixtures, not a real Linux cross-build or bootstrap capture.

## Integrity and source snapshots

`capture` writes a deterministic `input-manifest.json` and prints its actual file
SHA-256. It covers the recipe/toolchain/maintenance implementation, 23 custom
source/header/patch records, exact LLVM commit/blob/mode inventory, sysroot,
compiler resources, CMake modules, Python library, tool/dependency bytes and
component records. File reads are bounded, and tree count/byte limits reject
oversized inventories, special files, cycles and symlinks escaping the explicit
component roots. This identity records selected inputs; it is not publisher trust.

`build` recaptures the selected inputs and requires the independently reviewed
manifest anchor before creating output. LLVM source comes from raw Git objects at
`ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`, regardless of working-tree edits.
The known `llvm`, `clang`, `lld`, `cmake`, `third-party`, license and README inputs
are copied, each Git blob verified, and SHA-256 recorded in `source-objects.json`.
Safe committed links are recreated only within the anchored source set. Git
archive substitutions cannot rewrite these bytes. The 13 pinned patches apply
only to the owned snapshot; patched file hashes are retained. A Git discovery
ceiling prevents parent-repository patch skipping and build identity leakage.
Lazy Git object fetching is disabled, so a missing source object fails instead of
writing fetched data into the selected read-only cache.

The self-contained generated toolchain supplies paths in nested CMake probes.
Explicit `--no-default-config`, resource/sysroot/linker selection and a minimal
environment exclude global Clang configuration, inherited include/library paths,
SDK settings and compiler overrides. Fixed `SOURCE_DATE_EPOCH`, deterministic
archive settings and file-prefix mapping reduce path/time differences. These
controls are tested; repeat-build identity still requires actual comparison.

## Build receipts and validation

The recipe builds ARM/Clang frontend/ELF LLD dependencies, then links exactly the
five service implementation files. The native CLI `main.cpp` is inventoried but
not linked. Actual link archives and generated LLVM/Clang/LLD headers have byte
inventories in `link-inputs.json`; configure/build/link argv and logs are retained.
The reactor has a 16 MiB stack and an explicit 256 MiB maximum memory.

An owned snapshot of the Node inspector validates actual WASM syntax, exact export
names/kinds, WASI Preview 1 imports and ordinary bounded wasm32 memory. It never
instantiates the module; `declaredServiceABI: 2` is distinct from an execution
check. Native bootstrap/module-library files are rechecked before completion.
`operation.json` appears only after success. Failure logs and `failure.json`
remain in incomplete new directories; they never count as successful builds.

`compare` requires two successful builds with the same reviewed input identity,
rechecks actual module bytes against both receipts, and rejects differences.
It does not infer reproducibility from matching declared hashes alone.

An explicit additional local check uses the production WASI service, preparation,
recipe and ELF/capsule packaging in an isolated worker with a bounded deadline:

```sh
node tools/test-built-service.mjs path/to/built/compiler.wasm \
  independently-reviewed-module-sha256 path/to/real-resident-descriptor.json \
  .build/owned-service-checks
```

It exercises GPIO/delay and binary console, repeated bytes, frontend errors,
mutable-state rejection, unavailable runtime-helper rejection and a fresh build
after failures. Resulting Thumb code is never executed by the host. This
maintenance path intentionally does not bypass or change the consumer's fixed
service identity; it is not packaged-wrapper/browser/hardware qualification.

## Remaining scope

The installed merged sysroot is now attributed to wasi-libc 32 and LLVM 22.1.8
runtimes by per-file component origins and captured installed records. That does
not reproduce these upstream archives from source. Darwin system shared-cache
libraries are named with the OS identity, not assigned fictitious file hashes;
the host OS and bootstrap tool source reproduction remain outside this proof.
All operations preserve `distributionStatus: "unresolved"`. Custom source/patch
attribution/license selection, complete upstream runtime source/notice closure,
cross-host reproducibility and new consumer asset promotion are separate gates.
The [local source-build record](evidence/owned-service-build.md) now verifies two
independent clean source builds, all 96 archive outputs and the complete bounded
WASM service byte-for-byte, plus actual execution and independent firmware validation.

`service/component-sources.json` records pinned upstream source archive references
and explicitly distinguishes verified downloads from installed declarations. Eight
unchanged wasi-libc 32 license/copyright files are retained with an archive/file
receipt in `third_party/service-runtime-notices/wasi-libc32/`. File-specific
allocator notices and complete binary distribution review remain open.

The upstream [LLVM cross-compilation guide](https://llvm.org/docs/HowToCrossCompileLLVM.html)
and [WASI SDK sources](https://github.com/WebAssembly/wasi-sdk) inform the explicit
tool/sysroot boundaries. Their moving defaults do not upgrade this pinned recipe.

Normal Node tests cover static module rejection. The separate maintenance suite
uses only owned synthetic Git/source/tool/library fixtures, requires no real
compiler or sibling source, and does not establish LLVM compilation. CI keeps
that suite independently observable on macOS and Linux, with actual source builds
remaining explicitly local opt-in work pending approved asset provisioning.
CI uses Python 3.12.14 on Linux and explicitly pins 3.12.10 for macOS fixture tests:
the official [Actions package inventory](https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json)
has no Darwin 3.12.14 package. This does not change the recorded 3.12.14 local
asset-build inputs or claim real source-build qualification from fixture CI.
