# Candidate service upstream notice review

The review applies to LLVM/Clang/LLD 22.1.8 at
`ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`, wasi-libc `wasi-sdk-32` and WASI
header-generation input `59cbe140561db52fc505555e859de884e0ee7f00`.
The original service contributions and thirteen local patches use the author's
GPL-3.0-only grant. The source package keeps all upstream terms and file headers;
it does not relabel the upstream tree as GPL-only.

| Component | Retained terms and credits | Package location |
| --- | --- | --- |
| LLVM/Clang/LLD and runtime sources | Apache 2.0 with LLVM exceptions and legacy University of Illinois/NCSA notices | `upstream/llvm/source/LICENSE.TXT`, component licenses and source headers |
| LLVM BLAKE3 | CC0 1.0 or Apache 2.0; both upstream texts retained | `upstream/llvm/source/llvm/lib/Support/BLAKE3/LICENSE` |
| LLVM regex | Henry Spencer's notice and modified-code attribution requirements; Regents of the University of California BSD terms | `upstream/llvm/source/llvm/lib/Support/COPYRIGHT.regex` and regex source headers |
| LLVM xxHash | Yann Collet BSD 2-Clause notices with attribution and disclaimer | `upstream/llvm/source/llvm/lib/Support/xxhash.cpp` and `llvm/include/llvm/Support/xxhash.h` |
| LLVM Unicode conversion | Unicode, Inc. copyright, permission, disclaimer and modification notices in addition to LLVM terms | `upstream/llvm/source/llvm/lib/Support/ConvertUTF.cpp` and associated header |
| LLVM MD5 implementation | Alexander Peslyak public-domain declaration and fallback permissive terms; the source explicitly states its independent implementation | `upstream/llvm/source/llvm/lib/Support/MD5.cpp` |
| wasi-libc and WASI generation sources | Upstream Apache/LLVM-exception, Apache 2.0, MIT and component-specific terms | `upstream/libc/LICENSE*`, `upstream/wasiHeaders/LICENSE*`, nested notice files and source headers |
| cloudlibc and musl-fts | BSD 2-Clause and BSD 3-Clause respectively | `upstream/libc/libc-bottom-half/cloudlibc/LICENSE`, `upstream/libc/fts/musl-fts/COPYING` |
| musl | Rich Felker et al. MIT text, contributor credits and listed file-specific exceptions | `upstream/libc/libc-top-half/musl/COPYRIGHT` and individual source headers |
| allocators | Doug Lea dlmalloc public-domain/CC0 declaration; emmalloc MIT header retained whether or not selected | `upstream/libc/dlmalloc/src/malloc.c`, `upstream/libc/emmalloc/emmalloc.c` |
| LLVM source-only third-party tests/helpers | Original Boost, benchmark and googletest/googlemock notices; inclusion in source does not imply linkage | `upstream/llvm/source/third-party/` |

The completed build's `link-inputs.json` records all 96 LLVM archives. Build
recipes disable compression libraries, libxml2, curl, HTTP, terminfo, libedit,
libpfm, bindings, tests and benchmarks. Disabled options alone do not prove a
file's absence from the linked module; the remaining audit must reconcile
compiled object/header and link identities, including inlined or generated code.
The candidate source package includes all selected source files and an inventory
of every file whose basename starts with LICENSE, COPYING, COPYRIGHT or NOTICE.
That inventory is a completeness check for named notice files, not a substitute
for file-header review or retained binary documentation.

Before distributing the exact candidate service, finish the linked-file review,
collect the required license/credit text in its binary delivery materials and
pair the reviewed complete source archive with that binary. The proposed download
method is adjacent, equally accessible source/object downloads under
[GPLv3 section 6(d)](https://www.gnu.org/licenses/gpl-3.0.html); no release is
created by this maintenance step. The source package's preserved modified-source
patches and adaptation scripts must accompany any original-code grant.

General-purpose native tools and system libraries are documented as bootstrap
prerequisites rather than redistributed native binaries. GPLv3 section 1
distinguishes those inputs from source that is part of the work; the WASI runtime
linked into this service is included, rather than treated as an OS library.
LLVM's [license policy](https://llvm.org/docs/DeveloperPolicy.html#copyright-license-and-patents)
requires attention to third-party/file-specific terms. The exact pinned source
bytes and local build identities determine this review, not moving defaults.
