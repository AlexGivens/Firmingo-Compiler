# Local actual WASM execution — 2026-10-12

Host: macOS arm64, Node 22.12.0. This increment executes the real pinned bounded
Clang/LLD 22.1.8 ABI-two service through Firmingo-Compiler's portable worker core
and Node developer adapter. The service was an **explicit local development input**
from the SDK ignored build directory; no compiler binary was copied into this
repository or bundled. Redistribution/reproducible-build provenance remains open.

All build descriptors use synthetic resident hashes/API bindings, NEVER DEPLOY.
Source compilation, ELF/capsule validation, wrapper execution and physical-device
behavior are separate claims. No browser, WebKit, signed sandbox, Swift adapter,
board operation, release, GitHub execution or publication was performed.

## Checks actually run

| Entry point or check | Observed result |
| --- | --- |
| `node tools/dev.mjs check` | Syntax, eight fixture identities, four recipe assets and unmodified shim/license receipt pass |
| `node tools/dev.mjs test` | 83/83 fast production/contract/pipeline/WASI/lifecycle/CLI tests pass |
| `node tools/dev.mjs test-runtime ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm` | 7/7 real-service tests pass; about eight seconds locally |
| `node tools/dev.mjs test-runtime` | 7 explicit skips, 0 compilation passes |
| `node tools/dev.mjs fuzz` | 4000 cases, seed 1179469647; 772 accepted JSON inputs |
| `node tools/dev.mjs fuzz-elf` | 5000 cases, seed 1162626609; 486 accepted ELF layouts |
| Two explicit `build` commands below | Actual Clang source/entry compile, LLD link, independent packaging and receipts succeed |
| SDK reference worker comparison | Both generated ELF files byte-identical to the pinned SDK path |
| Firmingo production `validate_image` | Both capsules accepted; wrong API binding and corrupted code rejected |
| SDK `python3 Tools/verify-fixtures.py` | 34 retained SDK fixture records pass; no executable SDK changes |
| Ruby YAML workflow assertions | Four jobs parse, explicit Bash/pipefail and matrix fail-fast false retained |
| Missing-service failing Bash pipeline through `tee` | Nonzero exit status preserved; no output directory |
| `git diff --check` | Compiler/SDK edits pass |

Actionlint and a generic Python JSON Schema validator were unavailable. Schema JSON
parses; production event/receipt gates and codecs are exercised directly. No GitHub
CI result is claimed. The new independent real-runtime availability job deliberately
records seven skips/zero compilation passes until an approved provisioning mechanism
exists. Fast tests and JSON/ELF mutation remain independently observable.

The suite compiles two distinct supported sketches, repeats the exact first request
with identical ELF/capsule/receipt, checks source/revision/input/output/service/resource
identities, serializes and decodes actual terminal events, and rejects tampered
capsules/receipts and source mismatches. It covers actual frontend errors even when
service status is zero, BOM byte columns, unsupported facade calls, mutable globals,
runtime constructors and unresolved division helpers. It cancels synchronous WASM
at compile progress, rejects overlap/stale cancellation, terminates a one-millisecond
startup deadline and compiles successfully afterward. Corrupt service and recipe
bytes fail before compilation. The actual CLI tests success, new-directory/no-overwrite,
compiler failure with no output, and SIGINT during compile with no completed artifact.
The startup timeout test does not claim a long-running optimizer workload was measured.

Host mocks cover failure/disposal/correlation only and fabricate no successful
compilation. Workspace tests exercise actual descriptor allocation/write/truncate,
readonly child capabilities, path/entry budgets, isolated storage and output bounds.
A nested insertion budget regression and a returned-capsule ownership regression
were found and fixed during validation; output byte getters now return copies.

Logs are retained locally under ignored `.build/runtime-{check,tests,real,absent}.log`
and `.build/runtime-{json,elf}-fuzz.log`. These are local validation files, not release
assets. Historical failed exploratory logs were replaced by the final reruns.

## Independent output checks

The two explicit requests and build results are retained under ignored
`.build/runtime-evidence/`. Commands actually executed:

```sh
node tools/dev.mjs build .build/runtime-evidence/A.json ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm .build/runtime-evidence/A
node tools/dev.mjs build .build/runtime-evidence/B.json ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm .build/runtime-evidence/B
node .build/runtime-evidence/compare-sdk.mjs ../FirmingoKit/.build/managed-wasm/compiler-bounded.wasm
/usr/bin/clang++ -std=c++17 -Wall -Wextra -Werror .build/runtime-evidence/validator.cpp ../Firmingo/experiments/managed_sketch/image.cpp -I../Firmingo/experiments/managed_sketch -o .build/runtime-evidence/validator
.build/runtime-evidence/validator .build/runtime-evidence/A/A.fms
.build/runtime-evidence/validator .build/runtime-evidence/B/B.fms
```

A uses `pinMode`, `digitalWrite` and `delay`; B uses serial text/byte APIs. Their
full exact test sources appear in `tests/real-runtime.test.mjs`; evidence uses
filenames A.ino/B.ino and the static synthetic packaging descriptor. The comparison
harness supplies that same prepared source/API/recipe to the retained SDK production
Node worker; no files in the SDK are changed. The native check compiles the actual
pinned Firmingo `image.cpp`, then calls `validate_image` on both real WASM-produced
capsules and two negative variants. Native Clang is used **only for this independent
firmware-validator audit**, not for consumer compilation or normal tests. The two
ignored harnesses are local audit helpers; this cross-check is not a required sibling
checkout dependency of the package.

| Source | ELF bytes / SHA-256 | Capsule bytes / SHA-256 |
| --- | --- | --- |
| A | 860 / `e4a4055b297a59c536f3af5f44dec127c495dbb394fb333df0fab8b86527d729` | 316 / `a23bc8cc24d960dc60283e3d5dc9bd80d61a7d8c6cbe0f08f5248bc14848231a` |
| B | 1116 / `8e7c677f7451de4f1762c07be3301b2934428cbbda3b9b25655893703d4b46ef` | 392 / `ba26c3a28700b8ae177eb05c81434e35c16d8f6306bf5e9822f8c85adf6ea063` |

[Output identity records](wasm-output-identities.json) include original/generated
source hashes, request IDs, timings and memory observations. A/B final WASM memory
was 27983872/28049408 bytes, beneath the hard 268435456-byte memory maximum. This
does not measure total process memory or exhaustive peaks. Both passes establish
only format/identity conformance, not that a synthetic binding is safe to install
or that application code returns and behaves usefully on a board.

Next: real web-host execution and package/Swift adapter integration. Preserve the
SDK path until those gates pass; approved service assets and exact real firmware
exports remain separate production prerequisites.
