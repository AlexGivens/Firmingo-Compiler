# Browser lifecycle and CI cleanup — 2026-10-12

The [initial Compiler run](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38337760417)
at `2f647f4cce38161adc69f8c488dcd48bc5f9cefd` failed in the Ubuntu web-host job
with `ENOTEMPTY` deleting `isolated-nLbwfA/Default`. The two contract jobs,
JSON/ELF mutation jobs and service-availability job passed. This was a failed
workflow, despite those separate successes.

The old runner treated Chromium's `exit` event as completed shutdown, sent
termination immediately after the close request, and removed the profile without
retrying transient directory writes. The revised runner tracks `close` (including
stdio closure), waits for orderly shutdown, and escalates through bounded TERM/KILL
of its dedicated process group. SIGINT/SIGTERM follows the same owned cleanup path.
It removes only its generated profile after confirmed closure, with five bounded
filesystem retries. Permanent cleanup failures remain errors; an original check
failure is retained alongside a cleanup failure. This addresses the observed race;
it does not certify every browser helper or filesystem.

## Local checks

Host: macOS arm64, Node 22.12.0, externally provisioned Chrome 154.0.8037.93.
The explicit local bounded service is 101196044 bytes, SHA-256
`3e2544acf7f88f6f1d5fbce34648df8eb96dfff47afa242a3e008bc8f86e2f33`.
No binary was committed or redistributed; resident bindings are synthetic, NEVER DEPLOY.

| Command | Observed result |
| --- | --- |
| `node --test tests/browser-lifecycle.test.mjs` | Five focused lifecycle cases pass: exit versus closure, staged termination, closed protocol/spawn failure, retained profile on unconfirmed closure, owned profile removal |
| `node tools/dev.mjs test` | 99 pass, one optional actual-memory adaptation case skips |
| `node tools/dev.mjs check` | Syntax, fixture, recipe and vendor checks pass |
| `node tools/dev.mjs test-web` | Three pass, six compiler cases skip, zero actual compiler passes; cleanup succeeds |
| `node tools/dev.mjs test-web .build/memory-maintenance-verification/compiler-bounded.wasm` | Nine pass, including six real-compiler cases; cleanup succeeds |
| Controlled developer interruption after the owned browser's DevTools endpoint appears | Operation rejects, the generated profile is removed, and no success is returned |

The full suite includes the five focused cases. Logs are local ignored
`.build/browser-cleanup-*.log`; browser JSON results remain under `.build/logs/`.
The first extra interruption probe reached the browser startup deadline before
observing an active endpoint. It failed explicitly and removed its profile. The
subsequent real-service run passed all nine cases, and a controlled in-process
SIGINT probe then verified active-browser interruption. The startup failure's
cause is unqualified; this cleanup change does not claim to fix browser startup.
No screenshots or normal browser profile were used. Linux cleanup must also be
verified in the corrected GitHub run. No hardware or signed Apple-host execution
was performed in this change.

## GitHub verification

The correction will be pushed to trigger the same six independently observable
jobs. Run identity, exact results and service-absent browser/compiler counts will
be recorded after inspection. A green availability job does not establish actual
WASM compilation when service cases skip.
