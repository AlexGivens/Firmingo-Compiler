# Candidate inventory and source-contract evidence — 2026-10-13

The new metadata-only candidate inventory binds the explicitly reviewed owned
service build to the firmware's versioned source resources. Export schema 2 and
compiler schema-1 inventory are developer contract versions; resident ABI one,
FMS1, public compiler pins and SDK resource package remain unchanged.

Firmingo's current exporter reads the previously verified exact CI resident at
`4d53a28` and all contract source bytes from that commit. Its eleven-role schema-2
manifest SHA-256 is
`4992c149d1b0a31c7ad6e5e3f2e43adbb19bb429bfb95e60155a04f5e17de84a`.
A second real export repeats all twelve files byte-identically. The compiler checks all six source/license resource identities against its reviewed
Nano mapping at `recipes/nano_rp2040_connect/firmware-contract.json`. Changes to
contract metadata/source, unsupported layouts, omitted resident header identities,
unsafe role paths and invented qualification fail even with recomputed test anchors.
Legacy schema-1 import remains available with no source-contract proof.

Actual commands from the compiler checkout:

```sh
node tools/dev.mjs import-resident ../Firmingo/build/managed_sketch/contract-schema2-review \
  4992c149d1b0a31c7ad6e5e3f2e43adbb19bb429bfb95e60155a04f5e17de84a \
  .build/resident-contract-schema2-import
node tools/dev.mjs inventory-candidate .build/service-runtime-source-b \
  0ff22e889acc750db74be7ce49e80744513f558df9f42b186975699a34e88350 \
  ../Firmingo/build/managed_sketch/contract-schema2-review \
  4992c149d1b0a31c7ad6e5e3f2e43adbb19bb429bfb95e60155a04f5e17de84a \
  .build/candidate-inventory-final
node tools/dev.mjs test-built-service .build/service-runtime-source-b/compiler.wasm \
  a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493 \
  .build/resident-contract-schema2-import/descriptor.json .build/contract-bound-node-builds
```

The build receipt anchor binds 533 observed bytes and input manifest SHA-256
`0172deea2581a2fa5385630e3c0699f40924929fd45b1376caec52327474d2fd`.
The complete 20,807,459-byte input manifest and 101,194,565-byte candidate module
match that receipt. Static module validation observes 26 WASI function imports,
11 exports, memory minimum 384/maximum 4,096 pages and declared ABI two; it creates
no instance. Candidate inventory SHA-256 is
`b8006752e969315e60b8f08ee9d3d8272f7c8e658fb6def69c9af887afd9611d`.
Output is only `candidate-inventory.json` and `operation.json`. It copies no binary,
image, source archive, raw developer input paths or source-package payload.

The recreated current source-only package remains fifty records, manifest hash
`93f149a454b1fc1c60ea21775b7b860e99b1a4031f8c810fb1f5de3bc18c4fd4`.
Its public service identity differs from the candidate; `candidateMatchesPublicPin`
is false. The inventory preserves unresolved distribution, component provenance
limits, upstream/runtime/shim notices and custom-source licensing rather than
converting successful hashes/builds into distribution approval.

The schema-2 descriptor is byte-for-byte equivalent as parsed metadata to the
prior schema-1 descriptor: build ID
`760c563a3288d9e07fbe7c501c173516736913324db760e4152640ea45dc7e8d`,
API `0x10022c9c`. Actual WASM builds of GPIO/delay and binary console against this
metadata reproduce prior 316/392-byte capsules exactly. Three unsupported builds
reject, with repeat/fresh checks passing. The native validator compiled from actual
Firmingo `image.cpp/image.h` at `d42613f` accepts both selected bindings and rejects
both at historical `0x10022ca0` (`wrong_api`, enum 6). No Thumb payload executes.

Local checks: ordinary compiler suite 132 passes/one optional-service skip, nine
focused import/inventory cases, syntax/resource checks, twenty firmware sanitizer
native cases, 195 final firmware host cases, and twelve focused exporter cases.
Normal tests use fake resident metadata and a small static module never instantiated;
these fixtures are not execution evidence. Exact source-contract fixture data is
pinned to Firmingo `d42613f`, with GPL license retained and no sibling dependency.
Workflow definitions are aligned with new tests and nested contract artifacts;
YAML parses, actionlint unavailable. SDK changes are documentation-only because
no runtime or package identity changed; no Apple-platform build rerun is claimed.

[The JSON record](candidate-contract-inventory.json) contains actual contract,
receipt, module, inventory, artifact and independent-validator identities/outcomes.
The original installed-input service receipt does not itself establish runtime
source reproduction; [separate source-runtime evidence](runtime-source-build.md)
records that association. Source licensing/notice closure, full upstream firmware
provenance, approved binary/package promotion, public SDK/private resource scheme,
signed/physical hosts and hardware qualification remain separate work. No new
local firmware build, device operation or service distribution occurred.
