# Candidate source package and unpacked-source checks

Work resumed on 2026-10-14 after a connection timeout. Saved receipts established
that both initial package builds and the actual packaged-runtime rebuild had
completed. No completed operation was restarted or substituted with a mock.

`source-package build|verify` now supports a source-only candidate archive tied to
the 101,194,565-byte service, SHA-256
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
Its successful service receipt anchor is
`0ff22e889acc750db74be7ce49e80744513f558df9f42b186975699a34e88350`;
the matching runtime receipt anchor is
`7e0cd4fbb2817016c02d552b8cbe7a4f5b0d52902926dc50e80608c97658b629`.

Both initial fresh assemblies contained 140,303 payloads, including 136,806 raw
LLVM source objects from the union of both maintained recipes, the two complete
pinned WASI source archives/expanded trees, all 23 GPL custom inputs, 29 named
notice/license files, source headers, build scripts and build-identity records.
Their normalized 234,305,527-byte archives were byte-identical, SHA-256
`925086ae43d1034322a4392de07617ad90234da0d75beab354a28c205b0d4a3b`.
The corresponding 32,340,157-byte manifest has SHA-256
`ecf9e4d2ae9041425b1fa62c1ac7ab7565d13c47bb0be2dc154c2e23291ff401`.
The producer independently verified every archived member before completion.

The final hardened variant closes the owned-material inventory, checks the two
license identities and rejects a Boolean schema value. It has the same source
and payload counts; its 234,305,479-byte archive SHA-256 is
`dcdbe2d1fc2135dc726f06aa7b4fa4be9d81ac61f5fba2969d464f21b86089ef`.
Its manifest SHA-256 is
`7ba2a5cc1379a2c9c0e327a77846579e3010ac81fc76ed2e33d8254b6bb08b94`.
The only changed payload from the initial unpacked package is
`tools/source_package.py`; all actual runtime/service sources, recipes and rebuild
scripts remain unchanged. A separate anchored verification and repeat archive
check cover this final variant. The actual compiler service and built runtime
libraries are excluded; original upstream binary-format test fixture data is
retained as source-tree data.

## Actual execution from the unpacked source

The initial archive was extracted into a new ignored developer directory.
Both configurations selected its `upstream/llvm` through `llvmSourceRoot`, with
no upstream Git cache or sibling custom-source provider. The runtime selected
the package's two source archives; native bootstrap tools remained explicit
installed prerequisites. Isolated Python 3.12.14 ran the **packaged scripts**:

```sh
python3 -I -S -B PACKAGE/tools/runtime_build.py capture RUNTIME_CONFIG NEW_CAPTURE
python3 -I -S -B PACKAGE/tools/runtime_build.py build RUNTIME_CONFIG \
  34059fb7bf456f8e1422981118d8d72bb12178d9d7d5ba410455f5a30b464e60 \
  NEW_RUNTIME --jobs 8
python3 -I -S -B PACKAGE/tools/service_build.py capture SERVICE_CONFIG NEW_CAPTURE
python3 -I -S -B PACKAGE/tools/service_build.py configure SERVICE_CONFIG \
  aa0c445d0baba090fb277133e9e700634cbbeb8974825da90f0e1e8cc302f522 \
  NEW_CONFIGURE --jobs 8
```

The fresh runtime build completed compiler-rt, libc, libc++/libc++abi installation,
the real C++ header-discovery probe and upstream libc symbol comparison. Its
2,049 sysroot and 304 resource files reproduce the original inventory exactly:
SHA-256 `6e0d3ce6f05e7a4bf969d83df4e1b9237b229f3d74ecf1fb07dd068e7b07fd46`.
Independent comparison checked equality of the full original/new output
inventories. Its input-manifest SHA-256 is
`34059fb7bf456f8e1422981118d8d72bb12178d9d7d5ba410455f5a30b464e60`.
Committed libc bindings were used; the Rust generator was not run.

Service capture verified all 113,508 selected raw LLVM objects and 23 custom
inputs. Its owned snapshot applied the thirteen patches and retained GPL/LLVM
grant material. Real CMake configuration completed with `compiled: false`.
The selected sysroot/resources were the original source-built runtime, whose
bytes were independently reproduced by this packaged-runtime build. This is
configuration/input equivalence evidence, not another full LLVM library build,
service relink or new service execution.

An initial configure attempt launched Python through a different interpreter
parent. It correctly failed the captured-input gate before output creation.
Diagnosis showed one differing observation: `bootstrap.os` reported
`macOS-27.0-arm64-i386-64bit` rather than `macOS-27.0-arm64-arm-64bit`.
All other input records matched. Repeating capture with the original launch
context produced the original `aa0c…` anchor; direct configuration then passed.
Use a consistent pinned Python launch context for capture/build. No input gate
was bypassed, and no historical receipt was rewritten to explain the mismatch.

## Checks and remaining work

Local checks passed: 136 portable tests and one optional-service skip; twelve
service-maintenance fixtures; eleven runtime fixtures; ten source-package
fixtures; source/recipe/vendor integrity and JavaScript syntax checks. New cases
cover raw Git-blob/mode verification, safe links, removed Git caches, patch-once
behavior, corrupt/inconsistent archives, cyclic links, wrong receipt anchors,
closed licensed-source contents and bounded reads during file growth/replacement.
Fixtures never execute a compiler. Workflow YAML parsed; actionlint was unavailable.
The maintained macOS/Linux CI source-maintenance job now includes the archive suite.
Local results alone do not claim a subsequent GitHub run passed.

The archive is a candidate corresponding-source package. A full service rebuild
from the unpacked archive, exact linked-file/binary-notice review and paired
source/object delivery review remain open. `completeCorrespondingSource: false`
and `distributionStatus: "unresolved"` remain explicit. Public pins, source-only
consumer export, SDK packaging and default catalogue remain unchanged. No
hardware, firmware installation or device operation occurred. ArduinoKit remains
read-only, FirmingoKit is unchanged and the pre-existing Firmingo `AGENTS.md` edit
is preserved. See [source packaging](../source-package.md) and
[upstream notices](../service-upstream-notices.md).
