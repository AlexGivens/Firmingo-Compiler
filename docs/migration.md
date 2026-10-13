# Migration into Firmingo-Compiler

The prerequisite [cross-project inventory](../../FirmingoKit/docs/compiler-migration.md)
already maps 192 reference inputs. This local plan selects the first Nano contract
and moves the new portable boundary forward without removing working SDK code. The subsequent portable-stage increment
imports the unchanged recipe and ports source/ELF/capsule behavior; actual WASM
execution and the macOS Swift adapter are now implemented; see [SDK adapter](sdk-adapter.md).
The sibling link aids research; normal builds/tests use local fixtures exclusively.

## Current increment

- Pin 24 relevant source/resource inputs and original/bounded service identities
  in [baseline.json](baseline.json), distinguishing read-only hash checks from builds.
- Implement input validation/identity independently in portable JavaScript and
  preserve the SDK's schema-one descriptor ID using an independent golden fixture.
- Establish local tests, bounded parser mutation checks, input-only developer tools,
  draft schemas, CI definition, and honest availability documentation.
- Leave SDK implementation/resources, firmware ABI/wire behavior, source fixture
  manifests and historical receipts unchanged. No compiler execution is claimed.
- Implement portable source normalization/lexical diagnostics, strict ELF/FMS1
  parsing, independent packaging and a distinct declared-provenance receipt. Import
  recipe bytes without changing their hash; retain independent firmware/Python
  vectors and validate them through production code and developer CLI.
- Preserve SDK descriptor and generated-source hashes. First-line BOM diagnostic
  columns are corrected to include its three original bytes; document this narrow
  adapter compatibility difference before deployment integration.

## Extraction and retained ownership

| Next work | Owner |
| --- | --- |
| Source preparation/coordinates, ELF parsing, canonical capsule/report/receipt generation | Compiler; port Swift behavior with independent vectors |
| WASI service/workspace/worker execution and explicit Nano recipe | Compiler; extract licensed/independently authored inputs with notices and limits |
| WebKit origin/view lifecycle, native-message translation, Swift async/types/API adapters | SDK |
| Static metadata/assets and compatible recipe descriptors | Compiler, based on actual firmware exports |
| Resident ABI/facade/layout, real ELF/UF2/build reports, native GCC proof, device validators | Firmware |
| Artifact-to-device binding, installed-image evidence, fresh capabilities, install/upload/journals | SDK |

## Compatibility and removal gates

1. Implement preprocessing and ELF/capsule output with golden tests before claiming
   source-to-artifact compatibility; retain SDK tests until portable replacements pass.
2. Execute the real WASM path with CLI and web hosts using the same production core;
   prove error, memory/workspace bounds, cancellation/deadline and clean reentry.
3. Wrap it in FirmingoKit without silently changing public API/descriptor/receipt IDs
   or saved device/transaction records. The input contract here preserves descriptor
   identity but is not an adapter or migration for existing artifact receipts.
4. Verify clean versioned package consumption and independent SDK deployment checks
   before removing duplicate code. Pin resource/interface/recipe versions explicitly.
5. Resolve real firmware exports and service distribution evidence before packaging
   production assets. Qualify two supported sketches through actual wrappers and
   selected hardware separately from structural parser/runtime evidence.

See [compatibility](compatibility.md) for the baseline and unresolved dependencies,
[interface](interface.md) for implemented versus draft behavior, and
[TODO](../TODO.md) for milestone status. No conventional Arduino or second-board
support follows from this foundation.

## Actual execution increment — 2026-10-12

Portable service/workspace/memory gates are now extracted with the unchanged WASI
shim/notices and new correlated controller/worker/Node adapters. Real source reaches
independently validated ELF/FMS1 output; local tests exercise compiler/linker
failures, cancellation/deadlines and fresh builds. Runtime event/receipt schemas
are implemented. Two ELF outputs match the old SDK path byte-for-byte and pass
Firmingo's production image validator; synthetic bindings remain NEVER DEPLOY.
See [runtime migration provenance](runtime-migration.json) and
[execution evidence](evidence/wasm-runtime.md). This satisfies the local execution
part of gate 2, not the web/Swift/package/deployment gates. No SDK executable copy
or API was removed; portable authority now lives here and the SDK implementation
remains the compatibility reference until its adapter passes.


## Standard browser-worker increment — 2026-10-12

The same production core now passes nine headless Chrome cases through its default
module worker, including real compilation/lifecycle and output comparison with the
independent Node/firmware capsules. A minimal readonly loopback harness and separate
browser CI entry point are implemented; absence produces explicit skips. See
[web-host evidence](evidence/web-host.md). This covers the tested standard web host
in gate 2. Swift/WebKit origins, versioned package consumption, deployment and
approved distribution gates remain open; no SDK implementation is removed.

## SDK adapter increment — 2026-10-12

The [source package and tested adapter](sdk-adapter.md) satisfy local gates 3–4 for
the build facade and separate consumer. Native source preparation/conversion APIs
and historical developer tools remain explicit compatibility references pending
retirement. Approved assets, actual resident exports, signed/physical Apple-host
execution and deployment remain separate gates.

## Standalone runtime retirement — 2026-10-12

[SDK retirement evidence](sdk-retirement.md) records removal of the replaced standalone SDK execution/recipe/vendor stack, its old bridge and the new compiler-owned service-memory maintenance command. Public Swift preparation/conversion compatibility APIs and independent deployment validators remain intentional retained paths.
