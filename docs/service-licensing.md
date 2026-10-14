# Custom service licensing and remaining distribution review

Alex Givens confirmed on 2026-10-13:

> ArduinoKit and LLVM patches were all authored by me, and should use the GPL-3.0 license

This answers the preceding request to select GPL-3.0-only for his original service
and patch contributions. The explicit grant is in
[`service/source/SOURCE-LICENSE.md`](../service/source/SOURCE-LICENSE.md);
[`manifest.json`](../service/source/manifest.json) binds it to all 23 original
source/header/patch files: ten service inputs and thirteen LLVM patches from
ArduinoKit commit `0eb3cd1841147dfc7ea25bf076545e38b01601e4`.
Every input preserves its pinned bytes. Adjacent license files avoid changing
compiler inputs, patch applicability or historical build identities. The historical
ArduinoKit checkout and its recorded receipts remain unchanged and read-only.

LLVM upstream code, patch context and file-specific notices keep their original
terms. The retained `LLVM-LICENSE.txt` is the unchanged 15,141-byte root license at
LLVM commit `ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`, SHA-256
`8d85c1057d742e597985c7d4e6320b015a9139385cff4cbae06ffc0ebe89afee`.
Its [Apache 2.0 license with LLVM exceptions](https://github.com/llvm/llvm-project/blob/ca7933e47d3a3451d81e72ac174dcb5aa28b59d1/LICENSE.TXT)
does not become a GPL-only upstream license through this grant. Retain required
upstream attribution and modification notices as the complete source package is
assembled. [LLVM's policy](https://llvm.org/docs/DeveloperPolicy.html#copyright-license-and-patents)
and the [Apache compatibility statement](https://apache.org/licenses/GPL-compatibility.html)
explain compatibility; neither substitutes for reviewing the exact included files.

The owned service source provider now accepts `serviceSourceRoot` in place of
`referenceRoot`. Its input bytes must match the historical pins, and its grant
materials must match this repository. Capture records the GPL designation and
all four grant/license material hashes; build snapshots retain them. Supplying
both provider fields is an error. No ArduinoKit checkout is needed for custom
service inputs. Upstream LLVM may come from a pinned Git cache or the verified
raw source archive through `llvmSourceRoot`; declared native/runtime inputs
remain explicit maintenance prerequisites.
Ordinary tests and consumer compilation require neither source checkout.

```sh
node tools/dev.mjs check
node tools/dev.mjs test-service-build
node tools/dev.mjs export-service-materials .build/service-license-review-a
node tools/dev.mjs export-service-materials .build/service-license-review-b
```

The export creates a new deterministic source-and-selected-notice **review
directory** with file sizes/hashes and a completion receipt. It includes the
23 custom inputs, author grant, GPL and LLVM license texts, selected wasi-libc and
browser shim notices, the pinned file-specific notice review bundle,
pinned recipes/source references, maintenance scripts and
build instructions. It contains no binary or implicit download and does not
alter public service pins. It deliberately reports
`completeCorrespondingSource: false` and `distributionStatus: "unresolved"`.
Repeat exports of unchanged inputs have identical bytes, independent of destination.

`node tools/dev.mjs verify-service-notices` checks the committed review inventory
and every license/excerpt byte. An optional explicit unpacked-source root also
checks the selected whole-file hashes and reconstructs the documentation from
exact source ranges. It does not verify the entire source archive or decide
distribution status. The 232 excerpts include internal crypt and floating-point
credits missed by a header-only search. See [upstream notice review](service-upstream-notices.md).

The ownership/license-selection gap for these custom contributions is closed.
Before distributing a selected binary, finish the linked-component/file-specific
notice review and assemble its complete corresponding source: pinned upstream
trees, patches, runtime adaptations, generation inputs and build instructions.
Pair that package with the exact binary identity and reviewed delivery method.
The existing [owned source-build](evidence/runtime-source-build.md) and
[candidate inventory](evidence/candidate-contract-inventory.md) evidence supply
the starting identities; historical receipts are not rewritten retrospectively.
Cross-host repeat-build qualification is an engineering goal, not an extra
license condition invented by this review. General-purpose build tools and system
libraries need separate scope assessment rather than indiscriminate inclusion.

No generated-sketch license exception has been requested or added. Compiler
licensing and the terms of code incorporated into an output are separate issues;
the Firmware-owned facade/module-entry sources retain their existing terms.
The public SDK/private web-host and fresh packaged-consumer qualification gates
remain separate from the source ownership decision.
