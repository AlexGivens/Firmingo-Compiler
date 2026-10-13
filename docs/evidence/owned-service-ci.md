# Owned service maintenance CI verification

On 2026-10-13, inspected all eight jobs and their logs for
[run 38395005566](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38395005566)
at `04aaed0824f133cc4885223ea034a268dec3f2ce`. Every job concluded success.

| Job | Actual observed checks |
| --- | --- |
| Contracts, Ubuntu 24.04 | 122 passed, 0 failed, 1 optional-service skip (123 total) |
| Contracts, macOS 14 | Same 122/0/1 |
| Service maintenance, Ubuntu/Python 3.12.14 | 9 owned synthetic source/tool/closure/failure/repeat tests passed |
| Service maintenance, macOS/Python 3.12.10 | Same 9 passed; fixture host only |
| JSON mutation | 4,000 passed, seed 1179469647; 772 valid JSON inputs |
| ELF mutation | 5,000 passed, seed 1162626609; 486 valid layouts |
| Real runtime availability | 8 service-dependent tests skipped, 0 compilation passes; memory maintenance 1 service-free pass/1 real-service skip |
| Web host | Chrome 154.0.8037.97; 3 passed, 6 actual-service checks skipped, 0 compiler passes |

The retained browser artifact records `/usr/bin/google-chrome` resolving to
`/opt/google/chrome/google-chrome`, readiness at 508.109 ms and first output at
305.088 ms under the bounded 30-second startup policy. Local Chrome
154.0.8037.93 also passed 3/0/6 with readiness at 807.958 ms. Both are
service-absent checks; new source-built service execution is separately recorded
in [local source-build evidence](owned-service-build.md).

Earlier [run 38392868651](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38392868651)
at `d365277` failed macOS Python setup because no Darwin 3.12.14 package exists,
and failed the browser's previous 12-second startup deadline. The subsequent
[run 38393691363](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38393691363)
at `1c08d7a` passes maintenance fixtures on both platforms after deliberately
selecting available macOS Python 3.12.10, but again fails browser startup.
Neither run is presented as a pass.

The browser readiness helper now watches both output streams, records timing,
executable selection and bounded diagnostics, and waits up to 30 seconds for the
actual DevTools event. It adds no automatic retry or unconditional delay; timeout,
early exit and launch error remain failures with cleanup regression coverage.
The passing run's startup is within the old budget too, so this does not establish
the precise cause of the earlier cold-start failures or prove that budget alone
fixed them. Keep subsequent startup evidence observable.

No source/compiler dependency pin was silently upgraded: local native builds
remain Python 3.12.14/LLVM 22.1.8/CMake 4.4.0/Ninja 1.13.2/Node 22.12.0. macOS CI's
older Python is an explicit fixture-host choice backed by the official
[Actions package inventory](https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json),
not an asset-source reproduction claim. Public CI receives no unreviewed service
binary and performs no device operation.

Workflow YAML parsed locally; actionlint was unavailable. First-commit diff
checks report the original upstream license/excerpt files' terminal blank lines;
these bytes intentionally remain unchanged and receipt-verified. Project-code
and subsequent diffs pass whitespace checks. Native driver/CMake warnings and
the earlier failed CI logs are preserved; none are rewritten as successful checks.
