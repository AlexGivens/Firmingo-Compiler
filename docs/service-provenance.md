# Compiler service provenance audit

`node tools/dev.mjs audit-service` observes explicit local development inputs. It
does not execute the service, rebuild it, copy reference source, or approve
redistribution. [service-reference.json](service-reference.json) pins 27 reference
source/configuration/patch files, the original receipt, LLVM revision and license.
The reference checkout remains read-only.

```sh
node tools/dev.mjs audit-service path/to/reference path/to/llvm-source \
  path/to/wasi-module-build-receipt.json path/to/original-service.wasm \
  .build/service-audit
```

Select a new output directory with an existing parent. The tool verifies exact
reference commit/file bytes, reconstructs all pinned LLVM patches in an owned
temporary source subset, and compares every changed tracked or visible untracked
source file. It rejects unexpected changes, unsafe paths, symlinks, inconsistent
receipts and wrong module bytes. Ignored/generated source files are outside this
patch-state proof. Static WASM validation checks imports, exports and memory;
the tool never instantiates the module. The exact receipt hash precedes decoding
its historical fractional timing observation; public integer-only JSON contracts
remain strict.

The 2026-10-13 local audit verified ArduinoKit commit
`0eb3cd1841147dfc7ea25bf076545e38b01601e4`, LLVM 22.1.8 commit
`ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`, all 13 patches and all 19 resulting
changed source files. The original 101,196,042-byte module hash is
`bce6632512852bf86baf7ca7b6eddd07209c0c4e29ae3b2288ec27e69028887d`;
its actual shape has 26 WASI imports, 11 exports, 384 initial memory pages and
no maximum. Consumer use still requires the separately checked development
[memory-bound derivative](sdk-retirement.md).

LLVM's pinned [license text](https://github.com/llvm/llvm-project/blob/ca7933e47d3a3451d81e72ac174dcb5aa28b59d1/LICENSE.TXT)
declares Apache-2.0 with LLVM exceptions. The upstream
[license policy](https://llvm.org/docs/DeveloperPolicy.html#license) explains
component notices and exceptions; this is not a license conclusion for the whole
custom service. The pinned reference tree has no top-level license file, so the
wrapper and patch attribution/license selection remains unresolved. This
repository's GPL license does not automatically resolve those components.

The original receipt omits service source/header digests, linked archive and
generated-header identities, the merged WASI sysroot's component versions,
sources and notices, and native compiler/TableGen/linker executable identities.
Its compiler/CMake/Ninja version strings are observations, not complete build
inputs. No clean full-source rebuild or repeat-build identity has been established.
Every audit therefore emits `distributionStatus: "unresolved"` and
`reproducedFromSource: false` with these gaps, including successful audits.

Next, construct an owned build with explicitly selected, hashed tool and sysroot
components, import source/patches with recorded attribution, and compare clean
repeat builds. Review source/notice obligations before providing a binary package.
Ordinary tests use owned synthetic Git/source/module fixtures, never sibling
repositories or the real service. Four regression cases cover deterministic
patch reconstruction, changed inputs, undeclared edits and unsafe references.
