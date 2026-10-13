# Synthetic parser fixtures — NEVER DEPLOY

All ELF/code/firmware metadata here is synthetic and non-executable or parser-only.
Do not upload or execute these bytes. Tests do not establish real source compilation,
resident identity, or hardware behavior.

`provenance.json` retains the foundation request/descriptor origins and independent
Python identities. `pipeline-provenance.json` records unchanged SDK ELF and firmware
upload-frame origins plus sizes/hashes for pipeline vectors and independently
Python-generated report/receipt JSON.

The FMS1 golden capsule is extracted from the frame after its 16-byte FMGO header
and eight-byte chunk metadata. The bytes and digest originate in Firmingo's pinned
GPLv3 firmware vector; that attribution is retained. The ELF envelope was independently
hand-authored in FirmingoKit, without running a compiler, using the same eight-byte
parser code. The capsule/vector is compared byte-for-byte, not reconstructed using
this library's encoder to generate its own expected result.

Request/provenance JSON contains dummy resident/image/report/toolchain hashes.
The portable packaging receipt is a separate versioned schema from SDK receipts,
and expressly identifies independently linked ELF with declared provenance.
