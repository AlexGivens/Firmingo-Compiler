#!/usr/bin/env python3
"""Assemble and verify a source-only candidate package; never publish or promote a service."""
import argparse
import gzip
import hashlib
import io
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools import service_build as sb
from tools import runtime_build as rb

MAX_FILES = 160000
MAX_TOTAL = 8 * 1024**3
MAX_MANIFEST = 64 * 1024**2
PREFIX = "firmingo-compiler-source"


def configuration(path):
    config = sb.read_json(path, 65536)
    if not isinstance(config, dict) or set(config) != {"schema", "serviceBuild", "serviceReceiptSHA256", "runtimeBuild", "runtimeReceiptSHA256", "llvmGit", "archives"} or type(config["schema"]) is not int or config["schema"] != 1:
        raise ValueError("unsupported source package configuration")
    if not isinstance(config["archives"], dict) or set(config["archives"]) != {"libc", "wasiHeaders"}:
        raise ValueError("select both explicit source archives")
    for name in ("serviceReceiptSHA256", "runtimeReceiptSHA256"):
        if not isinstance(config[name], str) or not re.fullmatch(r"[0-9a-f]{64}", config[name]):
            raise ValueError("select independently reviewed receipt anchors")
    for value in [config[name] for name in ("serviceBuild", "runtimeBuild", "llvmGit")] + list(config["archives"].values()):
        if not isinstance(value, str) or not Path(value).is_absolute() or len(value) > 4096 or any(ord(c) < 32 for c in value):
            raise ValueError("select bounded absolute input locators")
    return config


def completed(root, anchor, status):
    root = sb.real_directory(root)
    path = root / "operation.json"
    receipt_bytes = sb.read_small(path, 65536)
    if path.is_symlink() or sb.sha(receipt_bytes) != anchor:
        raise ValueError("build receipt differs from reviewed anchor")
    receipt = sb.json.loads(receipt_bytes, object_pairs_hook=sb.unique_object)
    if receipt.get("status") != status or receipt.get("distributionStatus") != "unresolved":
        raise ValueError("select a supported successful development build")
    input_bytes = sb.read_small(root / "input-manifest.json", MAX_MANIFEST)
    if sb.sha(input_bytes) != receipt.get("inputManifestSHA256"):
        raise ValueError("build input manifest differs from receipt")
    inputs = sb.json.loads(input_bytes, object_pairs_hook=sb.unique_object)
    return root, receipt, inputs


def verify_custom_materials(grant, custom):
    """Require a closed source/grant inventory and unchanged reviewed license texts."""
    allowed = {item["path"] for item in custom} | {"manifest.json", "SOURCE-LICENSE.md", "LICENSE", "LLVM-LICENSE.txt"}
    material_records = file_inventory(sb.OWNED_SOURCE_ROOT)
    if {item["path"] for item in material_records} != allowed or any(item["mode"] != "100644" for item in material_records):
        raise ValueError("unlisted or aliased custom source material")
    reference = sb.read_json(sb.REFERENCE_PATH)
    licenses = grant.get("licenseFiles")
    if not isinstance(licenses, list) or len(licenses) != 2:
        raise ValueError("incomplete custom/upstream license inventory")
    for item, expected_name, pin in zip(licenses, ("LICENSE", "LLVM-LICENSE.txt"),
                                       (sb.file_record(sb.ROOT / "LICENSE", 65536), reference["llvmLicense"])):
        if item.get("path") != expected_name or {key: item.get(key) for key in ("bytes", "sha256")} != {key: pin[key] for key in ("bytes", "sha256")} or sb.file_record(sb.OWNED_SOURCE_ROOT / expected_name, 65536) != {key: pin[key] for key in ("bytes", "sha256")}:
            raise ValueError("source license differs from reviewed identity")


