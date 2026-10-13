# Input-contract foundation — 2026-10-12

This increment completes M1 inventory/contract selection and implements the input
portion of M2. It does not implement preprocessing, WASM compilation, ELF/capsule
output, runtime events, receipts, or a Swift adapter. No board/runtime is qualified.

## Changes and provenance

- Selected the existing experimental Nano resident ABI/image and Clang recipe
  without changing their source constraints; recorded 24 firmware/SDK source and
  resource hashes plus five read-only ArduinoKit source/build references in
  `docs/baseline.json`.
- Reverified original and memory-bounded development WASM file sizes/SHA-256 in
  FirmingoKit's ignored build directory. No binaries copied, executed, or bundled;
  service source/build/component distribution review remains unresolved.
- Implemented independently authored portable closed-field validators, bounded
  duplicate-aware JSON, immutable build data, request identity and SDK-compatible
  descriptor identity. Decimal integer parsing rejects fractional/exponent values
  before floating-point rounding could mask a version/address mismatch.
- Imported one unchanged synthetic SDK descriptor and independently authored a
  synthetic build request; golden identities were generated using Python hashlib
  and compact sorted JSON. Fixtures never identify a real resident or authorize use.
- Added draft interface/input schemas, developer inspection/validation/check tools,
  dependency-free regression tests and separately bounded JSON mutation.
- Added pinned macOS/Ubuntu CI definitions with failing-status preservation and
  retained logs. Firmware/SDK executable source, assets and stored receipts stay
  unchanged; SDK migration notes now link this foundation.

Development baseline: local macOS, Node **22.12.0**, npm **10.9.0** observed.
Production modules require no Node, Swift or external dependency. No package install,
native compiler, browser, device, network service or sibling checkout is needed for
the normal checks below.

## Commands actually run and results

| Command/check | Observed result |
| --- | --- |
| `node --version`, `npm --version` | 22.12.0 and 10.9.0 |
| `node tools/dev.mjs --help` | Lists foundation capabilities and unavailable compilation explicitly |
| `node tools/dev.mjs doctor` | Pin matches; no bundled/implemented service/runtime or hardware qualification |
| `node tools/dev.mjs check` | JavaScript syntax and two local fixture sizes/digests pass |
| `node tools/dev.mjs test` | **39/39 pass**, zero skipped; final run about 0.6 seconds |
| `node tools/dev.mjs fuzz` | **4000 cases pass**, seed `1179469647`, 772 accepted JSON cases checked against native decoding |
| `node tools/dev.mjs validate-request tests/fixtures/synthetic-build-request.json` | Input-only success; SHA-256 `49a2ac17565816848577c312e044e190a957a779e0407f07a10880e07b6af3cb` |
| Bash/pipefail with `validate-request /dev/null` piped through `tee` | Intentional invalid-file failure returns **exit 1**; logging does not mask it |
| Ruby YAML parsing and workflow trigger/job/shell/matrix assertions | Pass; actionlint unavailable |
| Reference size/hash, JSON and local-link audits | Selected inputs and fixture provenance agree; no ordinary check needs siblings |

Regression cases exercise malformed/missing/unknown fields, duplicate escaped keys,
unsafe/fractional numeric forms, target/ABI/recipe mismatches, API-address bounds,
UTF-8 source limits, NUL/surrogate/path rejection, exact source preservation,
immutable snapshots, canonical identities, JSON truncation/depth/token/byte limits,
prototype/accessor rejection, explicit missing-crypto errors, and CLI input/exit
behavior. Input cancellation is validated structurally; worker cancellation is not
implemented or tested here.

Local test output is retained under ignored `.build/logs/foundation-test.log`;
intentional pipeline failure is in `.build/logs/intentional-failure.log`. These
are local diagnostics, not published release artifacts. CI uses the same entry
points with logs collected independently for tests and mutation.

## Remaining limits

Output/event/receipt schemas remain draft; M2 is in progress. Preprocessing,
compile/link, ELF/capsule validation/packaging and worker lifecycle must be
implemented and exercised using the real service before source-to-artifact claims.
No browser/sandbox, Swift wrapper, firmware build, hardware operation, GitHub CI
run or publication occurred. No actionlint pass is claimed. Real firmware metadata
exports and service distribution/build provenance remain separate prerequisites
for production asset packaging.
