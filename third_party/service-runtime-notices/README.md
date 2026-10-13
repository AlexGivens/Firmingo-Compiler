# Service runtime notice review materials

`wasi-libc32/` preserves eight unchanged upstream license/copyright files from the
verified `wasi-sdk-32` source archive. Its manifest records source URL, archive
identity and every copied file's byte count/hash. These are dependency review
materials, not an executable package or redistribution approval.

The top-level upstream notice lists Apache-2.0, Apache-2.0 with LLVM exceptions,
MIT, and separate allocator/cloudlibc/musl/musl-fts terms. Preserve the original
texts and their attribution. Allocator file-specific notices remain in the pinned
source archive and have reference hashes; the collected top-level/subdirectory
files do not establish complete notice closure for a future binary.

An unchanged six-line dlmalloc attribution/public-domain declaration excerpt is
also retained, with source-file hash and exact line range. The installed libc
archive contains a `dlmalloc.c.obj` member; that observed name does not itself
establish source reproduction or complete notices for the eventual binary.

No dependency code or binary is copied here. These records do not reproduce the
installed wasi-libc/runtimes from source or resolve the custom compiler-service
source license selection. The repository's GPL license does not replace these
upstream notices. See `docs/service-build.md` for the separate build-input scope.