def preflight(config):
    service, service_receipt, service_inputs = completed(config["serviceBuild"], config["serviceReceiptSHA256"], "built_owned_development_service")
    runtime, runtime_receipt, runtime_inputs = completed(config["runtimeBuild"], config["runtimeReceiptSHA256"], "built_owned_wasip1_runtime")
    if service_inputs.get("recipe") != sb.read_json(sb.RECIPE_PATH) or runtime_inputs.get("recipe") != sb.read_json(rb.RECIPE):
        raise ValueError("build recipes differ from reviewed source recipes")
    module = service_receipt["module"]
    if module.get("path") != "compiler.wasm" or sb.file_record(service / "compiler.wasm") != {key: module[key] for key in ("bytes", "sha256")}:
        raise ValueError("candidate service differs from build receipt")
    inventory = sb.read_json(runtime / "output-files.json", 8*1024**2)
    if sb.file_record(runtime / "output-files.json", 8*1024**2)["sha256"] != runtime_receipt["outputInventorySHA256"]:
        raise ValueError("runtime output inventory differs from receipt")
    for role in ("sysroot", "resources"):
        expected = {item["path"]: (item["bytes"], item["sha256"]) for item in service_inputs[role]}
        actual = {item["path"]: (item["bytes"], item["sha256"]) for item in inventory[role]}
        if expected != actual:
            raise ValueError("candidate/runtime output identities differ")
        for item in inventory[role]:
            if sb.file_record(runtime / role / sb.path_name(item["path"])) != {key: item[key] for key in ("bytes", "sha256")}:
                raise ValueError("runtime file differs from completed inventory")
    grant = sb.read_json(sb.OWNED_SOURCE_ROOT / "manifest.json", 65536)
    custom = [{key: item[key] for key in ("path", "role", "bytes", "sha256")} for item in grant["files"]]
    if grant["contributionLicense"] != "GPL-3.0-only" or sorted(custom, key=lambda item: item["path"]) != service_inputs["serviceInputs"]:
        raise ValueError("candidate custom inputs differ from author grant")
    for item in custom:
        for root in (sb.OWNED_SOURCE_ROOT, service / "service"):
            if sb.file_record(root / sb.path_name(item["path"])) != {key: item[key] for key in ("bytes", "sha256")}:
                raise ValueError("custom source differs from candidate/grant")
    verify_custom_materials(grant, custom)
    objects = {}
    for inputs in (service_inputs, runtime_inputs):
        actual, _ = sb.llvm_source_inputs({"llvmGit": config["llvmGit"]}, inputs["recipe"])
        if actual != inputs["llvmSources"]:
            raise ValueError("upstream Git objects differ from completed source inputs")
        for item in actual:
            if item["path"] in objects and objects[item["path"]] != item:
                raise ValueError("overlapping source objects disagree")
            objects[item["path"]] = item
    for name, record in runtime_inputs["archives"].items():
        if sb.file_record(config["archives"][name], rb.MAX_ARCHIVE) != record:
            raise ValueError("source archive differs from completed runtime inputs")
    return service, runtime, service_receipt, runtime_receipt, service_inputs, runtime_inputs, sorted(objects.values(), key=lambda item: item["path"])


def file_inventory(root):
    """Inventory explicit package contents, retaining only bounded internal source links."""
    records, total = [], 0
    for directory, dirs, files in os.walk(root, followlinks=False):
        if any((Path(directory) / name).is_symlink() for name in dirs):
            raise ValueError("source package directory link")
        for name in files:
            path = Path(directory) / name; relative = sb.path_name(path.relative_to(root).as_posix())
            if path.is_symlink():
                target = os.readlink(path)
                sb.path_name(os.path.normpath(str(Path(relative).parent / target)))
                if Path(target).is_absolute() or not path.resolve(strict=True).is_relative_to(root):
                    raise ValueError("source package link escapes inventory")
                data = target.encode(); record = {"bytes": len(data), "sha256": sb.sha(data), "link": target, "mode": "120000"}
            else:
                record = {**sb.file_record(path, MAX_MANIFEST if path.name == "manifest.json" else 32*1024**2), "mode": "100755" if path.stat().st_mode & 0o111 else "100644"}
            total += record["bytes"]
            if len(records) >= MAX_FILES or total > MAX_TOTAL:
                raise ValueError("source package inventory exceeds bound")
            records.append({"path": relative, **record})
    return sorted(records, key=lambda item: item["path"])


def create_archive(root, manifest, destination):
    """Normalize archive metadata; payload identities remain independently verifiable."""
    names = [record["path"] for record in manifest["files"]] + ["manifest.json"]
    with destination.open("xb") as output, gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=manifest["sourceDateEpoch"], compresslevel=6) as compressed, tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
        for name in sorted(names):
            path = root / name; info = tarfile.TarInfo(PREFIX + "/" + name)
            info.mtime = manifest["sourceDateEpoch"]; info.uid = info.gid = 0; info.uname = info.gname = ""
            if path.is_symlink():
                info.type = tarfile.SYMTYPE; info.mode = 0o777; info.linkname = os.readlink(path); archive.addfile(info)
            else:
                info.mode = 0o755 if path.stat().st_mode & 0o111 else 0o644; info.size = path.stat().st_size
                with path.open("rb") as source:
                    archive.addfile(info, source)


