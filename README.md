# Firmingo-Compiler

A portable WASM compiler project focused on Firmingo managed sketches, with
conventional Arduino firmware compilation as a secondary goal.

Implemented portable stages include dependency-free request validation, bounded
JSON, source preprocessing/mapping, strict Nano ELF/FMS1 validation, independent
ELF packaging with report/receipt, and verified fixed Nano recipes/jobs. The
isolated WASI worker now compiles and links through an explicit pinned local service,
with diagnostics, cancellation/deadlines, independent output checks and execution receipts. No service
binary is bundled and no board/runtime combination is hardware-qualified.

Firmingo supplies device contracts and verified firmware facts. This repository
owns portable compilation, recipes, packaging, diagnostics and static metadata.
FirmingoKit owns Swift hosting, device associations, communication and deployment.
FirmingoKit now delegates its build APIs to this package through a tested macOS WebKit adapter;
both public preparation APIs also use the shared service-free worker;
public supplied-ELF conversion remains a compatibility implementation.

Use pinned Node **22.12.0** for development; no external packages are required:

```sh
node tools/dev.mjs --help
node tools/dev.mjs doctor
node tools/dev.mjs test
node tools/dev.mjs check
node tools/dev.mjs fuzz
node tools/dev.mjs fuzz-elf
node tools/dev.mjs test-runtime # Explicit skips without a supplied service
node tools/dev.mjs test-web # Browser-only checks; compilation skips without a service
```

Production `src/` modules have no Node or Swift dependency. The developer CLI can
validate requests, prepare source, or package an explicitly supplied ELF into a
new output directory. It can compile with an explicit local service; it has no device operations. Tests use synthetic metadata that must never reach hardware.

Start with the [interface draft](docs/interface.md),
[selected baseline/support matrix](docs/compatibility.md),
[portable pipeline](docs/portable-pipeline.md), [WASM runtime](docs/runtime.md), [web harness](docs/web-harness.md), [migration plan](docs/migration.md), and
[development checks](docs/development.md). [TODO.md](TODO.md) tracks M1 complete
for inventory/selection and M2–M4 complete for the local development path; [AGENTS.md](AGENTS.md) governs scope.
See [foundation evidence](docs/evidence/foundation.md) and
[portable-stage evidence](docs/evidence/portable-pipeline.md) and [WASM execution evidence](docs/evidence/wasm-runtime.md) for actual checks and limits.

The actual browser-worker path also passes nine headless Chrome checks on the
recorded macOS host. The [FirmingoKit adapter](docs/sdk-adapter.md) also passes nine real macOS WebKit cases;
physical iOS/iPadOS, other wrappers and hardware remain unqualified;
see [browser evidence](docs/evidence/web-host.md). No compiler service is bundled.

SDK standalone runtime/recipe/vendor copies are now retired after replacement tests;
see [retirement evidence](docs/sdk-retirement.md). Compiler-owned service memory
maintenance uses explicit inputs and new development output directories.

[Service-free preparation hosting](docs/service-free-preparation.md) now covers the
public Swift preparation adapters and standard module-worker path without a WASM binary.
