# Owned Preview 1 runtime source evidence

Recorded 2026-10-13 on macOS 27 arm64. The selected native LLVM/Clang/LLD
22.1.8 bootstrap runs from the recorded x86_64 Homebrew installation. CMake
4.4.0, Ninja 1.13.2 and isolated Python 3.12.14 remain explicit bootstrap inputs.
These native tools and macOS are not rebuilt from source in this operation.

Two fresh `runtime-build build` operations (`runtime-source-h` and
`runtime-source-i`, four jobs each) start from the same reviewed input manifest
`54eec350dadbab4cb21ed0dfa0700f05a53c344775bb08a7bafc0a435fb91351`.
They independently snapshot 26,378 raw LLVM Git objects at
`ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`, 3,075 wasi-libc source files and
63 separately pinned WASI source files. The complete libc archive is 1,637,111
bytes/SHA `ea9827495c0f35bca3b3d0a953e854cac112c43bea3196b5a4f7f8fc4704b9a4`;
the WASI archive is 162,204 bytes/SHA
`fc78b28c2c06b64e0233544a65736fc5c515c5520365d6cf821408eadedaf367`.
Archive identities are checked before safe extraction. No reference worktree or
system installation is changed.

Each build completes 151 compiler-rt steps, 1,939 libc steps and 1,883 C++ steps.
Libc's upstream `check-symbols` target passes against its pinned expectations.
An actual target-Clang syntax probe discovers `atomic`, `vector` and `filesystem`
through the ordinary sysroot paths and requires libc++ ABI 2. No header-discovery
result is forced through a CMake cache override.

The observed-byte `runtime-build compare` command checks both completed receipts,
input files, inventories and every actual output file. Both builds produce
identical bytes for 2,049 sysroot files and 304 resource files, including all
30 archives/startup objects/shared libraries. Their complete output inventory SHA
is `6e0d3ce6f05e7a4bf969d83df4e1b9237b229f3d74ecf1fb07dd068e7b07fd46`.
This establishes repeat identity on the recorded host for the declared recipe;
it does not reproduce every Homebrew target or prove cross-host reproducibility.

The service integration input was captured from a separately verified review
copy of the earlier source-built runtime plus its zero-byte generic C++ directory
marker. Every file was copied with source-receipt hash checks; an actual header
probe passed. The final fresh runtime builds above reproduce that entire review
inventory exactly. An independent path/length/hash comparison confirms that all
2,049 sysroot and 304 resource files captured for the service are identical to
those final fresh source outputs. The review copy is not represented as an
additional clean native compilation. Its recorded derivation and final input
match are retained alongside the build logs.

Early attempts remain failures, with their logs: the isolated libc build initially
needed explicitly selected `sed`; C++ configuration initially enabled LLVM's
unneeded test runner; its isolated Python generator initially lacked the pinned
source-local import; and the source subset initially lacked shared LLVM-libc
header utilities. Diagnostic continuations preserve separate logs and do not
turn failed receipts into clean builds. The first service configuration caught
Clang's missing generic libc++ version-discovery directory. The final maintenance
command preserves its `.keepme` marker and blocks success on actual header
compilation, covered by the focused regression fixture.

Recorded adaptations are explicit resource headers/Preview 1-only helper includes
in libc, and the source-local IWYU Python import in libc++. Full raw-source
inventories precede adaptations; before/after identities remain in each output.
The separately pinned WASI source is staged but the Rust generator is not run;
committed generated libc bindings are used. Native Clang builtin headers are
captured bootstrap inputs, not rebuilt Clang headers. CPU `lime1` applies to the
three runtime stages; this is the owned development recipe rather than a claim
of identical installed-component compilation flags.

Warnings remain in the logs: disabled native config loading can leave the driver
reporting `--no-default-config` unused; compiler-rt warns about its standalone
CMake package configuration; libc's optional shared libraries carry the upstream
unstable-shared-library warning; C++ CMake reports policy/unused reference flags.
No warning suppression is added to make this evidence pass. Dependency unit suites
are disabled; symbol/header checks and eventual service execution are distinct
checks, not exhaustive libc/C++ qualification.

[CI evidence](owned-service-ci.md) records all eight jobs passing at `7187362`
and `fa35579`. At the latter, each maintenance host passes nine original service
fixtures plus eleven runtime fixtures. Ordinary contracts pass 122 cases with
one optional-service skip; mutation jobs pass 4,000/5,000 cases. CI receives no
new service binary and explicitly skips unavailable compiler execution cases.

The fresh service build completes all 2,602 LLVM/Clang/ARM/LLD steps and links
all 96 archives against the verified source-built runtime. Every one of those
fresh archives is byte-identical to the prior clean service build's archive.
The new bounded reactor is 101,194,565 bytes, SHA
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`,
with 26 Preview 1 imports, 11 exact exports and ordinary memory minimum/maximum
384/4,096 pages. Static inspection does not instantiate the module.

The final native link is independently repeated from the verified source/runtime/
archive inputs with the canonical basename `compiler.wasm`, producing identical
module bytes. This is one fresh complete native service compilation plus a repeat
of its final link, not two full LLVM rebuilds against the new runtime. A diagnostic
trial using `compiler-repeat.wasm` differs only in the custom `name` section;
the pinned LLD source uses the output basename as its module name. The recipe's
fixed basename is therefore part of byte-repeat conditions. That diagnostic
comparison is retained rather than represented as an equal-byte pass.

`test-built-service` actually instantiates this explicitly anchored module in an
isolated Node 22.12.0 worker and runs production WASI, source preparation, Nano
recipe, ELF and capsule logic. GPIO/delay and binary console build successfully,
producing 316/392-byte capsules and using 27,983,872/28,049,408 bytes of linear
memory. Their ELF and capsule hashes match the previous compiler's outputs for
the same real CI resident binding. GPIO ELF/capsule bytes repeat exactly;
frontend error, mutable storage and unavailable `__aeabi_uidiv` cases reject
without artifacts, followed by a successful fresh GPIO build.

An independently rebuilt Apple Clang 21 native helper calls the actual Firmingo
`experiments/managed_sketch/image.cpp` at `d42613f`. It accepts both new capsules
with CI API `0x10022c9c` (`ImageError::ok`, 60/136 code bytes), and rejects both
with historical API `0x10022ca0` (`wrong_api`, enum 6). Neither Thumb payload is
executed. The static CI resident descriptor still belongs to `4d53a28`, not an
assertion that a connected board runs that image. Complete compact source,
receipt, module and validator identities are in [the JSON record](runtime-source-build.json).

The service receipt's raw input-capture field deliberately does not infer runtime
source provenance merely from file bytes. The separate clean runtime receipts
and explicit observed input matches above establish that association. Native
bootstrap and committed generated-binding limits remain as stated.

Distribution remains unresolved, including the custom service sources' license.
New assets are local development inputs. Consumer pins, SDK source package,
default catalogue and hardware claims do not change. Broader WASI targets,
generated-binding reproduction, native bootstrap source builds and new-asset
browser/WebKit/package promotion remain separate work.