def verify_archive(path, expected):
    """Verify before extraction using an independently selected complete archive SHA-256."""
    if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected) or sb.file_record(path, 2*1024**3)["sha256"] != expected:
        raise ValueError("source archive differs from reviewed anchor")
    # Two bounded passes allow the manifest to occur anywhere in sorted archive order.
    with tarfile.open(path, "r:gz") as archive:
        members, names, total, manifest = [], set(), 0, None
        for member in archive:
            name = member.name
            if not name.startswith(PREFIX + "/"):
                raise ValueError("source archive root mismatch")
            name = sb.path_name(name[len(PREFIX) + 1:])
            if name in names or not (member.isfile() or member.issym()) or member.size > MAX_MANIFEST:
                raise ValueError("duplicate or unsupported source archive member")
            names.add(name); total += member.size
            if len(names) > MAX_FILES + 1 or total > MAX_TOTAL:
                raise ValueError("source archive expansion exceeds bound")
            members.append((name, member))
            if name == "manifest.json":
                if not member.isfile():
                    raise ValueError("source archive manifest must be regular")
                data = archive.extractfile(member).read(MAX_MANIFEST + 1)
                if len(data) > MAX_MANIFEST:
                    raise ValueError("source archive manifest exceeds bound")
                manifest = sb.json.loads(data, object_pairs_hook=sb.unique_object)
        if not isinstance(manifest, dict) or type(manifest.get("schema")) is not int or manifest.get("schema") != 1 or manifest.get("operation") != "candidate_corresponding_source_package" or not isinstance(manifest.get("files"), list) or manifest.get("distributionStatus") != "unresolved" or manifest.get("serviceBinaryIncluded") is not False:
            raise ValueError("unsupported source archive manifest")
        records = {sb.path_name(item["path"]): item for item in manifest["files"]}
        if len(records) != len(manifest["files"]) or set(records) != names - {"manifest.json"}:
            raise ValueError("source archive inventory mismatch")
        def link_target(name, seen):
            if name in seen or len(seen) > 64:
                raise ValueError("cyclic source archive link")
            record = records[name]
            if record.get("mode") == "120000":
                target = record.get("link")
                if not isinstance(target, str) or Path(target).is_absolute():
                    raise ValueError("unsafe source archive link")
                normalized = sb.path_name(os.path.normpath(str(Path(name).parent / target)))
                if normalized not in records:
                    raise ValueError("source archive link target missing")
                link_target(normalized, seen | {name})
        for name in records:
            link_target(name, set())
        for name, member in members:
            if name == "manifest.json":
                continue
            record = records[name]
            if member.issym():
                normalized = sb.path_name(os.path.normpath(str(Path(name).parent / member.linkname)))
                if Path(member.linkname).is_absolute() or normalized not in records or record.get("mode") != "120000" or member.linkname != record.get("link"):
                    raise ValueError("unsafe source archive link")
                data = member.linkname.encode(); actual = {"bytes": len(data), "sha256": sb.sha(data)}
            else:
                if record.get("mode") not in ("100644", "100755") or member.mode != (0o755 if record["mode"] == "100755" else 0o644):
                    raise ValueError("source archive mode mismatch")
                digest = hashlib.sha256(); size = 0
                with archive.extractfile(member) as source:
                    while data := source.read(1024*1024):
                        digest.update(data); size += len(data)
                actual = {"bytes": size, "sha256": digest.hexdigest()}
            if actual != {key: record[key] for key in ("bytes", "sha256")}:
                raise ValueError("source archive payload differs from manifest")
    if sb.file_record(path, 2*1024**3)["sha256"] != expected:
        raise ValueError("source archive changed while verifying")
    return {"status": "verified_candidate_source_archive", "files": len(records), "archiveSHA256": expected,
            "serviceBinaryIncluded": False, "distributionStatus": "unresolved"}


