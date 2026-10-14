# Local service transport

`service-release` prepares a reproducible transport of the reviewed paired delivery.
It creates a new directory with `firmingo-compiler-service.zip`, `release.json` and
a local `operation.json`. It performs no network operation or publication. The ZIP
contains the nine service/source/notice payloads plus their delivery manifest;
local receipts are excluded. The version is the exact reviewed service delivery
identity, currently `llvm-22.1.8-wasip1-abi2-r1`.

```sh
node tools/dev.mjs service-release --help
node tools/dev.mjs test-service-release
node tools/dev.mjs service-release build \
  VERIFIED_PAIRED_DELIVERY TRUSTED_DELIVERY_MANIFEST_SHA256 NEW_TRANSPORT_DIRECTORY
node tools/dev.mjs service-release verify \
  TRANSPORT_DIRECTORY TRUSTED_RELEASE_JSON_SHA256
node tools/dev.mjs service-release extract \
  TRANSPORT_DIRECTORY TRUSTED_RELEASE_JSON_SHA256 NEW_CONSUMER_DELIVERY_DIRECTORY
```

Use the optional isolated Python host described in [service maintenance](service-build.md).
The caller must obtain the release inventory hash from a trusted release/package
context. Calculating a hash from an unchecked download and passing it back does
not authenticate its publisher. The inventory binds the archive's size/hash,
delivery manifest, review, source and service identities. Independently compiled
review pins and full paired-delivery validation remain enforced even with a new
inventory anchor. Checksums are not signatures.

The transport uses stored ZIP entries to avoid recompressing the source archive
and to permit a strict bounded format. Fixed timestamps, ordering, permissions
and metadata make the archive independent of local paths, file times and modes.
The ten ordinary root files have no links, directories, extra fields or comments.
Encrypted, compressed and ZIP64 variants, duplicate/unsafe names, hidden members,
prefixes, trailers and changed local headers are rejected. The central directory
is bounded before ZIP parsing; total archive and expanded payload limits are
400 MiB. Extraction streams bytes and checks lengths and CRCs before the ordinary
delivery verifier checks every payload and every source member. It then rechecks
the archive and release inventory after the longer source pass. Extract requires
a new directory, writes completion last and removes its own failed output.
Verification uses temporary disk space; it needs room for the archive plus the
approximately 336 MB extracted delivery. It does not unpack the LLVM source tree.

After extraction, FirmingoKit maintenance may stage the four reviewed notice
documents from that delivery and supply its `compiler.wasm` explicitly to the
existing wrapper APIs. Normal consumers require no Python, Node, native compiler
or sibling checkout. The binary/source transport is separate from the source-only
web runtime/recipe export; it does not silently install assets in SwiftPM resources
or populate the firmware catalogue. Keep the complete paired source and notices
available alongside any shared binary. See [delivery](service-delivery.md) and
[qualification gates](release-qualification.md).

Future hosted provisioning must establish a trusted inventory anchor and retain
equivalent source access at the binary's distribution location. Publication,
signing, automatic download/update policy and a complete bundled consumer release
are separate work. This command prepares reviewable local bytes for those steps.
