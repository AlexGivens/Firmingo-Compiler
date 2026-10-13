# Development and validation

Use **Node 22.12.0**, selected from the available SDK-compatible development runtime
and pinned in `.node-version` and `package.json`. No external package installation is needed; the pinned WASI shim is vendored and checked;
`node:test`, assertions and developer utilities are built in. No package installation,
Swift/Apple tools, board, sibling checkout or network is needed for normal checks.
Consumer modules under `src/` have no Node imports.

Explicit maintenance commands now include [service auditing](service-provenance.md)
and [resident metadata import](resident-import.md). Both validate before creating
new local output directories. Ordinary tests cover their rejection gates using
owned fixtures; no reference checkout, firmware images or service is required.

From the repository root:

```sh
node --version
node tools/dev.mjs --help
node tools/dev.mjs doctor
node tools/dev.mjs check
node tools/dev.mjs test
node tools/dev.mjs fuzz
node tools/dev.mjs fuzz-elf
node tools/dev.mjs validate-request tests/fixtures/synthetic-build-request.json
git diff --check
```

`npm test`, `npm run check`, and `npm run doctor` are conveniences for the same
entry points. `dev.mjs` reports a version mismatch rather than installing tools.
Use your chosen Node installer/version manager explicitly to obtain the pinned
release if absent; do not automatically change the system. `--help` works before
the runtime-version gate.

`test` verifies eight local fixture hashes, the unchanged Nano recipe and vendored shim
receipt/licenses, then runs production contract/pipeline/WASI/host-lifecycle/CLI
regressions. It excludes actual-service tests so ordinary checks stay asset-independent. `check` checks
JavaScript syntax, fixture integrity and recipe integrity. `fuzz` is a separate bounded
4000-case differential JSON mutation run with seed `1179469647`, comparing accepted
inputs to native JSON decoding; stricter production rejection is allowed. It does
not fuzz C++/WASM. `fuzz-elf` is a separate 5000-case production ELF parser mutation
run with seed `1162626609`, checking bounded typed rejection and accepted-layout
invariants. No fixture machine code executes. Failed cases print seed, index and
synthetic input for exact reproduction.

`validate-request` reads one explicitly selected bounded regular file with strict
UTF-8 decoding, validates it using production logic, and prints input identity
only. It does not preprocess, compile, package, connect or deploy. The sample uses
synthetic parser metadata; NEVER DEPLOY. The additional implemented commands below prepare source and package independently
linked ELF. Real compilation uses the explicitly supplied service described below.

## Source preparation and independent packaging

Choose a new explicit output directory; its parent must already exist. Existing
directories are refused and no file is overwritten. Output `operation.json` is
written last, after all bounded files, to identify a completed local operation.
A write failure may leave incomplete local files; it never produces a success
summary. These operations do not compile, connect, install, or deploy.

```sh
mkdir -p .build
node tools/dev.mjs prepare-request tests/fixtures/synthetic-packaging-request.json .build/prepared-example
# Select an actual independently linked ELF and its declared provenance explicitly:
node tools/dev.mjs package-elf path/to/request.json path/to/linked.elf path/to/provenance.json .build/packaged-example
```

Preparation writes `Sketch.cpp` and hash/location metadata. Packaging writes `.fms`,
report and distinct packaging receipt, plus the completion summary. The sample request
contains synthetic metadata and is NEVER DEPLOY; it is not a real build descriptor.
CPP/ELF checks, source mapping, cancellation and receipt semantics are documented in
[the portable pipeline](portable-pipeline.md). No source text is printed in routine
CLI output; source files are written only to the explicit preparation destination.

## Real WASM builds and regression tests

Provision the exact memory-bounded service identified in [runtime.md](runtime.md)
into an explicit local path. No command downloads/stages it or uses sibling paths
implicitly. The service's redistribution/build provenance remains unresolved;
do not add it to tracked assets or releases.

