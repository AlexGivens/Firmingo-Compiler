# Portable interface — version one draft

Status: build inputs, portable stages and the isolated real WASM lifecycle are
implemented. Local Node/WASI and standard Chrome/HTTP-loopback module-worker
execution and the macOS FirmingoKit adapter are evidenced; other web hosts, service distribution
and hardware remain unqualified. See [SDK adapter](sdk-adapter.md). Version one is not
publicly frozen. See [runtime](runtime.md) and [portable pipeline](portable-pipeline.md)
for stage-specific APIs, bounds and receipt semantics.

## Hosting and implemented exports

Import `src/index.js` as a standard ES module. Production modules have no Node,
Swift, WebKit, filesystem or network dependency. Execution uses the pinned, vendored WASI shim. They require
`TextEncoder` and fatal UTF-8 `TextDecoder`; identity functions prefer Web Crypto SHA-256 and use
a local portable SHA-256 implementation when it is absent, including opaque embedded origins. CLI hosting is a
development adapter. See [web-host evidence](evidence/web-host.md) for the tested
Chrome environment and [SDK adapter](sdk-adapter.md) for macOS WebKit; other browsers and wrapper sandboxes remain unqualified.

| Export | Behavior |
| --- | --- |
| `validateBuildRequest(object)` | Validate closed data fields and return a deeply frozen copy; does not preprocess, execute, or authorize deployment |
| `parseBuildRequest(jsonText)` | Apply bounded duplicate-aware JSON parsing, then build validation |
| `validateCancelRequest(object)` | Validate correlation fields only; does not terminate a runtime |
| `validateFirmwareBuildDescriptor(object)` | Validate the pinned Nano schema-one declarations and return a frozen copy |
| `requestIdentity(request)` | Asynchronous SHA-256 of the exact validated canonical request |
| `validateResidentBinding(object)`, `residentBindingIdentity(binding)` | Closed legacy static requirements and distinct identity, without invented firmware facts or device ID |
| `firmwareBuildIdentity(descriptor)` | Asynchronous content ID compatible with the existing SDK descriptor schema |
| `parseContractJSON(jsonText)` | Bounded JSON with duplicate-key rejection and safe-integer numeric values |
| `ContractError`, `LIMITS`, `NANO_BASELINE` | Structured input error and immutable reviewed constants |
| `prepareSketch`, `originalSourceLocation` | Constrained source preparation and physical generated-file location mapping |
| `parseELF`, `validateCapsule`, `packageELF` | Structural validation and independent packaging; no compiler execution |
| `verifyNanoRecipe`, `createNanoJobs` | Pinned recipe integrity and fixed job construction; no service execution |
| `PipelineError` | Typed preprocessing/runtime/validation/packaging failure with bounded diagnostics |
| `PreparationController` | Service-free isolated preparation with request deadlines, cancellation/disposal and parent output comparison; see [hosting](service-free-preparation.md) |
| `CompilerController` | One active build; default web worker or explicit trusted host worker adapter |
| `validateRuntimeEvent` | Synchronous bounded public event structure check; not cryptographic trust or ordering |
| `serializeRuntimeEvent`, `parseRuntimeEvent` | Bounded JSON event encoding with canonical base64 capsule bytes |

Object calls accept plain data objects (including null-prototype objects), never
arrays, class instances, accessors, symbols, or ignored additive fields. A local
caller should not supply Proxy objects or executable objects. Use the JSON entry
point for external serialized input; native `JSON.parse` alone would lose duplicate
fields before validation. Validation snapshots caller data before asynchronous
hashing so later source edits cannot alter its identity.

## Build input

`schemas/build-request.schema.json` describes the closed shape. Every field is
required; there is no automatic target/latest selection, library discovery,
arbitrary compiler flag, device identity, or upload permission.

```json
{
  "interfaceVersion": 1,
  "kind": "build",
  "buildID": "document-7:build-4",
  "source": {
    "filename": "Blink.ino",
    "revision": "document-7:revision-12",
    "text": "void setup() {}\nvoid loop() {}\n"
  },
  "target": {
    "board": "nano_rp2040_connect",
    "profile": "nano-managed-v1",
    "recipeIdentifier": "nano-stateless-clang-22.1.8-v1-experimental",
    "recipeSHA256": "b7869f6fc863e1905deb6974408c6e7dc63943a1fb3e342a357fdf757b1e23d9",
    "firmwareBuild": "REPLACE WITH A VERIFIED SCHEMA-ONE DESCRIPTOR OBJECT"
  },
  "options": { "deadlineMilliseconds": 60000 }
}
```

