# Packaged-source service rebuild and notice trace — 2026-10-14

This increment uses the final independently verified source archive, 234,305,479
bytes, SHA-256
`dcdbe2d1fc2135dc726f06aa7b4fa4be9d81ac61f5fba2969d464f21b86089ef`.
It was unpacked into a fresh developer directory. The packaged scripts select
its raw LLVM snapshot and GPL custom sources, together with the previously
completed packaged-runtime rebuild. No upstream Git cache or ArduinoKit source
provider participates in this service build.

Direct isolated Python 3.12.14 capture reproduces the reviewed input-manifest
SHA-256 `aa0c445d0baba090fb277133e9e700634cbbeb8974825da90f0e1e8cc302f522`.
The full service build completed through the packaged `tools/service_build.py`
with that independent anchor and eight jobs: all 2,602 steps, followed by the
service link, static module inspection and final native-input rechecks. Native
compilation took 46.68 minutes on the recorded host. Native Clang/LLVM/LLD 22.1.8,
CMake 4.4.0, Ninja 1.13.2 and Node 22.12.0 remain explicit prerequisites.
The original [source-package evidence](source-package.md) records the archive,
runtime and earlier configuration checks; configuration alone is not compilation.

The captured Python 3.12.14 executable was invoked directly and consistently for
these operations; `PINNED_PYTHON` below denotes that explicitly provisioned path:

```sh
"$PINNED_PYTHON" -I -S -B \
  .build/candidate-final-source-unpacked/firmingo-compiler-source/tools/service_build.py \
  capture .build/final-packaged-service-config.json .build/final-packaged-service-capture
"$PINNED_PYTHON" -I -S -B \
  .build/candidate-final-source-unpacked/firmingo-compiler-source/tools/service_build.py \
  build .build/final-packaged-service-config.json \
  aa0c445d0baba090fb277133e9e700634cbbeb8974825da90f0e1e8cc302f522 \
  .build/final-packaged-service-build --jobs 8
```

## Completed rebuild and actual execution

The successful 533-byte rebuild receipt SHA-256 is
`233a99853f659461d5dffcf21910cce9c3a7695290e597049afc1e3d370725ed`.
The resulting 101,194,565-byte `compiler.wasm` is byte-identical to the reviewed
candidate: SHA-256
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
It retains ABI 2, 26 WASI Preview 1 function imports, 11 exports and a 4,096-page
maximum memory. Public pins still identify the previous asset.

Independent post-build comparison matched both completed builds' 96-archive
link inventories and verified every reported on-disk archive byte identity. Archive member lists and the normalized
Ninja dependency graph match for all 2,310 objects; all 6,182 source/generated/
sysroot/resource dependency files are byte-identical too. The input-manifest
anchors differ because the packaged-source provider and capture provenance differ;
no same-input compare gate was bypassed. The broader generated-header inventory
has 183 metadata differences: 163 `.d` dependency files and 20 CMake install files.
Replacing only the old absolute build-root path with the new one explains every
difference. None changes compiled inputs, archives or the service.

The fresh module passed the actual Node/WASI maintenance entry point:

```sh
node tools/dev.mjs test-built-service .build/final-packaged-service-build/compiler.wasm \
  a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493 \
  .build/schema2-fresh-ci-import/descriptor.json .build/final-packaged-service-execution
```

Both GPIO/delay and binary-console sketches compile, link and package. Three
frontend/mutable-storage/missing-runtime-helper failures are rejected without
artifacts; repeat GPIO ELF/capsule bytes match and fresh builds succeed. The
selected schema-2 CI export belongs to Firmingo commit `e0a79d1`, with firmware
build identity `c44d25efe774eb47b163bc082906cf48b59b6e3dd1d0e19c7822925e6ba8275f`
and independently anchored export manifest
`9246a7da31b3b4237d1783feb195a7e7719d65c6f4165f440d05de5daea876e4`.
This is static verified build evidence, not an installed-device attestation.

| Sketch | Capsule bytes | Code bytes | Capsule SHA-256 |
| --- | ---: | ---: | --- |
| GPIO/delay | 316 | 60 | `958b861bbc18d4666ed03e6976b39b9fea4812409ad91a3501abbb9685a80d7d` |
| Binary console | 392 | 136 | `b372c00edf4b60c662f73055685ed8764e9f8798fe9efbbafad04302549174c0` |

The separately built native validator uses actual Firmingo image-validator sources
at `d42613f`; its saved binary identity was checked before execution. It accepts
both new capsules at `0x10022c9c` and rejects both at `0x10022ca0` with enum 6
(`wrong_api`). No microcontroller code was executed. The execution receipt SHA-256
is `10279f6a6d0e29b44b8672c11bbd3781f24295f4abda5aae0674dbdbcf9c7a3d`.
Compact receipts, artifact identities, dependency counts, metadata limits and
validator results are preserved in [the evidence record](packaged-service-rebuild.json).

## Conservative compiled-input notice review

The existing successful candidate build supplied the initial trace:

- Every byte/hash in its 96-archive link inventory was checked. `llvm-ar t`
  membership matched the Ninja archive-input graph for all 2,310 object members.
