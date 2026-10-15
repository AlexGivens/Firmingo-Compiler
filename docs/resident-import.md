# Experimental resident metadata import

Current explicit ABI-two profile and schema-three import: [FMS2 adoption](stateful-adoption.md). ABI-one contracts remain supported.

Firmingo owns derivation of firmware facts from its actual resident ELF, UF2,
build report and committed project inputs. Its non-flashing
`experiments/managed_sketch/export_resident.py` now exports schema 1:
`manifest.json` plus exactly four bounded roles, `resident.elf` (8 MiB maximum),
`resident.uf2` (4 MiB), `build-report.json` and `resident-facts.json` (256 KiB each).
The 16 KiB manifest inventories byte counts and SHA-256 and declares experimental
qualification. This is separate from the firmware's parser/documentation ZIP and
from a composite UF2 containing a sketch.

```sh
node tools/dev.mjs import-resident path/to/explicit-resident-export \
  independently-reviewed-manifest-sha256 .build/resident-metadata
```

Select the manifest anchor from a reviewed build/package context; taking a hash
from the same unchecked directory provides no publisher trust. The Compiler
requires that explicit anchor, closed role/field inventories, matching actual
bytes, supported Nano board/core/profile, consistent report/source declarations
and bounded schema values. It independently checks RP2040 UF2 block shape and
the actual 40-byte FAPI-v1 table, hash and eight Thumb pointers. Firmware owns
ELF derivation and the comparison of every initialized ELF flash byte with UF2;
the importer does not duplicate its ELF reader or authenticate that producer.
Producer/validator tool hashes remain declarations bound by the selected manifest.

The output is `descriptor.json`, a one-entry `catalogue.json`,
`import-receipt.json` and completion marker `operation.json`. The Compiler attaches
only its current pinned Nano recipe. No firmware images are copied, no device
association is invented, and no default catalogue is edited. Existing outputs
are refused. Wrappers separately establish installation and deployment evidence.

Facts schema 1 has descriptor fields (without recipe), `apiTable` (address,
ABI, size, hash, pointers, LOAD flags), `comparedFlashBytes`, `sourceSHA256`,
`ignoredHistoricalMetadata`, `hardwareQualification`, `provenanceLimit`,
`exportToolSHA256` and `exportValidatorSHA256`. Only historical `src/.DS_Store`
metadata may be excluded; it is neither read nor exported. The selected producer
checks reported project inputs against the exact Git commit, including all
tracked C/C++ library sources. Installed core/toolchain declarations are not a
full upstream source reproduction. Experimental descriptor qualification and
these limits remain explicit.

The local 2026-10-13 export binds historical firmware commit
`f17fdf0301256ba48270230cbf213126e70aa8d0`, resident ELF
`8539fb1b26f016c0bf8290f8404d40afb785099419de84f120f02ee7c401c06d`,
resident-only UF2
`658ce6e056e88d3f1d0dfdd4a936263676eaee16d4eb2271b3c400a8c2fb95bb`
and API address `0x10022ca0`. It compared 152,840 initialized ELF bytes with UF2.
The resident's LOAD flags are RWX (7), while the API object's section is readonly;
managed-module ELF rules remain unchanged. Imported descriptor identity is
`f08302540ea788cc70f334f62285b0c37617271b1887ba97f01734ecfed8ae57`.

Two supported sketches compiled through the actual bounded WASM service against
this descriptor: GPIO/delay (316-byte capsule) and binary console (392 bytes).
The actual firmware `image.cpp` validator independently accepted both with this
API binding, and a repeated GPIO build had identical ELF, capsule, report and
receipt bytes. [Exact requests, receipts and identities](evidence/resident-validation.json)
record those results. No image was installed or executed on a microcontroller.
The native GCC Blink proofs use division requiring an unsupported Clang runtime
helper; these new builds exercise the existing constrained subset, not general
Arduino compatibility.

The fresh firmware CI export at `4d53a28` also imports successfully using the
manifest anchor from its retained job log. Its derived API is `0x10022c9c`,
demonstrating address drift from the historical resident. Both supported sketches
compile against this descriptor and pass independent firmware validation; the
historical API binding correctly rejects the new GPIO capsule. See
[CI checks and exact additional identities](evidence/provenance-ci.md).

Five importer regression cases exercise anchors/inventories, malformed UF2/API,
source/provenance drift, schema/recipe injection, symlinks and CLI publication
failure. Synthetic fixtures are NEVER DEPLOY. Ordinary tests require no real
service, firmware export, board or sibling checkout. The default production
catalogue remains empty pending distribution and hardware qualification.

## Versioned source-contract import

The importer now also accepts export schema 2: four existing resident roles plus
`contract.json` and six exact source/license resources. It checks them against the
reviewed Nano contract-to-recipe mapping and emits a metadata-only contract receipt.
Legacy schema-1 import remains available with `contractVerified: false`. The new
[candidate inventory](candidate-inventory.md) requires schema 2. No descriptor
identity, firmware ABI, default catalogue or consumer pin changes.
