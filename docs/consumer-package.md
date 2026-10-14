# Experimental Nano consumer package

`consumer-package` binds the reviewed service/source delivery, exact web
runtime/recipe and one schema-2 firmware export into a versioned offline package.
Version `0.1.0-nano-managed-experimental.1` is selected by `consumer/review.json`.

```sh
node tools/dev.mjs consumer-package build VERIFIED_SERVICE_DELIVERY EXACT_RESIDENT_EXPORT NEW_PACKAGE
node tools/dev.mjs consumer-package verify PACKAGE TRUSTED_MANIFEST_SHA256
```

Build accepts only the review's exact delivery/export anchors. Verification checks
the caller's independent package anchor, recreates the web export, verifies the
firmware source contract/UF2 API table, derives the catalogue and runs complete
paired-source verification. It rechecks every payload and manifest afterwards.
Select the optional isolated Python host as for `service-package`. No service is
instantiated. Consumer execution requires no maintenance tools or sibling checkout.

The 33 payloads are nine web export roles, ten paired service/source roles, twelve
firmware evidence roles, `catalogue.json` and `resident-import.json`. Root manifest
binds paths/bytes/hashes, interface one, service ABI two, service/review, catalogue
and version. Completion is written last. Unsafe paths, links, special files,
empty/unlisted directories, missing/extra roles and excess sizes fail. Individual
and aggregate payload bounds are 400 MiB, at most 64 files/four directory levels.
Failed construction removes only its own new output.

Initial manifest SHA-256:
`d042dc7d3869949d8e311fff28c5d66327ba090ba2ec8ff149e3a12019d8ea8c`.
Catalogue SHA-256:
`e341bfc0385fea9b2b026dc624daa26cdeac33286f4bb07243b37c1c31837d0e`.
Only build `c44d25ef…`, Firmware commit `e0a79d1…`, API `0x10022c9c` is offered.
Selected firmware CI export anchor is `9246a7da…`; exact ELF/UF2/report and six
source/license identities remain unchanged. Existing upstream provenance limits
remain explicit. This is no installed-device association or qualified firmware
installation release. Archived build reports retain their original CI paths as
evidence; those paths are not runtime dependencies.

FirmingoKit imports catalogue/package metadata, retains its WebKit bridge and
independently pins thirteen resource roles. Its explicit package-preparation tool
copies a clean committed SDK, supplies the reviewed compiler to app resources
and retains complete paired source/notices outside them. This supports default API
compilation in a fresh consumer while keeping binaries out of Git. The source
checkout continues to report missing compiler bytes. New inputs require a new
review/version and SDK anchor migration; historical artifacts/associations/journals
are retained. Hosted publication, installed-image evidence, signed/minimum-OS/
physical hosts and device behavior remain [separate gates](release-qualification.md).

[Actual consumer evidence](evidence/consumer-package.md) records package repetition,
default SDK compilation and independent firmware acceptance/wrong-binding rejection.
