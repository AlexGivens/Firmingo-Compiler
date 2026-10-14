# Candidate compiler source package

`source-package build` assembles the source inputs for an explicitly anchored,
successful owned service and its matching source-built WASI runtime. It verifies
the candidate bytes, both completed input manifests, every runtime output, all
23 custom source/header/patch inputs and the exact upstream Git object selection.
No compiler executes and no service/runtime binary is promoted, copied or published.

```sh
node tools/dev.mjs source-package --help
node tools/dev.mjs test-source-package
node tools/dev.mjs source-package build path/to/package-config.json .build/source-package-a
node tools/dev.mjs source-package verify .build/source-package-a/source.tar.gz reviewed-archive-sha256
```

The closed schema-1 configuration has these fields, with actual absolute paths
and independently selected SHA-256 anchors replacing the placeholders:

```json
{
  "schema": 1,
  "serviceBuild": "/path/to/completed-owned-service",
  "serviceReceiptSHA256": "reviewed-64-digit-operation-json-sha256",
  "runtimeBuild": "/path/to/completed-owned-runtime",
  "runtimeReceiptSHA256": "reviewed-64-digit-operation-json-sha256",
  "llvmGit": "/path/to/read-only-pinned-upstream-git-cache",
  "archives": {
    "libc": "/path/to/pinned-wasi-libc-source.tar.gz",
    "wasiHeaders": "/path/to/pinned-wasi-headers-source.tar.gz"
  }
}
```

Use the optional Python 3.12.14 host via `FIRMINGO_SERVICE_BUILD_PYTHON`; the Node
entry point runs it with `-I -S -B`. The package contains the scripts needed to
run the underlying Python entry points directly after extraction. Node 22.12.0
is needed only for the service's static inspection step. Native bootstrap tools
remain explicit general-purpose prerequisites, with their original identities
recorded. No maintenance command installs or downloads them.

The new destination contains `package/`, `source.tar.gz` and a completion receipt.
A failure retains `failure.json` and never creates a successful receipt. The
payload contains the union of both recipes' exact **raw** upstream LLVM sources,
the two intact source archives and expanded trees, the custom sources/GPL grant,
all named upstream notices, captured bootstrap source headers, source recipes,
runtime adaptation/generation scripts and original build-identity records.
The raw source index retains Git blob IDs, modes, sizes and SHA-256 hashes.
Unmodified source and reviewable patches are separate; applying patches twice
would be an error. Original upstream test fixture data is retained, including
any binary-format test vectors; the actual compiler service and built runtime
libraries are excluded.

Archive order, uid/gid, modes, names and timestamps are normalized; gzip omits
the destination filename. Repeat identity is measured on the selected packaging
host. The verifier requires an independently trusted full-archive hash, then
checks every member against the bounded manifest without extracting or executing
it. Duplicate/extra/missing members, unsafe or cyclic links, unsupported types,
mode mismatches and payload drift fail. Normalized metadata does not authenticate
the publisher; the trusted anchor must come from the selected release context.

## Rebuild from the extracted package

After anchored verification, extract `source.tar.gz` into a **new** developer
directory. The root is `firmingo-compiler-source/`. Provision the recorded native
Clang/LLVM/LLD 22.1.8, CMake 4.4.0, Ninja 1.13.2, Python 3.12.14 and Node 22.12.0
first. Actual bootstrap dependency capture currently supports the recorded
Darwin environment. macOS/Linux synthetic tests do not qualify native Linux
asset production.

Use the documented runtime configuration in `docs/runtime-source-build.md`, but
replace its `llvmGit` field with `llvmSourceRoot` pointing to this package's
`upstream/llvm`; point `archives.libc` and `archives.wasiHeaders` to its
`archives/libc.tar.gz` and `archives/wasiHeaders.tar.gz`. Select the installed
native Clang resource directory and all tool/module/component paths explicitly.
The packaged bootstrap headers retain the original input bytes for comparison;
they are not an implicitly substituted compiler resource directory.

Run `python3 -I -S -B tools/runtime_build.py capture CONFIG NEW_CAPTURE`, review
its manifest anchor, then `build CONFIG ANCHOR NEW_RUNTIME --jobs 4`. This rebuild
stages the pinned WASI inputs, uses committed libc bindings (the Rust generator
was not used), applies the documented libc/libc++ adaptations, compiles/install
the Preview 1 runtime and performs the real C++ header-discovery check.

Use `docs/service-build.md` for the service configuration. Select
`serviceSourceRoot` as the package's `service/source`, `llvmSourceRoot` as
`upstream/llvm`, and the freshly built runtime's sysroot/resources. Select all
native tools/component roots explicitly. Run
`python3 -I -S -B tools/service_build.py capture CONFIG NEW_CAPTURE`, review
the manifest anchor, then `build CONFIG ANCHOR NEW_SERVICE --jobs 4`.
This snapshots raw inputs, applies each of the thirteen service patches once,
builds the 96 reviewed libraries and links the fixed `compiler.wasm` basename.
Runtime-generated data and LLVM/TableGen inputs are retained in the source tree
and build scripts; build configurations/logs containing developer paths are not
packaged as instructions. New capture identities intentionally reflect the new
source provider and maintenance code; historical build receipts are unchanged.

`llvmSourceRoot` is mutually exclusive with `llvmGit` in both maintenance
configurations. It verifies raw payloads against the index's recorded Git blob
ID, SHA-256 and mode; parent symlink aliases and escaping links fail. The index
is a byte-identity record, not independent proof of a Git commit. Its trust comes
from the anchored package generated against the pinned Git objects. No sibling
checkout or Git repository is needed for this input mode.

The initial archive remains a **candidate** corresponding-source package:
`completeCorrespondingSource: false` and `distributionStatus: "unresolved"` are
retained pending a rebuild from the unpacked archive and exact linked-file
notice/delivery review. See [the upstream notice review](service-upstream-notices.md).
This step does not change public consumer pins, add an output-license exception,
or qualify the public SDK/private web-host, board deployment or hardware.