```sh
# Uses production worker, recipe, diagnostics, independent validation and packaging:
node tools/dev.mjs build path/to/request.json path/to/compiler-bounded.wasm .build/compiled-example
# Explicit local-service integration (real compile/link, failures and disposal):
node tools/dev.mjs test-runtime path/to/compiler-bounded.wasm
# Missing assets are observed as seven explicit skips, zero compilation passes:
node tools/dev.mjs test-runtime
```

`build` accepts the existing closed build request and uses the package's pinned Nano
recipe. It writes `.fms`, `Sketch.elf`, `report.json`, `receipt.json`, `diagnostics.json`,
`runtime.json`, and finally `operation.json` into a new explicit directory. Routine
stderr contains bounded progress; stdout contains the final operation summary.
It has no device operations. SIGINT cancels the active worker; request deadlines
bound worker lifetime. Failed/cancelled/timed-out builds create no output directory;
a local write failure can leave incomplete files without a completion marker.
Errors exit nonzero and retain structured compiler diagnostics on stderr.

`test-runtime` runs only `tests/real-runtime.test.mjs`, in a bounded developer process.
The service path is passed internally as `FIRMINGO_COMPILER_SERVICE`; the CLI deliberately
ignores an ambient variable when no explicit path is supplied. Wrong paths/identities
fail, rather than skipping. The suite uses synthetic firmware bindings, NEVER DEPLOY,
and reports actual compiler/linker cases separately from startup timeout cases.
The Node adapter is developer-only and does not establish browser support.

## CI

`.github/workflows/checks.yml` pins action revisions and Node 22.12.0, running the
same foundation/check/test commands on macOS 14 and Ubuntu 24.04. Separate Ubuntu
jobs run bounded JSON and ELF mutation. Bash/pipefail preserves failures through `tee`;
always-uploaded logs live under ignored `.build/logs/`, and the matrix keeps
`fail-fast: false`.

