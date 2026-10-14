# Reviewed paired service delivery

`service-package build|verify` stages the exact source-built ABI-two service with
its corresponding source and binary documentation. The review is specific to
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`;
it does not clear the historical service. Public compiler/SDK pins now select
this reproduced service. No binary is committed, fetched automatically or published.

The [delivery review](../service/delivery-review.json) binds the successful rebuilt
service receipt, source archive, source/rebuild evidence and 232-notice inventory.
The author's GPL-3.0-only grant and upstream terms are retained. The full unpacked
runtime/service rebuild and exact compiled-input reconciliation support the
corresponding-source scope; the old archive's candidate flags remain historical.
The new delivery envelope records the later review, without rewriting old receipts.

The compiler combines the original GPL service/patch contributions with the
reviewed upstream LLVM/WASI and file-specific permissive/public-domain inputs.
Upstream code retains its licenses, LLVM exceptions, attribution, modification
notices and disclaimers. Apache documents [Apache-2.0/GPLv3 compatibility](https://www.apache.org/licenses/GPL-compatibility.html).
The delivery retains full texts and source comments, including the required
regex/Unicode/crypt/floating-point credits; it adds no generated-sketch exception.
See [the notice review](service-upstream-notices.md) for the exact included terms.

```sh
node tools/dev.mjs service-package --help
node tools/dev.mjs test-service-package
node tools/dev.mjs service-package build \
  REVIEWED_SERVICE_BUILD VERIFIED_SOURCE_ARCHIVE NEW_DELIVERY_DIRECTORY
node tools/dev.mjs service-package verify DELIVERY_DIRECTORY TRUSTED_MANIFEST_SHA256
```

Use the documented optional Python 3.12.14 host. Build requires the independently
pinned completed service receipt/input manifest, exact module/source bytes, every
archive member and reviewed notice texts. It creates a new directory only,
verifies observed copies and writes completion last. Verification anchors the
inventory independently, rejects missing/extra/duplicate/unsafe roles, checks all
payloads and every source member, then rechecks bytes after the longer archive pass.
Synthetic tests use tiny non-executable inputs; they do not qualify a compiler.

The nine payload roles are `compiler.wasm`, `compiler-source.tar.gz`, `LICENSE`,
`LICENSES.txt`, `FILE-NOTICES.txt`, `source-notices.json`, `delivery-review.json`,
`README.md` and `BUILDING.md`. The fixed service basename is retained. The source
archive includes raw upstream sources, original contributions, separate patches,
runtime adaptations/generation inputs and rebuild scripts. General-purpose native
bootstrap tools/system libraries are prerequisites; the statically linked WASI
runtime's source is included. Public consumers need a web/WASI host, not those
native build tools.

Keep all roles with a shared binary. A future hosted release must offer equivalent
source access through the same place without an extra charge, as described by
[GPLv3 section 6(d)](https://www.gnu.org/licenses/gpl-3.0.html). Source/notices must
remain available while that binary is offered. Local staging tests this arrangement;
it creates no GitHub release, download URL, signed package or publication claim.

## Consumer migration

The previous 101,196,044-byte service (`3e2544ac…`) is replaced by the reproducible
101,194,565-byte service (`a7648688…`). ABI, 256 MiB cap, interface and Nano recipe
remain unchanged. Exact asset/runtime/toolchain digests change deliberately; the
old binary is rejected by current consumer gates. `bound-service` remains a
historical maintenance tool and no longer derives the accepted consumer service.
Historical receipts, capsules, associations and deployment journals are retained.

The new source-only export remains fifty source records; its manifest SHA-256 is
`4cbdf856304063dbac59a27ea8703f74ffedbc534521b0d40d13013913d4dba5`.
FirmingoKit imports that export plus four pinned service/source-notice documents,
then verifies twelve local roles and the explicit service before WebKit execution.
Its normal bundle contains no WASM service and its descriptor catalogue remains
empty. Reviewed licensing does not invent a supplied compiler, firmware descriptor,
installed-image identity or hardware capability. See [actual delivery qualification](evidence/service-delivery.md).
