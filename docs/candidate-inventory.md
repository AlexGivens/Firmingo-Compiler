# Candidate package inventory

This maintenance step inventories a locally source-built compiler and a reviewed
firmware source contract. It emits **metadata only**. No WASM binary, firmware
image, raw source capture or package payload is copied, shipped or approved.
The existing source-only export and public service pins remain unchanged.

```sh
node tools/dev.mjs inventory-candidate path/to/owned/build TRUSTED_BUILD_RECEIPT_SHA256 \
  path/to/schema2/resident-export TRUSTED_EXPORT_MANIFEST_SHA256 .build/new-inventory
```

Select exact independently reviewed anchors, not hashes supplied by unchecked
inputs. The tool first checks bounded `operation.json` bytes against the build
receipt anchor. It requires the supported successful owned development-build
recipe/receipt and unresolved distribution status, checks the entire
`input-manifest.json` identity, then verifies `compiler.wasm` size/digest and
static bounded-memory/import/export shape. Static module validation compiles
WebAssembly metadata but never creates an instance or calls the service; ABI two
is a declaration, not an observed ABI function result. A declared receipt does
not authenticate a publisher or independently prove a source build.

The firmware importer accepts only a separately anchored schema-2 export with a
matching reviewed Nano resource mapping. All eleven export roles are verified;
missing or modified source resources fail before candidate output creation.
The importer still accepts legacy schema-1 metadata, marking `contractVerified`
false, but such exports cannot support this candidate inventory.

The tool temporarily recreates the actual compiler source-only package and
records its manifest identity, fifty source records and file inventory. It deletes
the temporary source export and includes no source package payload in the result.
`candidateMatchesPublicPin` is an identity comparison with the existing public
service pin; it is not distribution approval or default bundled availability.
For the currently tested source-built candidate it is false.

New output consists only of `candidate-inventory.json` and `operation.json`.
The schema-one inventory contains:

- Candidate service size/hash, declared ABI, imports/exports and memory bounds.
- Anchored build receipt/input-manifest identities, archive count and explicit
  provenance limits; developer filesystem paths are not copied from raw inputs.
- Current source package manifest/file identities and accepted service identity.
- Selected firmware descriptor/build identity, export anchor, verified contract
  resources/mapping and referenced resident ELF/UF2 roles without payloads.
- Component source references, verified runtime/shim notice inventories and the
  repository license identity, preserving unresolved custom-service licensing.
- Explicit remaining promotion requirements, with unchanged pins/catalogue,
  no service instantiation and no hardware execution.

Receipt JSON is at most 16 KiB, source inputs and service at most 128 MiB each,
contract JSON 16 KiB, individual contract sources 64 KiB and final inventory
128 KiB. Inputs reject symlinks/special files through existing bounded readers.
Existing output is refused. Validation failures create no output; filesystem
write failure may leave an incomplete directory but never reports success.
No network access or sibling discovery occurs; actual firmware exports are
explicit inputs. Ordinary tests use a small static, never-instantiated WASM
fixture and fake resident metadata, never a real service or sibling checkout.

## Firmware contract-to-recipe review

`recipes/nano_rp2040_connect/firmware-contract.json` pins six exact Firmingo
source/license identities reviewed at `d42613f`, plus the compiler's existing
recipe identity and adaptation notes. Firmware export schema 2 contains a
schema-one `firmingo-nano-managed-abi1-v1-experimental` contract. The compiler
requires those exact resource identities, known image limits, correct resident
header build hashes and the selected firmware commit. A future resident commit
may reuse identical contract bytes; changed resources require a new explicit
compatibility review rather than automatic acceptance based on ABI number.

The proof facade/entry/linker are reference data, not the production Clang recipe.
The native linker region and GCC helper linkage do not expand the 3,840-byte code
limit or grant runtime-helper support. The recipe and independent ELF/FMS1 checks
retain their existing restrictions. Descriptor/build IDs and wire/ABI formats
retain their meanings; no installed-image evidence is created by import.

[Actual evidence](evidence/candidate-contract-inventory.md) records the real CI
resident export, unchanged descriptor, actual source-built module checks and
independent firmware validation. Full upstream firmware provenance, source/notice
closure, approved package construction, public SDK/private-scheme consumers and
hardware qualification remain separate gates.
