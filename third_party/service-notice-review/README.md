# Candidate service notice review materials

These unchanged license texts and source-comment excerpts accompany review of
the local 101,194,565-byte development service, SHA-256
`a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493`.
They are not a compiler binary, a release or a completed distribution decision.

`LICENSES.txt` retains every named upstream notice/license file in the verified
source package, the original-contribution GPL grant, and the LLVM license.
`FILE-NOTICES.txt` retains selected comments from the observed LLVM archive and
WASI runtime compile inputs, including the internal musl MD5 crypt attribution
and libc++ floating-point conversion credits. All source terms remain intact.
The source package itself retains the full files and all original notices.

The selection deliberately includes runtime files and archive objects before
linker garbage collection. Presence here does not prove that the final module
contains every selected implementation. Some source-only licenses are retained
conservatively too. Automated marker searches support review; they cannot prove
that every file-specific obligation has been identified. Final rebuild dependency reconciliation and source/object delivery review
remain required.

`manifest.json` records whole-source hashes, exact excerpt byte offsets and line
ranges, the independently verified source archive, and the candidate identity.
Review these materials together with `docs/service-upstream-notices.md` and
`docs/evidence/packaged-service-rebuild.md`. Never infer binary permission from
this receipt alone or relabel upstream contributions with the author's GPL grant.
