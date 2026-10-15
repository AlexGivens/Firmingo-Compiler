# Selected baseline and support status

## Current scoped qualification — 2026-10-15

The reviewed reproduced service `a7648688…`, experimental consumer package
`1bbc0cc1…`, legacy Firmware `e0a79d1…` and descriptor `c44d25ef…` supersede the starting
binary/source facts below for the prepared Nano consumer. See
[the current qualification record](release-qualification.md) and its linked
Compiler/FirmingoKit evidence for full identities and limitations.

| Combination | Current scoped result |
| --- | --- |
| Prepared SDK compiler hosting | Signed macOS 27.0 and recorded physical iPadOS 27.0.1/iOS 27.0 hosts pass actual compilation and separate cancellation/deadline/reentry checks; minimum OS and aggregate memory remain open |
| Nano / iPadOS 27.0.1 / signed Nano host build 3 | Two known WASM capsules independently validated, RAM-staged and committed through SDK with fresh boot-confirmed status; exact 256-byte console echo and manual D13 off-to-on transition pass; earlier failed attempts retained |
| Nano / iOS 27.0 / identical signed Nano host build 3 | Equivalent console/GPIO stage/commit/startup, exact echo and manual LED transition pass; initial permission-prompt Network-is-down failure and explicit retry retained |
| Explicit FMS2 Nano / iPadOS 27.0.1 / signed NanoStateful build 1 | Two actual WASM state/echo sketches, target-2 uploads in the same boot, correct initialized data/zero startup BSS/advancing state, two exact echoes and state after manual RESET pass; [exact evidence and limits](stateful-adoption.md#selected-nanoipad-hardware-result) |
| Explicit FMS2 Nano / iOS 27.0 / identical signed NanoStateful build 1 | Equivalent independent two-sketch same-boot upload/state/echo and manual-reset pass; [separate record and limits](stateful-adoption.md#iphone-follow-through) |
| Pico / additional boards / broader libraries / conventional Arduino images | No added recipe or hardware support |
| Consumer delivery | Explicit anchored local provisioning with paired source/notices; no hosted binary release or automatic downloader |

The inventory and matrix below preserve the **2026-10-12 starting snapshot**.
Their unresolved review/host/device statements describe that historical stage;
they must not override current promotion or scoped qualification evidence.

Selected 2026-10-12. [baseline.json](baseline.json) records exact reference paths,
sizes/hashes and service identities. Its 24 source/resource records match the
earlier migration inventory. Source commits are Firmingo
`f17fdf0301256ba48270230cbf213126e70aa8d0` and FirmingoKit
`05cae8fa8e58c706eceb6a15812d7ca500375d7b`; working differences are the documented
repository refocus, outside selected executable inputs. ArduinoKit
`0eb3cd1841147dfc7ea25bf076545e38b01601e4` remains a clean read-only reference.

## Contract selection

The selected experimental Nano application resident uses ABI one and FMS1 images
at slot `0x10200000`, code offset 256, 64-byte header and code at `0x10200100`.
Its advertised upload maximum is 4096 bytes; the selected stateless Clang recipe
limits code to 3840 bytes. The firmware image header/linker describes a larger
4-MiB slot; that does not override the current upload/recipe limits. Writable
module state, initializers, arbitrary libraries, runtime helpers, and nonreturning
setup/loop are outside the existing constrained proof. Firmware remains authoritative
for behavior and layout; source validation alone cannot prove execution returns.

The existing recipe is `nano-stateless-clang-22.1.8-v1-experimental`, with manifest
SHA-256 `b7869f6fc863e1905deb6974408c6e7dc63943a1fb3e342a357fdf757b1e23d9`, ARMv6-M,
Cortex-M0+, Thumb, AAPCS base/soft float, freestanding GNU C++17, no sysroot or
external libraries. The manifest and four recipe assets are now imported unchanged under
`recipes/nano_rp2040_connect/` and verified by production logic; execution now uses the pinned explicit local service. Fixed compile/compile/link jobs are constructed after
portable source preparation.

## Service/dependency inventory and unresolved work

| Component | Inventory and status |
| --- | --- |
| Original Clang/LLD 22.1.8 WASI service ABI two | 101196042 bytes; SHA-256 in baseline; read-only SDK development copy reverified |
| Memory-bounded service derivative | 101196044 bytes; hard 256-MiB defined-memory maximum from existing adaptation; verified and executed in local Node/WASI tests |
| Custom service source/build | Read-only ArduinoKit service source/build script exists and expects patched LLVM 22.1.8 and a compatible WASI SDK/build tree; no tracked top-level license was found; complete source/patch/toolchain/component and distribution review remains open |
| Browser WASI shim | `@bjorn3/browser_wasi_shim` 0.4.2, existing SDK selects MIT with both notices and hash receipt; npm archive identity is recorded but not independently reacquired; unmodified files/notices/receipt now vendored and verified |
| This foundation | Independently authored JavaScript; Node 22.12.0/node:test for developer checks; vendored WASI shim; no external package installation |
| Parser fixture | One unchanged synthetic SDK descriptor plus independently authored request; never real firmware metadata or deployable content |

Read-only binary hash checks are not reproducible service builds or redistribution
clearance. No service, sysroot, source from ArduinoKit, native compiler, or firmware
image was copied or bundled. Resolve source/license/build evidence in M7; explicit
local-service integration is implemented independently of distribution review. A repository
license does not settle third-party distribution rights.

No trusted exact resident export is selected for deployment. The existing firmware
contract ZIP has documentation/parser vectors, not the complete build facts needed
for a production descriptor. Keep real production selections unavailable until
such facts are verified; schema validation of synthetic hashes proves no build.

## Historical initial evidence matrix

| Target/operation | Status in this repository |
| --- | --- |
| Nano request/descriptor validation and identity | Implemented; synthetic golden/error/boundary tests |
| Preprocessing and source diagnostics | Implemented; independent normalization/hash and lexical regression vectors |
| Independent ELF/FMS1 packaging and receipt | Implemented; exact firmware capsule and independent Python report/receipt goldens |
| WASM compile/link | Implemented; eight actual local-service tests, including failure/disposal and clean reentry |
| CLI | Inspection/validation, explicit source preparation and independent ELF packaging; explicit pinned-service compilation; no device operation |
| Standard browser module workers | Nine cases pass in headless Chrome 154.0.8037.93/macOS arm64/HTTP loopback; other browsers unqualified |
| Native/Swift/WebKit wrappers | Nine actual private macOS WebKit tests pass; physical iOS/iPadOS and signed sandbox remain unqualified |
| FirmingoKit adapter and persisted-receipt compatibility | Both build APIs consume the shared package; legacy/offline receipt schemas retained, runtime provenance changes explicitly |
| Nano hardware execution/deployment | Unqualified; no device operation performed |
| Pico or broader boards/libraries | Unsupported by current validation; deferred explicit recipes |
| Conventional Arduino firmware | Secondary/deferred; no recipe/output/programming support added |
| Packaged service/production catalogue | Unavailable pending exact-build facts and service review |

There is no selected consumer OS support matrix yet; wrappers provide the web host.
Local macOS Node checks establish the portable structural and actual WASM path. CI defines the
same checks on macOS/Ubuntu, with separate JSON/ELF mutation and service-availability jobs; a GitHub run has
not been verified. Actual-service CI has seven explicit skips pending approved assets;
no CI recipe build or hardware support is claimed. Browser evidence is limited to
the recorded Chrome host; see [browser checks](evidence/web-host.md). See [runtime evidence](evidence/wasm-runtime.md).
