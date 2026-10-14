# Firmingo compiler service — LLVM 22.1.8 / WASI Preview 1 / ABI 2

This delivery pairs the rebuilt `compiler.wasm` with `compiler-source.tar.gz`,
the GPL text, upstream licenses, source-specific credits and rebuild instructions.
It is the modified Firmingo WASM compiler service, based on LLVM/Clang/LLD
22.1.8 and the pinned WASI runtime. It is not an unmodified upstream release.

Original service contributions and thirteen local patches are GPL-3.0-only.
Upstream LLVM, WASI and third-party contributions retain their accompanying
terms, copyright notices, permissions, exceptions and disclaimers. See `LICENSE`,
`LICENSES.txt` and `FILE-NOTICES.txt`. These include Henry Spencer/Regents regex
credits, Unicode notices, Yann Collet, Alexander Peslyak, Ulf Adams/Microsoft,
Sandia/NTESS, musl and other runtime authors. Raw sources, separate patches,
upstream modifications and runtime adaptations remain in the source archive.
No new generated-sketch licensing exception is granted.

The independently anchored `manifest.json` identifies every delivery file. Verify
its anchor from the chosen trusted distribution context before executing the
compiler. SHA-256 establishes byte identity, not publisher authentication.
`delivery-review.json` records the exact reviewed scope and completed source proof;
the source archive retains its earlier candidate-status metadata unchanged.

Keep all these files together when sharing this compiler. For hosted downloads,
offer the source through the same place and access method, without additional
charge, and keep it available while the binary is offered. A future release must
provide both files and the notices; this local staging command publishes nothing.
See GNU GPL version 3, section 6(d), in `LICENSE`.

The service needs a WASI Preview 1 web host supplied by the wrapper. Memory is
bounded to 256 MiB. Firmingo-Compiler supplies orchestration and explicit board
recipes separately; FirmingoKit supplies its Swift/web host and device operations.
The constrained Nano managed-sketch recipe is experimental. Service packaging
does not qualify additional boards, arbitrary Arduino libraries, physical Apple
hosts, installed firmware, uploads or useful device behavior.
