# Owned compiler-service source build checks

Local maintenance on 2026-10-13, recorded macOS arm64 host with explicitly
selected native tool bytes. No device connection, flash, installation or
microcontroller execution occurred. [Machine-readable identities and receipts](owned-service-build.json)
record the source/input/link/module/execution scope.

The owned recipe snapshots 113,508 pinned LLVM Git objects, preserving their
verified bytes rather than Git archive substitutions; applies 13 exact reviewed
patches; and builds Clang frontend/ARM/ELF LLD libraries entirely in new Compiler
output directories. The original ArduinoKit checkout remains unchanged and its
scripts are never executed. Its 23 source/header/patch inputs are explicit local
development inputs with migration licensing unresolved.

Input capture covers 9,697 sysroot files, 308 resources, 4,133 CMake modules,
960 isolated Python standard-library files, 19 non-system bootstrap files,
15 named Darwin system/shared-cache libraries and 27 installed component records.
Native tools are LLVM/Clang/LLD 22.1.8, CMake 4.4.0, Ninja 1.13.2 and Node 22.12.0;
maintenance Python is 3.12.14. OS/bootstrap source reproduction and building the
target runtime archives from source are outside this proof.

The complete source build used the captured producer implementation
`d21cd02e7ddc80416b4158cce15a75f018ad5003002743cbbb92c5c935c7da06`
and input-manifest identity
`0c68ee049a09fbf4db92eee10f1dd5babff925ffb6593389b0b1e9d8e6f65ee3`.
Later maintenance safeguards disable Git lazy object fetching and additionally
verify receipt/input-manifest consistency. Native recipe/compile/link flags are
unchanged. The latest producer also configured a new owned source snapshot
successfully using manifest
`cdc415564ba7eae49810530248467ec6711afd127404d0d4471926b91cb673b3`;
that separate result explicitly reports `compiled: false`.

Commands actually used, with the explicitly selected pinned Python interpreter
in `FIRMINGO_SERVICE_BUILD_PYTHON`:

```sh
node tools/dev.mjs service-build capture .build/service-build-config.json .build/service-input-capture-build8
node tools/dev.mjs service-build build .build/service-build-config.json \
  0c68ee049a09fbf4db92eee10f1dd5babff925ffb6593389b0b1e9d8e6f65ee3 \
  .build/service-owned-build-d --jobs 8
node tools/dev.mjs service-build build .build/service-build-config.json \
  0c68ee049a09fbf4db92eee10f1dd5babff925ffb6593389b0b1e9d8e6f65ee3 \
  .build/service-owned-build-e --jobs 4
node tools/dev.mjs test-built-service .build/service-owned-build-d/compiler.wasm \
  58a06c969b4848b7e22ce45f1a92fe887e76883131696205707046f8fda1462f \
  .build/ci-resident-import-review/descriptor.json .build/service-owned-execution-d
node tools/dev.mjs test-service-build
node tools/dev.mjs test
node tools/dev.mjs check
```

The first full source build completed all 2,602 compile/build steps and linked
96 actual archives. Generated headers were inventoried: 87 LLVM, 296 Clang and
one LLD. The resulting reactor is 101,194,613 bytes, SHA-256
`58a06c969b4848b7e22ce45f1a92fe887e76883131696205707046f8fda1462f`.
Static validation observes 26 WASI imports, 11 exports, 384 initial memory pages
and a hard 4,096-page/256 MiB maximum. This is a new development asset, not a
byte reproduction of the original historical service or a consumer pin change.

Actual production WASI/preparation/recipe/ELF/capsule logic runs in an isolated
maintenance worker with that explicit module anchor and the real CI resident
descriptor at `0x10022c9c`. GPIO/delay and binary console produce 316/392-byte
capsules, identical to the existing compiler's outputs for those inputs. GPIO
ELF/capsule bytes repeat exactly. Frontend error, mutable-storage and missing
`__aeabi_uidiv` cases reject without artifacts, followed by a successful fresh
build. The actual firmware `image.cpp` independently accepts both capsules with
the CI API and rejects the historical `0x10022ca0` binding as `wrong_api`.

Local ordinary tests: 120 passed, one optional-service case skipped (121 total).
The separate maintenance suite passes nine cases using owned synthetic
source/tool/module fixtures. Those cases cover unchanged references, parent-Git
patch behavior, source/library/manifest drift, unsafe paths/links, bounded special
files, exact environment exclusion, failure logs/no success marker and repeat
receipt/actual-byte consistency. Fake tools do not establish compilation.

Known warnings are retained: native driver reports `--no-default-config` unused
when configuration loading is already disabled by the environment, and three
historical CMake switches are reported unused. No compiler warnings were hidden.
All native compile/link/configuration logs and inventories remain in ignored
explicit outputs. YAML parsed locally; actionlint was unavailable.

The independently started second full build is still in progress. Do not infer
whole-service reproducibility from the first run or partial archive equality.
Distribution, source/license/notice closure, runtime source rebuilds, packaged
wrapper/browser promotion and hardware qualification remain open.
