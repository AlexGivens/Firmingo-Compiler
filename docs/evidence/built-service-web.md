# Source-built service web qualification — 2026-10-13

The owned service rebuilt against the two identical source-built WASI runtime
outputs now passes real standard-worker checks on Node 22.12.0, Chrome
154.0.8037.93 and native macOS WebKit. This extends [runtime source evidence](runtime-source-build.md);
it does not promote the asset into public consumer APIs or distribution.

The module is 101,194,565 bytes, SHA-256
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
It retains ABI two and a 4,096-page memory maximum. The selected real CI resident
has API `0x10022c9c` and firmware build identity
`760c563a3288d9e07fbe7c501c173516736913324db760e4152640ea45dc7e8d`.
That is static metadata for firmware commit `4d53a28`, not installed-board evidence.
The host is arm64 macOS 27.0 (26A428), Xcode 27.0 (27A266a), Apple Swift
6.4.0.34.1. WebKit's reported user agent advertises Intel/10_15_7; that string
must not be mistaken for the machine's actual architecture or OS.

Actual commands, with output directories selected independently:

```sh
node tools/dev.mjs test-built-service .build/service-runtime-source-b/compiler.wasm \
  a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493 \
  .build/ci-resident-import-review/descriptor.json .build/owned-service-node-shared-checks
node tools/dev.mjs test-built-web .build/service-runtime-source-b/compiler.wasm \
  a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493 \
  .build/ci-resident-import-review/descriptor.json .build/owned-service-chrome-3
node tools/dev.mjs test-built-webkit .build/service-runtime-source-b/compiler.wasm \
  a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493 \
  .build/ci-resident-import-review/descriptor.json \
  ../FirmingoKit/.build/owned-service-webkit/VerifyBuiltServiceWebKit .build/owned-service-webkit-2
```

The explicit sibling executable here is a locally provisioned native test host;
no ordinary command or consumer discovers it implicitly. Its exact compilation
command and real address checks are documented in FirmingoKit's tool guide and
`docs/built-service-webkit.md`. Browser operations required local sandbox permission
to bind loopback/launch native hosts; tests used text protocol results only.

Both browser hosts pass all nine cases, with four compilation/lifecycle cases.
They build GPIO/delay and binary console, reproduce GPIO bytes, reject frontend,
mutable-storage and missing `__aeabi_uidiv` builds without artifacts, and permit
fresh builds. Separate cases verify wrong service digest, corrupt recipe,
busy/cancellation after compile-phase entry, cancellation recovery, startup deadline,
compile-phase deadline/recovery, production pin rejection and blocked external
requests. Chrome records no external requests or protocol faults. WebKit installs
a closed native content rule list in addition to the server CSP.

All ELF and capsule bytes are identical across Node, Chrome and WebKit:

| Sketch | Capsule bytes | Code bytes | Linear memory bytes | Capsule SHA-256 |
| --- | ---: | ---: | ---: | --- |
| GPIO/delay | 316 | 60 | 27,983,872 | `958b861bbc18d4666ed03e6976b39b9fea4812409ad91a3501abbb9685a80d7d` |
| Binary console | 392 | 136 | 28,049,408 | `b372c00edf4b60c662f73055685ed8764e9f8798fe9efbbafad04302549174c0` |

The previously rebuilt native helper using actual Firmingo `image.cpp/image.h` at
`d42613f` was run against both capsules from all three hosts. All six accept the
selected API (`ImageError::ok`); all six reject `0x10022ca0` (`wrong_api`, enum 6).
No Thumb code, upload, reset, flash, or device operation occurred.

Preliminary failures are retained in the record: Chrome report persistence first
rejected an incorrect expectation of five compilation cases; there are four.
Two hidden WebKit pages started autonomously reached the unchanged 120-second
deadline with no published artifacts. The second reported seven successful cases
before deadline recovery stalled. Explicitly awaiting the fixed page promise using
the existing SDK host's lifetime pattern passes all nine with unchanged deadlines.
This supports that hosting choice, without identifying a WebKit engine defect.
Protocol regressions also exposed a stale terminated-worker callback path; the
controller now ignores stale messages before invoking observers.

Other actual local checks: `test` passes 128/129 with one optional-service skip;
`check` passes syntax/resources; six focused lifetime/report/input cases pass;
`test-web` without a service passes three and explicitly skips six; native address
checks accept one and reject ten; normal SDK validation completes 152 test functions
with nine unavailable-service skips. Workflow YAML parses; actionlint is unavailable.
The recreated source export is still 50 records with manifest SHA-256
`93f149a454b1fc1c60ea21775b7b860e99b1a4031f8c810fb1f5de3bc18c4fd4`.

Compiler CI now exercises normal rejection fixtures and explicitly skips all nine
candidate cases without provisioned bytes. No subsequent run is claimed here;
SDK manual CI additionally compiles its native host and runs address checks, but
requires a provisioned self-hosted runner. iOS/DocC builds are deliberately not
rerun for this maintenance-only tool; no package/API/platform setting changed.

Complete compact module, descriptor, implementation, native helper, operation-report
and artifact identities, case outcomes and twelve independent validator results
are in [the JSON evidence](built-service-web.json). Consumer pins and default
catalogue remain unchanged. Public SDK/private-scheme and packaged-consumer promotion,
source licensing/distribution, signed/minimum-OS and physical iOS/iPadOS qualification,
and device execution remain open.
