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
The service build was launched through the packaged `tools/service_build.py`
with that independent anchor and eight jobs. Native Clang/LLVM/LLD 22.1.8,
CMake 4.4.0, Ninja 1.13.2 and Node 22.12.0 remain explicit prerequisites.
The original [source-package evidence](source-package.md) records the archive,
runtime and earlier configuration checks; configuration alone is not compilation.

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
that every possible obligation has been identified. Final rebuild input
reconciliation and paired source/object delivery review remain open.

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