def build(config, output):
    service, runtime, sr, rr, si, ri, objects = preflight(config)
    output.mkdir()
    try:
        package = output / "package"; package.mkdir()
        llvm = package / "upstream/llvm"; llvm.mkdir(parents=True)
        records = sb.export_git(config["llvmGit"], si["recipe"], llvm / "source", objects)
        sb.write_json(llvm / "manifest.json", {"schema": 1, "llvmCommit": si["recipe"]["llvmCommit"], "files": records})
        for name, pin in ri["recipe"]["archives"].items():
            destination = package / "archives" / (name + ".tar.gz"); destination.parent.mkdir(exist_ok=True)
            shutil.copyfile(config["archives"][name], destination)
            rb.unpack(destination, pin, package / "upstream" / name)
        native = package / "bootstrap-source-headers"; native.mkdir()
        sb.copy_records(native, ri["nativeHeaders"], {item["path"]: runtime / "resources/include" / item["path"] for item in ri["nativeHeaders"]})
        for name in ("service/source",):
            shutil.copytree(sb.ROOT / name, package / name)
        for name in ("LICENSE", "package.json", "service/recipe.json", "service/runtime-recipe.json", "service/WASIClangToolchain.cmake",
                     "docs/service-reference.json", "docs/source-package.md", "docs/service-upstream-notices.md", "docs/service-build.md", "docs/runtime-source-build.md",
                     "tools/service_build.py", "tools/runtime_build.py", "tools/source_package.py", "tools/inspect-service.mjs", "tools/bounded-file.mjs", "runtime/ModuleMemory.js"):
            destination = package / name; destination.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(sb.ROOT / name, destination)
        evidence = package / "build-identities"; evidence.mkdir()
        for label, root, names in (("service", service, ("operation.json", "input-manifest.json", "link-inputs.json", "patched-sources.json")),
                                   ("runtime", runtime, ("operation.json", "input-manifest.json", "output-files.json", "libc-adaptation.json", "libcxx-adaptation.json"))):
            folder = evidence / label; folder.mkdir()
            for name in names:
                shutil.copyfile(root / name, folder / name)
        notice_files = [record for record in file_inventory(package) if Path(record["path"]).name.upper().startswith(("LICENSE", "COPYING", "COPYRIGHT", "NOTICE"))]
        sb.write_json(package / "notices.json", {"schema": 1, "scope": "all named notice/license files retained; file-header terms remain in full source", "files": notice_files})
        manifest = {"schema": 1, "operation": "candidate_corresponding_source_package", "sourceDateEpoch": si["recipe"]["sourceDateEpoch"],
                    "candidateService": sr["module"], "serviceReceiptSHA256": config["serviceReceiptSHA256"], "runtimeReceiptSHA256": config["runtimeReceiptSHA256"],
                    "llvmCommit": si["recipe"]["llvmCommit"], "rawLLVMSourceFiles": len(records), "serviceBinaryIncluded": False,
                    "runtimeLibrariesIncluded": False, "upstreamFixtureDataIncluded": True, "completeCorrespondingSource": False,
                    "distributionStatus": "unresolved", "remaining": ["Rebuild and verify from unpacked source package", "Finish exact linked-file notice/delivery review"],
                    "files": file_inventory(package)}
        sb.write_json(package / "manifest.json", manifest)
        archive = output / "source.tar.gz"; create_archive(package, manifest, archive)
        archive_identity = sb.file_record(archive, 2*1024**3)
        verified = verify_archive(archive, archive_identity["sha256"])
        receipt = {"schema": 1, "status": "built_candidate_source_package", "archive": {"path": "source.tar.gz", **archive_identity},
                   "manifest": sb.file_record(package / "manifest.json", MAX_MANIFEST), "files": verified["files"], "rawLLVMSourceFiles": len(records),
                   "candidateServiceSHA256": sr["module"]["sha256"], "serviceBinaryIncluded": False, "distributionStatus": "unresolved"}
        sb.write_json(output / "operation.json", receipt)
        return receipt
    except BaseException as error:
        sb.write_json(output / "failure.json", {"status": "failed_source_package", "type": type(error).__name__, "detail": str(error)[:4096]})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    child = sub.add_parser("build", help="verify successful build anchors, collect source and create a checked archive")
    child.add_argument("config", type=Path); child.add_argument("output", type=Path)
    child = sub.add_parser("verify", help="verify an anchored archive and every payload without extracting or executing")
    child.add_argument("archive", type=Path); child.add_argument("archive_sha256")
    args = parser.parse_args()
    try:
        if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
            raise ValueError("start with Python -I -S -B")
        result = build(configuration(args.config), args.output.absolute()) if args.command == "build" else verify_archive(args.archive, args.archive_sha256)
        print(sb.json.dumps(result, sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError, sb.subprocess.SubprocessError) as error:
        parser.exit(1, "Source package failed: " + str(error)[:4096] + "\n")


if __name__ == "__main__":
    main()
