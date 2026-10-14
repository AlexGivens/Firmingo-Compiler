"""Stage/verify the exact reviewed service with its source and binary documentation; never publish."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import service_build as sb
import source_package as sp

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "service/delivery-review.json"
REVIEW_SHA256 = "2627a80ee5845929f030cfec6253f05e3cfc4f8c98bff69a0117b3d78114cb26"
NAMES = {"compiler.wasm", "compiler-source.tar.gz", "LICENSE", "LICENSES.txt", "FILE-NOTICES.txt",
         "source-notices.json", "delivery-review.json", "README.md", "BUILDING.md"}
MAXIMUM = 400 * 1024**2


def checked(path, record):
    if sb.file_record(path, MAXIMUM) != {key: record[key] for key in ("bytes", "sha256")}:
        raise ValueError("delivery input differs from reviewed identity")


def review():
    if sb.file_record(REVIEW, 16384)["sha256"] != REVIEW_SHA256:
        raise ValueError("delivery review differs from committed anchor")
    value = sb.read_json(REVIEW, 16384)
    if value["distributionStatus"] != "reviewed-paired-delivery" or value["source"]["completeCorrespondingSource"] is not True:
        raise ValueError("review does not authorize paired packaging")
    return value


def build(service, source, output):
    value = review()
    if output.exists():
        raise ValueError("select a new service delivery directory")
    receipt = service / "operation.json"
    if sb.file_record(receipt, 16384)["sha256"] != value["buildReceiptSHA256"]:
        raise ValueError("service build receipt anchor mismatch")
    operation = sb.read_json(receipt, 16384)
    if operation["status"] != "built_owned_development_service" or operation["inputManifestSHA256"] != value["buildInputsSHA256"]:
        raise ValueError("select the reviewed completed service build")
    if sb.file_record(service / "input-manifest.json", 64 * 1024**2)["sha256"] != value["buildInputsSHA256"]:
        raise ValueError("service inputs differ from completed receipt")
    checked(service / "compiler.wasm", value["service"])
    checked(source, value["source"])
    verified = sp.verify_archive(source, value["source"]["sha256"])
    if verified["files"] != value["source"]["files"]:
        raise ValueError("source archive count differs from review")
    checked(ROOT / value["proof"]["path"], value["proof"])
    checked(ROOT / value["noticeManifest"]["path"], value["noticeManifest"])
    notice = sb.read_json(ROOT / value["noticeManifest"]["path"], 131072)
    inputs = {"compiler.wasm": service / "compiler.wasm", "compiler-source.tar.gz": source,
              "LICENSE": ROOT / "LICENSE", "delivery-review.json": REVIEW,
              "source-notices.json": ROOT / value["noticeManifest"]["path"]}
    for record in notice["files"]:
        if record["path"] in ("FILE-NOTICES.txt", "LICENSES.txt"):
            path = ROOT / "third_party/service-notice-review" / record["path"]
            checked(path, record); inputs[record["path"]] = path
    for name in ("README.md", "BUILDING.md"):
        inputs[name] = ROOT / "service/delivery" / name
    identities = {name: sb.file_record(path, MAXIMUM) for name, path in inputs.items()}
    output.mkdir()
    try:
        for name, path in inputs.items():
            shutil.copyfile(path, output / name)
            checked(output / name, identities[name])
        manifest = {"schema": 1, "package": "firmingo-compiler-service", "version": value["id"],
                    "serviceABI": value["service"]["abi"], "maximumMemoryBytes": value["service"]["maximumMemoryBytes"],
                    "distributionStatus": "reviewed-paired-delivery", "completeCorrespondingSource": True,
                    "published": False, "sourceArchiveProducerStatus": "historical candidate; later reviewed",
                    "reviewSHA256": REVIEW_SHA256, "files": [{"path": name, **identities[name]} for name in sorted(identities)]}
        sb.write_json(output / "manifest.json", manifest)
        manifest_sha = sb.file_record(output / "manifest.json", 16384)["sha256"]
        result = verify(output, manifest_sha)
        sb.write_json(output / "operation.json", result)
        return result
    except BaseException as error:
        sb.write_json(output / "failure.json", {"status": "failed_service_delivery", "detail": str(error)[:4096]})
        raise


def verify(root, expected):
    value = review()
    if root.is_symlink() or not root.is_dir():
        raise ValueError("select a regular delivery directory")
    if sb.file_record(root / "manifest.json", 16384)["sha256"] != expected:
        raise ValueError("delivery manifest differs from independent anchor")
    manifest = sb.read_json(root / "manifest.json", 16384)
    if (set(manifest) != {"schema", "package", "version", "serviceABI", "maximumMemoryBytes", "distributionStatus",
                         "completeCorrespondingSource", "published", "sourceArchiveProducerStatus", "reviewSHA256", "files"}
            or type(manifest["schema"]) is not int or manifest["schema"] != 1 or manifest["package"] != "firmingo-compiler-service"
            or manifest["version"] != value["id"] or type(manifest["serviceABI"]) is not int or manifest["serviceABI"] != value["service"]["abi"]
            or type(manifest["maximumMemoryBytes"]) is not int or manifest["maximumMemoryBytes"] != value["service"]["maximumMemoryBytes"]
            or manifest["reviewSHA256"] != REVIEW_SHA256 or manifest["distributionStatus"] != "reviewed-paired-delivery"
            or manifest["completeCorrespondingSource"] is not True or manifest["published"] is not False):
        raise ValueError("incompatible service delivery inventory")
    records = {}
    for record in manifest["files"]:
        name = record.get("path")
        if name not in NAMES or name in records or set(record) != {"path", "bytes", "sha256"}:
            raise ValueError("duplicate or unsafe delivery role")
        checked(root / name, record); records[name] = record
    if set(records) != NAMES or any(p.name not in NAMES | {"manifest.json", "operation.json"} or p.is_symlink() or not p.is_file() for p in root.iterdir()):
        raise ValueError("missing, unlisted or unsafe delivery content")
    for name, pin in (("compiler.wasm", value["service"]), ("compiler-source.tar.gz", value["source"]),
                      ("source-notices.json", value["noticeManifest"]), ("delivery-review.json", {"bytes": REVIEW.stat().st_size, "sha256": REVIEW_SHA256})):
        checked(root / name, pin)
    for name, path in (("LICENSE", ROOT / "LICENSE"), ("README.md", ROOT / "service/delivery/README.md"), ("BUILDING.md", ROOT / "service/delivery/BUILDING.md")):
        checked(root / name, sb.file_record(path, MAXIMUM))
    notices = sb.read_json(root / "source-notices.json", 131072)
    for pin in notices["files"]:
        if pin["path"] in ("FILE-NOTICES.txt", "LICENSES.txt"):
            checked(root / pin["path"], pin)
    sp.verify_archive(root / "compiler-source.tar.gz", value["source"]["sha256"])
    for name, record in records.items():
        checked(root / name, record)
    # Recheck the inventory after the longer archive pass; do not return a stale success.
    if sb.file_record(root / "manifest.json", 16384)["sha256"] != expected:
        raise ValueError("delivery inventory changed during verification")
    return {"schema": 1, "status": "verified_reviewed_service_delivery", "manifestSHA256": expected,
            "serviceSHA256": value["service"]["sha256"], "sourceSHA256": value["source"]["sha256"], "files": len(records),
            "distributionStatus": "reviewed-paired-delivery", "completeCorrespondingSource": True, "published": False, "hardwareExecuted": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    child = sub.add_parser("build"); child.add_argument("service", type=Path); child.add_argument("source", type=Path); child.add_argument("output", type=Path)
    child = sub.add_parser("verify"); child.add_argument("root", type=Path); child.add_argument("manifest_sha256")
    args = parser.parse_args()
    if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
        raise ValueError("use pinned Python -I -S -B")
    result = build(args.service, args.source, args.output) if args.command == "build" else verify(args.root, args.manifest_sha256)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr); sys.exit(1)
