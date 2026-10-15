# Experimental FMS2 compiler adoption

The explicit `nano-managed-v2` profile compiles through the existing pinned
Clang/LLD WASM service. ABI-one requests, recipe bytes, FMS1 artifacts and the
previous resident catalogue remain separate. No hardware has executed this FMS2
candidate. Firmware owns initialization, validation and upload semantics; the
compiler performs no device I/O.

## Reviewed inputs and versions

- Firmware commit: `97be7bbbe29ef1d18ec886ae6eea1a2d41905869`.
- Schema-three export anchor: `90911f7d3684dab4123d36b9a018805cc36ae58cb197c318fe720cb18d434a65`.
- Contract: `firmingo-nano-managed-abi2-v1-experimental`, version 1,
  SHA-256 `bd57a4db74bcdc5d592d3217957a7975124c6fe84481a5afbd38509c1e20c082`.
- Recipe: `nano-stateful-clang-22.1.8-v1-experimental`,
  SHA-256 `25def36c701dd5e527ba128215deb3f87c158e1c6eb6eb2fa7fd106b5f543868`.
- Imported descriptor: `dacbf259b96de0e050514764253403f3ef1ef51d0f9efaf1f43a10d8654c0e18`.
- Service remains `a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.

`import-resident` now recognizes schema three through a separate pinned review in
`recipes/nano_rp2040_connect_v2/firmware-export.json`. It verifies all 39 files,
actual ELF initialized flash against UF2, readonly FAPI/FUP2 section bytes, call
pointers and the BSS arena. Arduino-Pico's flash LOAD is RWE; readonly table
attributes are checked on its actual ELF section rather than guessed from LOAD
permissions. A changed export requires deliberate review. Images remain outside
Git and are never installed by import.

Build interface 1 and service ABI 2 are unchanged. Full descriptors and minimal
resident bindings for FMS2 use **schema 2**, adding `stateAddress`,
`stateCapacityBytes` and `compilerContractSHA256` to their closed ABI-one shapes.
They require profile `nano-managed-v2`, resident ABI 2 and target ID 2. State
capacity is a positive four-byte multiple up to 4096; base/extent must fit RP2040
RAM. No address is inferred from hello. The selected export supplies API
`0x10023074` and state `0x2000893c`/4096 bytes. Exact ELF/UF2 association is still
wrapper-owned evidence, not device attestation.

## Compile, validate and package

The independent ELF gate accepts fixed readonly `.text`, initialized `.data`
at the exact resident arena base and adjacent NOLOAD `.bss`. It checks every
LOAD's virtual address, flash load address, flags and exact file/memory spans.
Other allocated sections, relocations, unresolved entries, constructors, TLS,
heap/runtime helpers and overlapping ranges are unsupported. Code plus initial
data must fit 3840 bytes; data plus BSS must fit the selected arena.

The linker reference is adapted explicitly: LLD uses a four-byte maximum page
size to encode the separate flash/RAM segments; compiler-generated ARM EXIDX
metadata is discarded as in the ABI-one WASM recipe. Exception/unwind behavior
is unavailable. Firmware's native reference bytes stay preserved in fixtures.

FMS2 has a 128-byte header and zero padding to byte 256. Packaging hashes the
code+initial-data payload and header bytes 0–95 separately. Validation checks
both hashes, exact capsule span, state/API/board binding, alignment, flags and
Thumb entry bounds. Reports retain code/whole hashes and add state capacity,
data/BSS sizes, payload/header hashes and contract identity. Receipt versions
remain unchanged; profile and exact descriptor/binding identity discriminate the
new contract. Independent packaging cannot claim source-to-code execution.

The versioned source-only web export includes both recipe resource sets. The
existing consumer catalogue deliberately still selects ABI one; FMS2 requires an
explicit imported descriptor. The refreshed experimental consumer version `.2`
changes source assets, with the same reviewed service/delivery and resident.
It does not inherit historical signed-host or board qualification automatically.

## Reproduce and evidence

Use Node 22.12.0. These commands use explicit local inputs; ordinary tests require
neither those assets nor a sibling checkout:

```sh
node tools/dev.mjs import-resident EXPORT TRUSTED_MANIFEST_SHA256 NEW_METADATA
node tools/dev.mjs build REQUEST_JSON PINNED_SERVICE_WASM NEW_OUTPUT
node tools/dev.mjs test
node tools/dev.mjs test-runtime PINNED_SERVICE_WASM
node tools/dev.mjs fuzz-elf
```

On 2026-10-15 actual WASM compilation of the checked `Counter.ino` produced a
380-byte capsule, code/data/BSS 120/4/4, SHA-256
`e349a77d85958db1c4eba4f5c10f27e23dc9dd2ce03eb675c108d07bbfd93abb`.
Firmware's production `managed_stateful_check` accepted those exact bytes and
passed guarded initialization, generation replacement and host boot dispatch.
It did **not** execute ARM code. The checked fixture has original request,
report, receipt, ELF/capsule hex and independent-validation provenance.

Actual Node/WASM regressions passed: repeat identity, stateless/data-only/BSS-only
builds, constructor/oversized-state rejection, fresh builds after rejection,
receipt tampering and ABI-one compatibility. The bounded parser job now runs
5000 mutations per ELF profile, seeds `0x454c4631`/`0x464d5332`; local results were
486/463 accepted structural layouts. Missing-service CI records explicit skips.

FirmingoKit separately validates FMS2/report bytes and FMGO target-two upload
selection. Physical FMS2 installation, state reset/persistence behavior across
real replacement/reboot, console/GPIO behavior, interruptions and recovery remain
qualification work on an explicitly selected board. Existing ABI-one hardware
results cannot establish these outcomes.