The placeholder makes this abbreviated example intentionally invalid. The complete
[test request](../tests/fixtures/synthetic-build-request.json) has a structurally
valid **synthetic, NEVER DEPLOY** descriptor and independent identity expectations;
it is not a production build selection. A real descriptor must come from verified
firmware build evidence paired with a compatible compiler recipe.

Build/revision tokens are 1–128 ASCII characters matching
`[A-Za-z0-9][A-Za-z0-9._:-]*`; the wrapper maps its own document/revision models to
them. A source filename is an ASCII `.ino` leaf, 1–96 bytes, beginning with an
alphanumeric or underscore, followed by alphanumerics, underscore, dot, space or
hyphen. Double dots, paths, hidden filenames, directives and control bytes fail.

Source is a nonempty UTF-8 string of Unicode scalar values, at most 262144 bytes,
with no NUL. Validation preserves BOM, CR/LF, non-ASCII characters, and source order;
preprocessing produces separately identified generated source. Input validation
does not enforce preprocessing/C++/API restrictions; call `prepareSketch` for the
implemented lexical policy and actual compilation for C++ checking.

All numeric input values are safe integers. Serialized numbers must use decimal
integer literals, without fractional or exponent notation; reject them before
floating-point conversion could round a version/address into an accepted integer.
Deadlines are explicit 1–60000 ms;
the runtime enforces the admitted deadline through worker termination and final validation. External JSON is
at most 2097152 UTF-8 bytes, depth eight with root at zero, and 4096 tokens (each
value and object key consumes one). Reject malformed JSON, duplicate decoded keys,
unsafe/fractional numbers and non-JSON whitespace. UTF-8 decoding belongs to the
wrapper before parsing; the CLI uses strict decoding and a bounded file reader.

The schema's `x-maximumUtf8Bytes` and `x-requireUnicodeScalars` are annotations;
generic JSON Schema character limits do not enforce those byte/scalar policies.
Production validators also enforce the bounds above and reject accessors.

## Static descriptor and identities

Keep the existing SDK's 16-field schema-one descriptor: `schema`, `board`, `profile`,
`backend`, `firmwareVersion`, `firmwareCommit`, `residentELFSHA256`,
`firmwareImageSHA256`, `buildReportSHA256`, `apiAddress`, `residentABI`, `targetID`,
`maximumCapsuleBytes`, `recipeIdentifier`, `recipeSHA256`, and `qualification`.
The initial selection is Nano/application, resident ABI one, target one, maximum
4096-byte capsule, the exact pinned recipe/digest, and experimental qualification.

Firmware version is 1–64 ASCII alphanumerics/dots/underscores/hyphens. Commit is 40
lowercase hex characters; digests are 64. API address is four-byte aligned within
`0x10000000`–`0x101ffffc`. No address or hash is inferred from hello or provided as
a production default. Source core/facade/layout authority stays in Firmingo.

Canonical identity is UTF-8 SHA-256 of compact JSON with recursively sorted ASCII
field names, no extra whitespace, ordinary JSON string escaping and decimal safe
integers. The descriptor's ASCII scalar fields preserve the SDK's identity exactly.
The request identity includes build correlation, original source/revision, exact
descriptor/recipe fields and deadline. It is an **input identity**, not a receipt
that a compiler ran or proof of source-to-code correspondence. Wire whitespace or
field ordering changes neither identity; changing source/revision or any included
field does. No cache or automatic reuse/retry is implemented.

The target must select exactly one of `firmwareBuild` or `residentBinding`. The
legacy static binding has nine required fields: `schema`, `board`, `profile`,
`residentELFSHA256`, `firmwareImageSHA256`, `apiAddress`, `residentABI`, `targetID`,
`maximumCapsuleBytes`, using the same reviewed Nano constraints. It accepts no
version, commit, build-report or device fields. Its canonical content hash appears
as `residentBindingID` in place of `firmwareBuildID`, and artifacts carry
`residentBinding` in place of `firmwareBuild`. This explicit alternative supports
older wrapper APIs without inventing evidence; it is not a production descriptor.

## Runtime admission, cancellation and events

`new CompilerController().build(request, resources, {signal,onEvent})` returns a
Promise of a validated artifact or throws `PipelineError`. Resource bytes and host
requirements are specified in [runtime.md](runtime.md). Request/options validation
occurs first. Invalid inputs or an overlapping request are not admitted and emit no
events; overlap rejects with `busy`. Every admitted build, including pre-aborted or
invalid-resource cases, emits exactly one terminal event. There is no queue/retry.

`compiler.cancel({interfaceVersion:1,kind:"cancel",buildID:"build-4"})` validates
[the cancel shape](../schemas/cancel-request.schema.json), then returns true only
when it selects a still-active build for cancellation. Unknown/stale/settled IDs
return false without affecting another request. An optional native AbortSignal has
the same effect. A cancel return does not mean disposal completed: wait for the
terminal event/promise. Deadline and cancellation terminate synchronous worker work,
discard artifacts and allow a fresh build after termination. Observer callback
exceptions are isolated and do not change compiler outcomes.

