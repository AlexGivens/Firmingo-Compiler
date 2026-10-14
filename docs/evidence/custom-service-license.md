# Custom source grant and owned-provider checks

The author confirmed ownership and selected GPL-3.0 for his ArduinoKit and LLVM
patch contributions on 2026-10-13, answering the prior GPL-3.0-only selection
question. The authoritative grant and exact source inventory are
`service/source/SOURCE-LICENSE.md` and `service/source/manifest.json`; the latter
has SHA-256 `bfce43f96fc20b6f31bcd8592b0ee73df69dc3c01168f72ead4b1cec293f752d`.
All 23 original source/header/patch inputs are byte-identical to their historical
pins. The original upstream LLVM license is retained unchanged. No generated
output exception or upstream relicensing was added.

On the recorded Darwin host, Node 22.12.0 and isolated Python 3.12.14 ran:

```sh
node tools/dev.mjs check
node tools/dev.mjs test
node tools/dev.mjs test-service-build
node tools/dev.mjs test-runtime-build
node tools/dev.mjs service-build capture \
  .build/service-owned-gpl-config.json .build/service-owned-gpl-inputs
node tools/dev.mjs export-service-materials .build/service-license-review-a
node tools/dev.mjs export-service-materials .build/service-license-review-b
node tools/dev.mjs inventory-candidate .build/service-runtime-source-b \
  0ff22e889acc750db74be7ce49e80744513f558df9f42b186975699a34e88350 \
  .build/schema2-firmware-ci-artifacts/managed_sketch/ci/resident-export \
  9246a7da31b3b4237d1783feb195a7e7719d65c6f4165f440d05de5daea876e4 \
  .build/candidate-inventory-gpl-grant
```

The explicit local configuration selects this repository's `service/source` and
the previously verified runtime-source-h outputs. It selects the upstream LLVM
Git cache separately; it contains no ArduinoKit custom-source provider. Capture
completed with 113,508 upstream source objects, 2,049 sysroot and 304 resource
files. Its input-manifest SHA-256 is
`1114f3f849f4b905f99c575fba8e0ecb47924ff79fadaaa10769c9f9ce69831f`.
It records the original-contribution GPL license and all four grant/license
material hashes. Historical reference receipt statements remain unchanged.

An independent Python comparison checked that every custom input and all 2,353
runtime files have the same path/size/hash as the existing candidate build.
That candidate is the 101,194,565-byte bounded service, SHA-256
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
This increment did not run another full LLVM build or service execution; those
results remain the previously recorded [runtime source](runtime-source-build.md)
and [web maintenance](built-service-web.md) evidence. The new provider's actual
snapshot, patch and grant-retention paths are exercised by synthetic fixtures.

Both review exports contain 54 inventoried files and have the same 10,301-byte
manifest, SHA-256
`9ccb007fb56c239d83d5d4158ed5a4126fd449cfa357f782a91ea8de56ad02d1`.
Independent checks reread every exported file, verified its byte count/hash,
and compared all payloads, manifests and receipts across the two destinations.
They explicitly report incomplete corresponding source and unresolved binary
distribution. The refreshed metadata-only candidate inventory includes the
author grant and retains the public source-package hash
`93f149a454b1fc1c60ea21775b7b860e99b1a4031f8c810fb1f5de3bc18c4fd4`.
Its own SHA-256 is
`0cbff852fb672cff195e339347e3ef7fff339cb3c503807153662ccecd5731c2`.
No public service pin or default catalogue changed.

Local checks passed: 136 portable tests and one optional-service skip; eleven
service maintenance fixtures; eleven runtime fixtures; JavaScript syntax and
source/recipe/vendor integrity checks. New cases reject changed grants, missing
records, source drift, symlinked files/directories and ambiguous providers, and
verify deterministic complete review exports. Fixture builds are not LLVM or
hardware evidence. Workflow YAML parsed successfully; a Bash pipeline failure
propagated through `tee`. Actionlint was unavailable on this host. Updated CI
runs these checks on macOS/Linux and retains each source-license review export;
the local results alone do not claim a subsequent GitHub run passed.

The custom authorship/license-choice gap is closed. Exact linked-component and
file-specific notice review, complete corresponding-source packaging paired with
a selected binary/delivery method, deliberate pin promotion and public consumer
qualification remain open. See [the licensing record](../service-licensing.md).
ArduinoKit is unchanged, FirmingoKit's working state is unchanged, and the
pre-existing Firmingo `AGENTS.md` edit was preserved.

## Verified GitHub run and review artifacts

All eight jobs in [run 38505878869](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38505878869)
passed at source/tooling commit `f93f3737336b4cc7624434bf92af0883b16a127a`.
Actual downloaded job logs show 136 portable passes and one optional-service skip
on each OS, plus eleven service and eleven runtime maintenance fixture passes
on each OS. JSON/ELF mutation jobs report 4,000/5,000 bounded cases respectively.
The unavailable real-service suite has zero compiler passes/eight skips; memory
maintenance has one static gate pass/one unavailable-service skip. Chrome
154.0.8037.97 has three service-free passes/six compiler skips, and the candidate
maintenance entry point explicitly skips nine cases because no asset was supplied.
No actual compiler or hardware run is inferred from this green workflow.

The `source-license-review-ubuntu-24.04` and `source-license-review-macos-14`
artifacts were downloaded separately. Every one of their 54 inventoried files
was reread and checked against its size/SHA-256 and local payload. Their manifests
and completion receipts also match the local export byte-for-byte. Both manifest
hashes are `9ccb007fb56c239d83d5d4158ed5a4126fd449cfa357f782a91ea8de56ad02d1`.
These are verified source-and-selected-notice review artifacts, with incomplete
corresponding-source and unresolved binary-distribution status retained.
