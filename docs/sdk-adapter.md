# FirmingoKit adapter and source package

Implemented locally on 2026-10-12. FirmingoKit's two `ManagedSketchCompiler.build`
overloads now delegate raw captured source to this compiler for preprocessing,
WASM compilation/linking, ELF validation and FMS1 packaging. Swift retains resource
verification, WebKit hosting, independent capsule/report checks, native receipts,
physical associations and all deployment safeguards. No firmware wire change occurs.

## Package boundary

`node tools/dev.mjs export-web <new-directory>` produces a deterministic source-only
web package: `compiler.js`, `worker.js`, `resources.json`, both WASI shim notices,
`Firmingo-Compiler-LICENSE`, `sources.json` and `manifest.json`. The manifest declares
interface one, service ABI two, development package version, exact recipe/service
identities, and every file/source size and SHA-256. It contains no WASM service.
The source archive includes the exact modules, recipe, vendor inventory/notices and
maintenance inputs used to recreate the export. The fast test recreates the entire
package from those sources and compares every output byte independently.

The narrow maintenance bundler rejects unsupported module syntax, external imports,
cycles and excessive modules/bytes. It produces classic-worker assets for embedded
origins; the standard ES-module worker remains the normal browser entry point.
The export manifest SHA-256 is
`508216d85611a7bb0b604a09ae642cd9050b1d5a14abb7190d6db1543eb519d5`.
This identifies current development bytes, not a published/signed release or a
reproducible build of the unresolved compiler-service binary.

The SDK's `stage-sdk-runtime.mjs <explicit-export> <trusted-manifest-sha256>` verifies
bounded files before importing this package and adding its own WebKit bridge. Normal
Swift builds use committed resources and compiled-in anchors. Neither consumer
compilation nor ordinary tests look up a sibling compiler checkout, run Node or
build compiler assets. SDK runtime manifest:
`87c364e7091698480c3cabcc7b44c2ccc2ea46fe9221a9349c44eae614937074`;
eight-role inventory:
`45400194b577dd903a407ab9cc21a5ab905ee3fac146f622c7b8c1e714492ba5`.
The SDK keeps its empty catalogue and pending service approval. Existing standalone
SDK developer compiler tools remain labeled migration references; the SDK build
facade executes this package.

## Compatibility

Offline requests preserve the full schema-one descriptor and its content ID. The
legacy API has fewer static facts: it supplies an explicit nine-field
`target.residentBinding`, never a fabricated firmware version/commit/report or
physical device ID. This alternative records `residentBindingID` in place of
`firmwareBuildID` in the new compiler receipt. The full-descriptor request and its
goldens remain unchanged. See [interface](interface.md) for the exact fields.

Swift maps document UUID and the complete UInt64 revision to an ASCII token. The
compiler preserves original UTF-8 source identity, normalizes its own translation
unit and returns correlated sequenced events. Opaque origins lacking Web Crypto use
the portable SHA-256 implementation imported unchanged from the pinned SDK's
`Tools/ManagedWASM/Sources/Digest.js`; padding/block vectors are checked against
Node's independent SHA-256. Web Crypto remains preferred when present.

Native validation checks receipt input hash, exact request/target/source/revision,
service/recipe/shim identities, transferred ELF/capsule hashes, report binding and
canonical base64 before exposing an artifact. The SDK keeps its existing legacy
and offline receipt schemas, translates only host provenance/report metadata, and
adds optional `compilerReceiptJSON` carrying the distinct compiler execution receipt.
Independent supplied-ELF packaging leaves this property nil. Historical saved
receipts/associations/journals are not rewritten. Runtime provenance hashes change
with the new package; first-line BOM columns now include the original three bytes.
SDK progress exposes verifying before preparing, and two compiling observations;
internal validating does not introduce a new public enum case.

The native host's 60-second deadline includes resource/page loading. It waits for
worker-disposal acknowledgment before releasing an active build, with a separate
bounded two-second cleanup watchdog. No result survives cancellation or timeout.

## Local evidence and remaining gates

On macOS arm64 with Xcode 27.0/Swift 6.4, nine actual private-WebKit tests pass,
including two known capsule outputs, both build overloads, syntax errors, busy,
cancellation/deadline/reentry, Unicode/BOM and UInt64.max, stale receipt and byte
substitution rejection. A separate SwiftPM consumer compiles the known Blink vector
from packaged SDK resources with an explicitly supplied service. Compiler fast
checks: 89 pass; actual Node/WASM: eight pass; Chrome: nine pass (six actual compiler
cases). SDK `swift test`: 154 reported, nine opt-in real-runtime cases skipped;
all nine pass in the separate explicit-service run. SDK iOS Simulator/device builds
and native DocC pass. Bounded JSON/ELF mutation passes 4000/5000 cases; absent-service
Node execution explicitly skips eight tests. Fixture integrity remains 34 unchanged files.

Logs are ignored under Compiler `.build/adapter-{contracts,check,real-runtime,chrome}.log`
and SDK `.build/adapter-{package-tests,webkit-final,consumer,ios-simulator,ios-device,docc}.log`.
No visible view, screenshots, hardware, upload or network device operation was used.
The SDK guide records exact rerun commands. CI definitions are not verified GitHub
runs; its manual Apple workflow needs a provisioned Xcode runner.

Signed sandbox/minimum-OS/physical iOS/iPadOS execution, actual resident exports,
service-source/distribution review and hardware deployment remain open. Public
Swift preprocessing/ELF conversion and historical standalone development tools are
compatibility paths awaiting deliberate retirement; independent deployment validators
stay in the SDK. No additional boards, arbitrary libraries or conventional Arduino
complete-image support is implied.

Subsequent [SDK retirement](sdk-retirement.md) removes its standalone Node/WASI copies and inactive ELF-only decoder, adds compiler-owned service maintenance and records current checks. Original adapter observations above remain historical evidence.