Events use `interfaceVersion`, `kind`, `buildID` and positive safe-integer `sequence`,
starting at one and increasing by one for each admitted build. No event follows a
terminal result. Progress follows verifying, preprocessing, compiling (twice),
linking, validating and packaging; failures may stop a prefix. Diagnostics precede
the terminal event and carry their actual compiler stage. Each is bounded to 4096
UTF-8 message bytes, 256 filename bytes, 128 records/build, with explicit nulls for
unknown positions. Locations are one-based original lines and UTF-8 byte columns.

```json
{"interfaceVersion":1,"kind":"progress","buildID":"build-4","sequence":1,"phase":"verifying"}
{"interfaceVersion":1,"kind":"diagnostic","buildID":"build-4","sequence":4,"diagnostic":{"severity":"error","stage":"compiling","code":"compiler_diagnostic","message":"use of undeclared identifier 'missingFunction'","filename":"Sketch.ino","line":1,"column":16}}
{"interfaceVersion":1,"kind":"result","buildID":"build-4","sequence":5,"outcome":"failed","error":{"code":"compile_failed","stage":"compiling","message":"Compiler service rejected the sketch"}}
```

The diagnostic example follows three progress events. Terminal `outcome` is
`succeeded`, `failed`, `cancelled` or `timed_out`; failure contains only `error`,
success contains only `artifact`. [runtime-event.schema.json](../schemas/runtime-event.schema.json)
describes serialized events. Module calls use artifact `bytes: Uint8Array`;
`serializeRuntimeEvent` uses canonical padded RFC 4648 base64 in that same field.
`parseRuntimeEvent` bounds decoding and rejects duplicate keys/noncanonical padding.
Receipt `capsuleBytes` supplies the decoded size. The synchronous event validator
checks structure/correlation only; consumers of external events must enforce
sequence/terminal ordering, verify bytes/digests with the selected firmware descriptor,
and apply their own trusted-host/deployment policy.

## Actual artifacts and receipts

Success returns `{format,filename,bytes,sha256,reportJSON,receipt,firmwareBuild,
linkedELF,diagnostics,timings,memoryBytes}`. `bytes`/`linkedELF` getters return copies;
metadata is frozen. The success event's `artifact` carries only
`{format,filename,bytes,sha256,reportJSON,receipt}`. No result authorizes deployment
or executes microcontroller code in the host. Failed/cancelled/timed-out builds
return no artifact.

[build-receipt.schema.json](../schemas/build-receipt.schema.json) defines
`firmingo-compiler-build-v1`, operation `wasm_compile_link_package`, provenance status
`pinned_assets_executed`. It covers original/generated source/revision, exact request
and firmware descriptor, service/recipe/shim/toolchain assets, ELF and capsule.
Input hashes exclude only themselves and explicit output hashes/count; timings
are observations outside the receipt. [Runtime documentation](runtime.md) defines
the complete hash convention and limits. Hash verification establishes asset identity
and trusted-host execution association, not publisher approval or attestation.

Independent `packageELF` retains its separate `firmingo-compiler-packaging-v1`
receipt with declared provenance. The conservative packaging report remains compatible
in field vocabulary. Existing SDK legacy/offline receipts and persistence formats
remain unchanged in schema through the [tested SDK adapter](sdk-adapter.md); neither new receipt
should be silently deserialized as an old SDK receipt.

## Implemented errors and compatibility

`ContractError` carries `code`, `path` (for example `$.source.text`), and `message`.
Current codes are `invalid_input`, `unsupported_version`, `unsupported_target`,
`invalid_json`, `duplicate_key`, and `input_limit`. These are
validation/hosting failures, not successful builds or device outcomes. Error messages
do not echo source. Unknown versions/fields/recipes fail without side effects.

This increment has no firmware wire or SDK API change. Inputs retain existing descriptor identity;
the new request envelope is a compiler boundary with an implemented macOS SDK adapter. Pin contract versions and review compatibility before changing
closed fields, recipes, serialization, hashing or eventual receipts. Metadata
integrity establishes declarations only; deployment validation/authorization and
device associations stay in wrappers.

Runtime error codes include `busy`, `cancelled`, `timed_out`, `invalid_resources`,
`invalid_recipe`, `invalid_service`, `compile_failed`, `link_failed`, `invalid_response`,
`worker_exited`, `runtime_failed`, `cleanup_failed`, plus the portable pipeline codes.
Input errors occur before admission; admitted failures have a phase and terminal event.
