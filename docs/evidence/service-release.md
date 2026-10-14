# Local service transport and transferred consumer — 2026-10-14

Two builds from the reviewed paired delivery produce identical transport archive
and release-inventory bytes. The version is `llvm-22.1.8-wasip1-abi2-r1`.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmingo-compiler-service.zip` | 336,179,045 | `fcb9dee7c117cab83d0f1597cf3a4a8dea3172d6abde72d3a83c6a3847a8d26f` |
| `release.json` | 699 | `c7fca729708f4213ca586b35d4d7fdaef568e35a61209bce8b95976a3cd6b39b` |

The ZIP contains all nine reviewed service/source/documentation payloads and
their manifest. The paired manifest remains `261dcdfd80b39c11d522289d8ac411b0882cdc36ec91f370b0f92f11f2957d39`;
service `a7648688…`, source archive `dcdbe2d1…` and scoped review `2627a80e…`
are unchanged. The actual source pass verifies all 140,303 archive members.
No compiler, source archive or transport binary is committed or published.

Actual compiler commands on the recorded macOS arm64 host with Node 22.12.0 and
explicit isolated Python 3.12.14 through `FIRMINGO_SERVICE_BUILD_PYTHON`:

```sh
node tools/dev.mjs service-release build .build/reviewed-service-delivery-r1 \
  261dcdfd80b39c11d522289d8ac411b0882cdc36ec91f370b0f92f11f2957d39 \
  .build/reviewed-service-transport-r1
node tools/dev.mjs service-release build .build/reviewed-service-delivery-r1 \
  261dcdfd80b39c11d522289d8ac411b0882cdc36ec91f370b0f92f11f2957d39 \
  .build/reviewed-service-transport-repeat-r1
```

Both builds verify the paired input and extracted transport before completion.
Separate `cmp` commands confirm identical ZIP and inventory bytes. The transport
was copied to SDK-local `.build/transferred-service-transport-r1`; `service-release
extract` with the independent inventory anchor above succeeds into SDK-local
`.build/extracted-service-delivery-r1`. Final extraction uses the tightened parser
with exact local-header checks. It rechecks transport identities after the complete
source pass and writes completion last.

Nine tiny, non-executable transport fixture tests pass. They cover deterministic
identity despite local modes/receipts/paths, no overwrite, wrong independent anchors,
corrupt/truncated archives, changed reviewed service even after reanchoring,
unsafe/duplicate/extra/missing/link members, compression/metadata/comments,
prefixes/trailers, oversized directory counts/lengths, local-header drift, CRC
failure, total bounds, symlinks and stale success after transport mutation during
source verification. Twelve service-build, six paired-delivery, eleven runtime-source
and ten source-package fixture tests pass. Ordinary compiler tests pass 140 cases with
one optional historical-service skip; syntax/source/vendor/recipe checks pass.
CLI help works. Workflow YAML parses with explicit bash, maintenance matrix and
the transport entry point checked; actionlint is unavailable. The workflow now
runs the nine transport fixtures independently on both maintenance hosts, retains
their log and describes absent CI binaries separately from completed review.

In FirmingoKit, a newly generated `.build/transport-consumer-r1` SwiftPM package
builds and runs using only SDK-local resources and the extracted `compiler.wasm`:

```sh
python3 Tools/ManagedWASM/make-resource-consumer.py --fresh transport-consumer-r1
swift run --package-path .build/transport-consumer-r1 ResourceConsumer \
  "$PWD/.build/extracted-service-delivery-r1/compiler.wasm"
```

Actual private-WebKit compilation reproduces synthetic Blink capsule
`018c94a4a49b71880d6f04aecbe08e809c8ecf49e4278261c45dad3ead205720`.
Service-free preparation `19c97c0a…` and declared-ELF conversion `ef8bff81…`
also pass. Execution does not look up the compiler checkout. Synthetic resident
bindings/capsules are test data and must never be deployed. SDK inventory check
retains `a2621c20…`; no compiled resource, runtime/recipe pin or production
descriptor changes. The normal adapter validation passes all 152 SDK test
functions with nine unavailable-service skips. Logs are SDK-local
`.build/transport-{fresh-consumer,adapter-validation}.log`.

The initial sandboxed adapter invocation failed Swift standard-library cache
access. The permitted native-cache rerun passes; the fresh actual consumer also
uses permitted Swift/WebKit host access. No failed cache invocation is counted as
a compiler pass. SDK source is unchanged; its only tracked update is provisioning
documentation, so iOS target/DocC builds are not repeated for this increment.

This is a local transport/provisioning result. Hosted downloads, a trusted release
publication context, complete bundled consumer assets/default catalogue, signed
sandbox/minimum-OS and physical wrapper/device qualification remain separate.
The [qualification plan](../release-qualification.md) identifies the next evidence
for each owning repository. No board, device network, reset, flash, upload or
visual inspection is used. Firmware's pre-existing `AGENTS.md` change is preserved;
ArduinoKit remains untouched. A remote CI result is recorded only after inspection.

## Verified compiler CI

All eight jobs in [run 38651476748](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38651476748)
pass at implementation commit `ed45fcc821c0ada1df422b7e09ed1d75d14c6267`.
Downloaded logs show 140 portable passes/one optional historical-service skip on
both hosts and 12 service-build, 11 runtime, ten source-archive, six paired-delivery
and nine transport fixture passes on each maintenance host. Mutation jobs complete
4,000 JSON and 5,000 ELF cases. The real-runtime job has zero actual compilation
passes/eight unavailable-service skips; historical memory checks have one static
pass/one skip. Chrome 154.0.8037.97 passes three service-free browser cases with
six actual-compiler skips; owned-candidate web checks explicitly skip nine cases.
CI fetches or publishes no compiler. Actual extracted-service compilation remains
the separate local SDK consumer result above. Coordinated SDK documentation is
committed as `ea51fe7b1ae853d892e27f1712fe55b4f62ef8a5`.
