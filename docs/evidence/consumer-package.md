# Exact experimental consumer package — 2026-10-14

Actual package version `0.1.0-nano-managed-experimental.1` assembles and verifies
33 payloads. Two independent new outputs produce identical manifest bytes:
`d042dc7d3869949d8e311fff28c5d66327ba090ba2ec8ff149e3a12019d8ea8c`.
A separate verification also passes with that independent anchor. All payload
identities are bound in the manifest; the source verifier checks all 140,303 source
members. Reviewed service/source/notice and source-only web identities are unchanged.

The selected schema-2 Firmware CI export is `9246a7da…` at `e0a79d1…`.
Source contract, report, resident ELF/UF2 and actual API `0x10022c9c` are checked.
Derived build ID `c44d25ef…` and catalogue SHA-256
`e341bfc0385fea9b2b026dc624daa26cdeac33286f4bb07243b37c1c31837d0e`
remain experimental; installed upstream core/toolchain provenance is declared,
not fully reproduced or inventoried. No physical-device identity is created.

Actual compiler commands use Node 22.12.0 and the explicitly selected isolated
Python 3.12.14 host through `FIRMINGO_SERVICE_BUILD_PYTHON`:

```sh
node tools/dev.mjs consumer-package build .build/reviewed-service-delivery-r1 \
  .build/schema2-firmware-ci-artifacts/managed_sketch/ci/resident-export .build/nano-consumer-package-r1
node tools/dev.mjs consumer-package verify .build/nano-consumer-package-r1 \
  d042dc7d3869949d8e311fff28c5d66327ba090ba2ec8ff149e3a12019d8ea8c
# The same build command also ran with new output .build/nano-consumer-package-repeat-r1.
```

Four new portable boundary cases pass; the full ordinary suite passes 144 tests
with one optional historical-service skip. Syntax/source/vendor/recipe checks pass.
The first actual assembly attempt exposed metadata key/traversal order sensitivity;
canonical object comparison and globally sorted paths correct it. It failed before
output creation. Final actual build, repeat and verification pass.

SDK maintenance verifies every package byte against its own independent anchor,
imports metadata without a binary and records thirteen resource roles. Inventory
SHA-256 is `e3c6080b78d2014cf82ca54f4605647f5e3b3967a8acb23c0daff2812475acf2`;
runtime `9fbf7807…` and native toolchain `3eda5778…` stay unchanged. Three SDK
maintenance cases cover copying, bounds/overwrites, self-anchored replacements,
missing/extra/link/corrupt roles. Ordinary SDK validation passes 152 test functions
with nine absent-service skips; all nine actual private-WebKit cases pass in the
explicit-service run. Resource regression coverage includes all thirteen roles.
The source-only demo-default harness passes: no automatic descriptor selection,
device association, fallback or Run; source transitions and stale readiness remain
guarded. Generic iOS Simulator/device builds and native DocC pass, signing disabled.

From clean SDK implementation commit `fbd5993ac2dc1b762910a31fb4290fae92f0b81f`,
explicit preparation creates `.build/prepared-nano-sdk-r1` with 261 records and
manifest SHA-256 `5d47369942c75afe6ac5d7bfcbba22dea817f645929ab0a74535c7ff5bfc3566`.
The reviewed compiler is an app resource; complete source/notices accompany it
outside app resources. No Git/untracked developer data is copied. The fresh local
SwiftPM consumer depends only on that prepared copy, not either working checkout:

```sh
node Tools/ManagedWASM/prepare-sdk-package.mjs EXPLICIT_COMPILER_PACKAGE \
  d042dc7d3869949d8e311fff28c5d66327ba090ba2ec8ff149e3a12019d8ea8c .build/prepared-nano-sdk-r1
python3 Tools/ManagedWASM/make-bundled-consumer.py .build/prepared-nano-sdk-r1 .build/default-nano-consumer-r1
swift run --package-path .build/default-nano-consumer-r1 BundledConsumer "$PWD/.build/default-nano-results-r1"
```

The consumer uses `loadBundled()`, an exact build ID and `ManagedSketchCompiler()`
without a compiler URL/environment override. Actual WebKit produces:

| Sketch | Capsule bytes | Capsule SHA-256 |
| --- | ---: | --- |
| GPIO/delay | 316 | `958b861bbc18d4666ed03e6976b39b9fea4812409ad91a3501abbb9685a80d7d` |
| Binary console | 392 | `b372c00edf4b60c662f73055685ed8764e9f8798fe9efbbafad04302549174c0` |

A syntax error is rejected and a fresh GPIO revision reproduces the capsule.
These outputs match the separately recorded Node builds for this exact resident.
Receipts retain the package catalogue/build/source revisions. Document UUIDs and
corresponding request/receipt identities vary deliberately; capsule bytes do not.
Execution uses no maintenance/native compiler subprocess or device connection.

The independently built production firmware validator (`c1aa955a…`, sources pinned
at `d42613f`, unchanged relevant image-validator identities) accepts both default-
consumer capsules at `0x10022c9c`, and rejects each at `0x10022ca0` with `wrong_api`
(enum 6, exit 1). No Thumb payload executes. Local details are retained in
`.build/default-nano-validator.json`; SDK logs are `.build/consumer-package-*`,
`.build/prepared-nano-sdk-r1.log` and `.build/default-nano-consumer-r1.log`.

No binary is committed, fetched automatically or published. Firmware code/ABI/
protocol and its pre-existing `AGENTS.md` edit are untouched; only integration
documentation changes there. ArduinoKit is untouched. Signed/minimum-OS/physical
hosts, installed-image evidence and hardware behavior remain unqualified. These
are local results; remote CI is recorded only after inspecting the relevant run.
