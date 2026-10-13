# Provenance/import CI verification

On 2026-10-13, inspected all six jobs and their logs for
[Compiler run 38378073696](https://github.com/AlexGivens/Firmingo-Compiler/actions/runs/38378073696)
at commit `54c18039c1a200e193ced22cf9342f8b296bdef6`.

| Job | Observed result |
| --- | --- |
| Contracts, Ubuntu 24.04 | 117 passed, 0 failed, 1 optional-service skip (118 total), including four provenance-audit and five resident-import tests |
| Contracts, macOS 14 | Same 117/0/1 result |
| JSON mutation | 4,000 passed, seed 1179469647; 772 valid JSON inputs |
| ELF mutation | 5,000 passed, seed 1162626609; 486 valid layouts |
| Real runtime availability | 8 actual-service cases skipped, 0 compilation passes; memory maintenance 1 service-free pass and 1 actual-service skip |
| Web host | Chrome 154.0.8037.97, 3 passed, 6 actual-service cases skipped, 0 compiler passes |

All job conclusions are success. The contract jobs retain explicit source-free
fixtures, and the browser log confirms isolated preparation/declared-packaging
workers, unpinned-service rejection and CSP. No unreviewed service binary was
provided to public CI. Actual compilation against imported real resident facts
was exercised locally, with two independent firmware-validator passes; see
[resident validation](resident-validation.json).

Workflow YAML parsed locally; actionlint was unavailable. Bash/pipefail and log
artifacts remain enabled. This CI result does not establish distribution approval,
full service reproduction or hardware behavior.

The corresponding [firmware run 38378075416](https://github.com/AlexGivens/Firmingo/actions/runs/38378075416)
at `4d53a285a3a39d4355253760a205fdac1a6b811c` also completed all ten jobs
successfully. Logs confirm 20 sanitizer-native tests, 191 host tests, four bounded
mutation tests, seven pinned board/profile builds and the maintained experimental
resident/four native modules/two composites/contract archive. Existing vendor
compiler warnings remain in retained logs; no hardware was contacted.

The experimental job produced a schema-1 resident export with manifest SHA-256
`3109c3e97c95f07c39d50fc1591dab8b8cc44022fde5aa71c7602e5a7974a78e`.
Downloaded only its named retained artifact into ignored local outputs and
imported using that independent CI-log anchor. The freshly compiled resident's
actual API is `0x10022c9c`, four bytes below the historical resident's address;
152,840 initialized ELF flash bytes matched its UF2. This demonstrates why the
export derives the API instead of hardcoding the historical binding.

Both supported sketches compiled locally against the imported CI descriptor and
passed the actual production firmware validator with the new API address. Using
the historical address correctly rejected the GPIO capsule as `wrong_api`.
[Exact CI resident inputs, receipts and capsule identities](ci-resident-validation.json)
record the two additional builds. This local use of a CI-built resident is not
compiler-service provisioning in CI, a reproducible-byte claim across native
build environments, or hardware qualification.
