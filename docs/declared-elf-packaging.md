# Service-free declared ELF packaging

Firmingo-Compiler now supplies the ELF parser and capsule producer for both public
FirmingoKit conversion overloads. A separate declared request preserves legacy
caller-supplied recipe metadata without changing the pinned actual-build contract.
No compiler service, device, Swift dependency or source-to-code claim is involved.

## Portable interface

Exports are `validateDeclaredPackagingRequest`, `parseDeclaredPackagingRequest`,
`declaredPackagingIdentity`, and `packageDeclaredELF(elfBytes, request, {signal})`.
`PackagingController.package` adds isolated worker execution, one-active-operation
admission, deadlines, cancellation and termination before settlement. Its default
module worker shares the service-free entry point with preparation; embedded hosts
can provide a worker factory for exported classic `preparation-worker.js` bytes.

The [request schema](../schemas/declared-packaging-request.schema.json) requires
`interfaceVersion: 1`, `kind: "package_elf"`, `buildID`, original `source`, static
`target`, `provenance`, and `options.deadlineMilliseconds`. A complete synthetic
example and independent Python expectations are in
[declared-packaging-reference.json](../tests/fixtures/declared-packaging-reference.json),
marked **NEVER DEPLOY**.

Source, correlation and deadline bounds match the existing contract. Nano
board/profile, ABI, capsule capacity, target ID and resident address policy stay
strict. A target contains either a complete experimental firmware descriptor or
minimal static resident binding; no device identity is required. Recipe declarations
use the legacy 1–96-byte ASCII identifier grammar and lowercase SHA-256. A full
descriptor must match selected recipe identity; provenance must match both. The
compiler label is 1–256 UTF-8 bytes without NUL/isolated surrogates; the toolchain
digest is lowercase SHA-256. These declarations do not verify assets or a publisher.

ELF is a copied ordinary nonshared `Uint8Array`, 52 bytes–2 MiB. The same production
parser rejects conventional/full-firmware layouts, mutable storage, relocations,
unresolved/common symbols, invalid tables and entry points. Only the reviewed
aligned 4–3840-byte `.text` subset is accepted. Shared preparation regenerates exact
source/generated identities but establishes no association with supplied ELF.

Output retains the original FMS1 bytes, filename and canonical report vocabulary.
The [receipt](../schemas/declared-packaging-receipt.schema.json) has
`receiptSchema: "firmingo-compiler-declared-packaging-v1"`,
`operation: "independent_elf_packaging"`, and `provenanceStatus: "declared"`.
It includes captured request/revision/source/generated/target identities and
declared provenance. `buildInputSHA256` hashes compact sorted JSON of those inputs,
excluding itself and `linkedELFSHA256`, `capsuleSHA256`, `capsuleBytes`. Output hashes
identify checked bytes separately. No service/shim execution or device metadata is
inserted. Request/descriptor/provenance equality and byte limits are runtime rules
beyond the JSON schemas' field constraints.

Existing `packageELF` and packaging-v1 receipts are unchanged. Actual builds still
require the pinned Nano recipe and emit their distinct executed-assets receipt.
Declared requests cannot become executable build selections. The controller copies
inputs, terminates the worker before publication, and rechecks its bounded output
through production portable gates. Stale/altered/additive replies, cancellation,
deadlines and failed cleanup cannot yield an artifact. Direct calls have cooperative
cancellation; use the controller for a termination-backed deadline.

## Developer command

```sh
node tools/dev.mjs package-declared request.json independently-linked.elf new-output-directory
```

This uses the isolated Node adapter and writes `.fms`, `report.json`, `receipt.json`
only after success. Inputs are explicit bounded regular files; existing output
directories are refused. Failure/deadline leaves no output. No service is loaded,
fetched or distributed, and microcontroller output is not run.

## Swift integration and local evidence

Swift retains the two `ManagedELFConverter.convert` overloads, immutable data,
verified package loading/private WebKit hosting, correlation/input/provenance/output
checks and independent capsule/deployment validation. Legacy and offline schema-one
receipts retain their meaning and input digests. `compilerReceiptJSON` remains nil
for supplied ELF. The SDK catalogue keeps its existing pinned-descriptor policy.
Native ELF parsing and capsule production are removed; original identities/test
mappings are in SDK `docs/elf-packaging-retirement.json`. Conversion now requires
verified compiler sources and WebKit: missing/corrupt resources or unavailable
hosting fail explicitly, with no native fallback.

On macOS arm64 / Node 22.12.0 / Xcode 27.0 / Swift 6.4:

- `tools/dev.mjs check` passes; `test`: 108 pass, one optional memory skip. Seven
  focused declared-packaging cases pass, including actual isolated Node workers.
- JSON/ELF mutation pass 4000/5000 cases. Eight actual Node/WASM cases pass.
- Chrome 154.0.8037.93: nine checks pass with the explicit service; without it,
  three pass and six compiler cases skip. The first check now exercises actual
  declared-packaging workers, cancellation/deadline and fresh operations.
- SDK explicit-service validation passes 152 tests in 18 suites, including nine
  real WebKit/WASM cases. Existing offline Python goldens and the independent
  legacy input digest are unchanged; 21 native output mutations reject.
- A separate SwiftPM consumer prepares and packages the non-executable fixture
  using SDK resources and arbitrary legacy provenance with no service.
- Unsigned generic iOS Simulator/device builds and native macOS DocC pass, with
  no reported build/documentation warnings. These are build checks, not physical
  iOS/iPadOS or signed/minimum-OS execution.

Source-only export: 50 records, manifest SHA-256
`93f149a454b1fc1c60ea21775b7b860e99b1a4031f8c810fb1f5de3bc18c4fd4`.
SDK runtime manifest SHA-256:
`d6c7458d085e43d069bda0a16b1e2ed3931c51528118c3ecba862c08dc36cadc`.
Pending eight-role inventory SHA-256:
`0758bebfdb81c920bab244e31a2d9b4b49aa1d4d697796d1e366f8ee3d7c5ed7`.
Host page: 416780 bytes. Export recreation compares every output byte. No compiler
binary is included; service source/build/distribution review remains open.

Logs use ignored `.build/declared-packaging-*.log` in each checkout. CI uses the
production test/browser/consumer entries. New Compiler GitHub results must be
inspected separately; SDK CI still needs its provisioned Apple runner. No device
operation or firmware executable change occurred.
