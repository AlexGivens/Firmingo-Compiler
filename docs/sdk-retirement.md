# SDK standalone compiler retirement — 2026-10-12

FirmingoKit now retires its old Node/WASI runtime/worker, recipe/vendor copies,
JavaScript tests and original SDK service/recipe-maintenance tools after shared
compiler and SDK replacement gates passed. The inactive ELF-only native bridge
and its old-envelope tests are also removed. Its `docs/compiler-retirement.json`
records 36 unchanged removed paths/byte hashes at SDK commit
`05cae8fa8e58c706eceb6a15812d7ca500375d7b`. Historical receipts/evidence are retained.

The SDK's `run-validation.mjs` now checks fixture integrity, the unchanged imported
resource inventory and Swift package/adapter/deployment tests. Only an explicit
optional service argument enables actual WebKit cases; absent or empty environment
cannot select the current directory. The SDK's independent capsule CLI now accepts
explicit capsule/report/binding files, and its WebKit verifier embeds sketches
without using Node-generated inputs. Public Swift preparation/conversion APIs and
independent deployment validators remain available; further compatibility migration
is deliberate remaining M6 work.

This repository owns memory maintenance through
`tools/dev.mjs bound-service <explicit-original> <new-development-directory>` and
`test-memory [explicit-original]`. Both original/derived hashes are pinned. Every
section outside the memory declaration is independently compared, and source and
existing outputs remain unchanged. Actual local adaptation exactly reproduces
101196044 bytes/SHA-256
`3e2544acf7f88f6f1d5fbce34648df8eb96dfff47afa242a3e008bc8f86e2f33`, maximum 4096 pages.
The emitted maintenance receipt preserves unresolved source/distribution status.
This command does not establish a reproducible source build or permission to
redistribute the binary. See [commands](development.md).

Local results: 90 compiler fast cases pass, one actual-adaptation case explicitly
skips; `test-memory` with the original passes both cases, including exact byte
identity/source preservation/nonoverwrite. Without the original it passes one
and skips one. Eight actual Node/WASM cases pass with the regenerated derivative;
CLI actual compilation yields the synthetic 276-byte capsule with SHA-256
`b1fe6d33463c0147d82ce646af01439055b372d4b6a17d2e621935d22eaaa802`.
The independent SDK validator accepts it and rejects wrong binding/corruption/
nonregular inputs. SDK validation reports 148 tests in 16 suites: nine real
WebKit cases skip with absent/empty input, all pass with the explicit derivative.
The standalone SDK WebKit verifier also compiles Blink/Console and rejects syntax
errors. Generic iOS Simulator/device builds pass. No firmware executable source,
API/recipe/service pin, imported source-package/runtime/inventory bytes or saved
receipt/journal schema changes. Fast export recreation confirms the package remains
`508216d85611a7bb0b604a09ae642cd9050b1d5a14abb7190d6db1543eb519d5`.

Logs: `.build/retirement-{contracts,memory,memory-availability,runtime,build,check}.log`
and SDK's recorded `retirement-*` logs. Compiler CI invokes service-memory availability
checks; SDK CI invokes its refocused test entry point. Workflow definitions have
not been run on GitHub; actionlint remains unavailable. No hardware, upload, signed
sandbox or physical iOS/iPadOS execution occurred. Test bindings remain NEVER DEPLOY.
