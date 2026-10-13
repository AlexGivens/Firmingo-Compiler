# Portable preparation and ELF packaging — 2026-10-12

This increment implements M3's bounded portable stages and extends the M2/M5
foundation. It does not execute WASM, compile source, integrate Swift or qualify
hardware. The SDK implementation remains active during extraction.

## Implemented behavior

- Portable preprocessing preserves original source/revision and independent SDK
  normalization hashes; it maps generated lines, rejects unsupported directives/
  line splicing, and handles comments, literals/raw strings and numeric separators.
- Strict ELF validation preserves the selected Nano layout, table/symbol/mapping
  limits and unsupported mutable/relocation/runtime data rejection. Binary views are
  copied; shared buffers are rejected. UTF-8 names preserve BOMs rather than aliasing
  required wrapper symbols.
- Independent ELF packaging produces an exact FMS1 capsule, checks it again against
  the static descriptor, and returns canonical report plus distinct packaging receipt
  marked `provenanceStatus: declared`. Caller data is snapshotted before async work.
- The Nano manifest and four original assets were imported unchanged from the pinned
  SDK commit. Production integrity verification preserves the recipe hash; fixed
  compile/compile/link jobs are generated only after portable preparation.
- Developer commands prepare source or package explicit ELF into a new directory;
  overwrite and malformed input are rejected. The completion marker is written last.
- Normal CI includes the maintained Nano integrity/job/parser checks; JSON and ELF
  mutation jobs are separate. Actual recipe compilation is deliberately excluded
  until the WASM execution implementation exists; no mocked build pass is substituted.

Compatibility impact: public input/descriptor identities and recipe/source output
hashes remain unchanged. The new packaging receipt has its own schema and does not
replace SDK receipts. First-line BOM diagnostic columns now include its three UTF-8
bytes; this narrow correction is documented for the future adapter. No firmware
wire/ABI change, SDK code removal, service/shim/sysroot import or device operation.

## Independent evidence

Unchanged hand-authored ELF envelope and firmware upload frame are local test
fixtures, never executable/deployable. Their origins, pins and digest records are
in `tests/fixtures/pipeline-provenance.json`, retaining firmware GPLv3 attribution.
Python independently derives request/input/report/receipt identities and expected
JSON; tests compare whole capsule bytes to the original firmware frame, not a
second encoder built from production implementation.

Golden capsule: **264 bytes**, SHA-256
`ef8bff817d9b80026f6eaeac33d1c40fac2f41b046865de967d3c0cf2539d52a`.
The synthetic API address and resident/image/toolchain hashes are test inputs only.

## Commands actually run

| Command/check | Observed result |
| --- | --- |
| `node tools/dev.mjs test` | **66/66 pass**, zero skipped; about one second |
| `node tools/dev.mjs check` | JS syntax, eight fixture records and unchanged recipe/four asset integrity pass |
| `node tools/dev.mjs fuzz` | **4000 JSON cases pass**, seed `1179469647`, 772 accepted values checked independently |
| `node tools/dev.mjs fuzz-elf` | **5000 ELF cases pass**, seed `1162626609`, 486 accepted layouts; no machine code executes |
| `node tools/dev.mjs prepare-request tests/fixtures/synthetic-packaging-request.json <new-directory>` | Prepared source/metadata only; generated SHA-256 `9a298b76d01802f89c360908c473933a9ff814b794ec40a07f49fdabe0e386f4` |
| `node tools/dev.mjs package-elf tests/fixtures/synthetic-packaging-request.json <fixture.elf> tests/fixtures/declared-packaging-provenance.json <new-directory>` | Exact golden capsule, report and declared-provenance receipt; no compiler ran |
| Ruby YAML/CI assertions | Three jobs parse; explicit bash and separate bounded mutation jobs retained; actionlint unavailable |

The explicit CLI outputs are retained locally under ignored
`.build/portable-validation-x7pdii9i/`, with the independently decoded synthetic ELF
input. Tests additionally exercise new-directory/no-overwrite behavior and invalid
ELF rejection before creating an output directory. Local test log is
`.build/logs/pipeline-test.log`; these are diagnostic fixtures, not release images.

Regression coverage includes every truncation of the 712-byte ELF, minimum/maximum/
oversized/misaligned code, malformed headers/ranges/sections/symbols, wrong mapping,
unknown/writable flags, invalid UTF-8 names, corrupt capsule fields/padding/digests,
binary-offset/Buffer/shared-memory and native-byte accessor/iterator behavior, immutable async input/output snapshots,
source/revision/provenance identities, bounded diagnostics, cancellation and recipe
corruption. C++ type/API errors and unresponsive WASM termination are future real-
service tests, not simulated by this suite.

No GitHub CI run, browser/signed-sandbox, native firmware build, Swift adapter test,
hardware check, or publication occurred. Service distribution/build provenance and
trusted exact resident export remain unresolved production dependencies. Next is
M4's actual WASM worker and M2's full build lifecycle/verified compilation receipts.