Checkout/upload pins match the existing firmware workflow; setup-node 6.1.0 is
pinned to its [official release commit](https://github.com/actions/setup-node/commit/395ad3262231945c25e8478fd5baf05154b1d79f).
The action runtime is distinct from the pinned development/compiler toolchains;
future upgrades require deliberate review. Setup uses an explicit version file
and disables package-manager caching according to the
[official action interface](https://github.com/actions/setup-node).

The maintained Nano recipe is integrity/job-generation tested in the normal
matrix. A separate `real-runtime` job runs the actual integration entry point without
a service and records **eight skips and zero compilation passes**, with an explicit
job summary/log. Actual Nano compile/link recipe execution is deliberately excluded
from public CI until reviewed service assets and an approved provisioning mechanism
exist; there is no automatic download or mock compile substitute. Local explicit-service
results are separate evidence. A separate `web-host` job now runs `test-web` with
explicit browser/compiler absence counts and JSON artifacts. The existing runner
browser is recorded when present; no browser or service is downloaded by this job.
Hardware stays opt-in. The first inspected GitHub run passed both contract jobs,
both mutation jobs and the service-availability job, but failed browser profile
cleanup with `ENOTEMPTY`. The lifecycle correction and successful six-job run at
`2282bae` are recorded
in [browser cleanup](evidence/browser-cleanup.md); local passes are not GitHub success.
`actionlint` was unavailable on the inspected machine; the workflow
has been manually reviewed and parsed with the available Ruby YAML library, with
trigger/job/shell/matrix assertions. Local failure propagation is checked separately.

## Fixture/reference provenance

`tests/fixtures/provenance.json` identifies an unchanged SDK synthetic descriptor,
its source commit/hash, independently authored request, and Python-generated
descriptor/request identity expectations. Verification reads only local files.
`docs/baseline.json` records selected source/resource hashes and service identities;
it is informational provenance, not a trusted distribution manifest or evidence
that a compiler ran. Initial read-only checks verified SDK development binary identity without execution.
The subsequent explicit-service checks now execute the bounded binary without copying
or distributing it; see [runtime evidence](evidence/wasm-runtime.md).

## Imported recipe and pipeline fixture provenance

The Nano manifest and four recipe assets are imported unchanged from the selected
SDK commit; production integrity checks preserve its original manifest hash.
The original generator's Swift-preprocessor comment is historical: portable
preparation now enforces the same prefix/lexical policy. No service/shim/sysroot is
copied by this import. `tests/fixtures/pipeline-provenance.json` records unchanged
independent ELF/firmware vectors and Python-generated packaging report/receipt.
See [portable-stage evidence](evidence/portable-pipeline.md) for actual checks.

## Runtime migration and licensing

`docs/runtime-migration.json` records original SDK source hashes and adaptations.
The in-memory workspace/service/memory parser are imported from FirmingoKit;
`third_party/browser_wasi_shim/` retains unmodified 0.4.2 files, both MIT/Apache-2.0
notices and the original receipt. `verify-vendor.mjs` checks that receipt against
its package anchor and each recorded file. The original npm registry integrity
was advertised upstream, not independently reacquired. This vendored shim does
not resolve the separate compiler-service redistribution/source obligations.

## Web harness and headless tests

`node tools/dev.mjs serve-web [explicit-service.wasm]` starts a readonly ephemeral
loopback host for `web/harness.html`. `node tools/dev.mjs test-web
[explicit-service.wasm] [--browser path/to/chromium]` drives a new headless browser
profile through the same standard browser module worker. It never uses the normal
browser profile or screenshots; exact host versions and JSON results are retained.
Shutdown waits for process/stdio closure, permits bounded graceful shutdown and
termination of the isolated browser's own process group, then retries transient
profile-removal failures. Unconfirmed closure retains the profile and fails;
cleanup errors preserve the original check failure. CLI interruption also cleans
up its isolated browser and reports failure.
See [web harness](web-harness.md) for actual commands, byte/policy limits, controls,
explicit 3-pass/6-skip service absence behavior and nine-case real-service evidence.
These developer operations need permission to launch a browser/bind/connect loopback
when a sandbox restricts them; the ordinary fast suite requires neither.

## Declared ELF packaging

Service-free supplied-ELF conversion uses `node tools/dev.mjs package-declared
request.json module.elf new-output-directory`; see [declared packaging](declared-elf-packaging.md)
for the request and independent receipt. Existing `package-elf` remains compatible.

## Original-service memory maintenance

Compiler-owned development adaptation now uses explicit inputs and a new output
directory, without modifying or locating an SDK/reference checkout:

```sh
node tools/dev.mjs bound-service path/to/original-compiler.wasm .build/bounded-service
node tools/dev.mjs test-memory path/to/original-compiler.wasm
node tools/dev.mjs test-memory # Actual adaptation explicitly skipped without input
```

The original must be 101196042 bytes with SHA-256
`bce6632512852bf86baf7ca7b6eddd07209c0c4e29ae3b2288ec27e69028887d`.
Only the defined-memory limits/section length change. The output must reproduce the
existing 101196044-byte service hash exactly, with a 4096-page maximum; all preceding
and following bytes are independently compared. The CLI writes `compiler-bounded.wasm`
and `memory-receipt.json` only to a new selected directory and refuses overwrite.
No compiler executes in this maintenance operation. This local derivative remains
unapproved for distribution; no service is committed or fetched.

Local retirement checks are recorded in [SDK retirement](sdk-retirement.md). Compiler
fast tests include identity rejection and source-export recreation, while actual
adaptation skips without the explicit original. Compiler real-runtime CI records
that availability separately using the same `test-memory` entry point.

## Service-free preparation integration

[Preparation hosting](service-free-preparation.md) documents the new worker/controller,
updated source-package identity, actual Node/browser and Swift wrapper checks.
`tools/dev.mjs test` covers this worker with no service; the browser entry tests
the default module worker. The SDK consumer also prepares using only bundled
source assets. No new maintenance setup or binary provisioning is required.