- Ninja's recorded compiler dependencies account for all 2,310 objects, with no
  missing object records. Their 6,182 distinct inputs comprise 5,126 LLVM source
  files, 206 generated LLVM headers, 828 sysroot headers and 22 resource headers.
- The actual packaged-runtime compiler dependency records account for 1,911
  compilation objects and 2,557 distinct inputs. These cover compiler-rt,
  wasi-libc, libc++ and libc++abi, including installed/generated headers.
- Dependency-only native preprocessing of the five service translation units
  identifies 1,289 distinct inputs. All 310 LLVM source/header inputs are already
  covered by the archive trace; its other inputs are 30 generated LLVM headers,
  920 sysroot headers, 20 resource headers and nine original service files.
  Link-only flags were removed for this preprocessing operation; no service
  output was rewritten or instantiated.

The combined trace has 8,945 distinct physical input paths. Some identical files
occur in separate runtime/service workspaces, so this is not a unique-content
count. It inventories possible compiled contributions before final section
elimination, rather than claiming every archive object or runtime routine survives
linking. Including those notices conservatively avoids relying on absence claims
from disabled build options or linker garbage collection.

Full-file marker review of source inputs found seven files with matches outside
selected leading notices. Four contain additional attribution/origin comments:
musl `crypt_md5.c`, `crypt_sha256.c`, `crypt_sha512.c` and libc++ `charconv.cpp`.
The others refer to a documentation command named copyright, ARM hardware-division
permission and Unicode data names; they are not extra license grants.
Review of generated/installed header inputs found additional libc++ Unicode table
notices and Sandia/NTESS Kokkos credits. Their source hashes map back to the raw
source package. The one-sided binary-search origin comment is also retained;
generated Clang comment-command names are not licensing terms.

[`third_party/service-notice-review/`](../../third_party/service-notice-review/README.md)
contains 30 complete license/grant texts and 232 unchanged comment excerpts.
Its 116,808-byte manifest SHA-256 is
`6ea68ac9c6c2f898516bf450009c3f81d0605837242a059c3ab543339f38e817`.
The file-notice text is 236,570 bytes, SHA-256
`3cd2691f53b2dc6e2707c67202d5c1fd3a5941d4ae611880bf32a7023ce8a52a`;
the license text is 279,797 bytes, SHA-256
`9ab50ae98ed397647627aaf95b5b4ab15bd0a6ffd1791f00b4b139ebf7dae817`.
Each selection records its source file identity, exact byte offset, line range and
excerpt identity. All selected source files match the final source archive;
reconstructing both documents from those sources produces their exact bytes.

This review bundle contains documentation only. Thirty license/grant sources
include 27 named upstream files, the project GPL text, the retained upstream LLVM
text adjacent to the custom sources, and the author's explicit grant. Source-only
licenses are retained too. Automated searches support review; they do not prove
that every possible obligation has been identified. The final rebuild dependency graph and bytes are now reconciled against this
trace. Final binary-notice and paired source/object delivery review remain open.

## Maintenance checks

`verify-service-notices` checks the independently committed manifest anchor and
all payload bytes. Its optional explicit unpacked-source root checks the selected
whole-file identities and reconstructs the texts; it does not verify every source
archive member. Full source-archive verification remains a separate command.
Normal checks/test and the review export now include the bundle. CI verifies and
exports it independently on macOS/Linux, with no compiler binary or sibling checkout.

Actual local checks passed: 140 portable tests with one optional-service skip,
JavaScript/source/recipe/vendor integrity checks, twelve service-maintenance
fixtures, eleven runtime fixtures and ten source-package fixtures. The new tests
reject changed inventory/text, unexpected files, symlinked review materials and
a wrong optional source manifest. Actual source-based document reconstruction
passed. Workflow YAML parsed; actionlint was unavailable. No subsequent CI result
is inferred from these local checks.

The consumer source-only export remains 50 records with manifest SHA-256
`93f149a454b1fc1c60ea21775b7b860e99b1a4031f8c810fb1f5de3bc18c4fd4`.
Public service pins and default catalogue are unchanged. Binary publication,
consumer promotion, physical-device installation and hardware qualification are
separate work. ArduinoKit stays read-only, FirmingoKit is unchanged, and the
pre-existing Firmingo `AGENTS.md` edit is preserved.

## Verified notice-maintenance CI

All eight jobs in [GitHub run 38565456657](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38565456657)
passed at commit `8b72ced528e620b0efe16e2ed15bf95a623446ec`. Downloaded logs
show 140 portable passes/one optional-service skip on both hosts, and twelve
service, eleven runtime and ten archive-fixture passes on each maintenance host.
Both explicit notice gates verify 232 excerpts and 30 license/grant sources.
Mutation jobs report 4,000 JSON and 5,000 ELF cases. The unavailable real-service
suite reports zero compilation passes/eight skips; memory checks report one
static pass/one skip. Browser checks report three service-free passes/six
compilation skips; candidate checks skip nine cases. Those skips are not
compiler execution evidence.

Both 58-file `source-license-review` artifacts were downloaded. Every file,
manifest and completion receipt matches the local repeat export byte for byte.
Their 11,033-byte manifest SHA-256 is
`244a8ef1c6cf01d5e98004b86827d7cc6eb2ba7d1ec715b344e41d796bb2df93`.
No service binary is included in these artifacts.
