"""Create, verify or extract a deterministic local service transport; never fetch or publish."""
import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import struct
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import service_delivery as sd

sb = sd.sb
ROLES = sorted(sd.NAMES | {"manifest.json"})
ARCHIVE = "firmingo-compiler-service.zip"
MAXIMUM = 400 * 1024**2
STAMP = (1980, 1, 1, 0, 0, 0)


def regular(path):
    """Open a bounded ordinary file without following a final symlink or blocking on a FIFO."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    try:
        value = os.fstat(descriptor)
        if not stat.S_ISREG(value.st_mode) or value.st_size > MAXIMUM:
            raise ValueError("transport input is not a bounded regular file")
        return os.fdopen(descriptor, "rb")
    except BaseException:
        os.close(descriptor)
        raise


def archive_entries(source):
    """Bound the central directory before ZIP parsing; admit only our ten stored, normalized files."""
    size = os.fstat(source.fileno()).st_size
    if size < 22:
        raise ValueError("truncated service transport")
    source.seek(-22, os.SEEK_END)
    end = struct.unpack("<4s4H2IH", source.read(22))
    if (end[:5] != (b"PK\x05\x06", 0, 0, len(ROLES), len(ROLES)) or end[7] != 0
            or end[5] > 16384 or end[6] + end[5] != size - 22):
        raise ValueError("unsupported or oversized transport directory")
    source.seek(max(0, size - 42))
    if source.read(4) == b"PK\x06\x07":
        raise ValueError("ZIP64 service transports are unsupported")
    archive = zipfile.ZipFile(source)
    try:
        entries = archive.infolist()
        if [entry.filename for entry in entries] != ROLES:
            raise ValueError("missing, duplicate, unordered or unsafe transport role")
        total = 0
        offset = 0
        for entry in entries:
            if (entry.orig_filename != entry.filename or entry.compress_type != zipfile.ZIP_STORED
                    or entry.compress_size != entry.file_size or entry.file_size > sd.MAXIMUM
                    or entry.extra or entry.comment or entry.flag_bits != 0 or entry.create_system != 3
                    or entry.external_attr != (stat.S_IFREG | 0o644) << 16 or entry.internal_attr != 0
                    or entry.date_time != STAMP or entry.extract_version != 20
                    or entry.header_offset != offset):
                raise ValueError("unsupported transport member metadata or size")
            source.seek(offset)
            local = source.read(30)
            expected_header = (b"PK\x03\x04", 20, 0, 0, 0, 33, entry.CRC,
                               entry.file_size, entry.file_size, len(entry.filename), 0)
            if (len(local) != 30 or struct.unpack("<4s5H3I2H", local) != expected_header
                    or source.read(len(entry.filename)) != entry.filename.encode("ascii")):
                raise ValueError("local transport header differs from its inventory")
            # No prefixes, hidden local members, data descriptors or inter-member padding.
            offset += 30 + len(entry.filename.encode("ascii")) + entry.file_size
            total += entry.file_size
        if total > MAXIMUM or offset != end[6]:
            raise ValueError("oversized or noncanonical transport payload")
        return archive, entries
    except BaseException:
        archive.close()
        raise


def release_index(root, expected):
    """Authenticate a small release inventory against a caller-supplied independent anchor."""
    sb.real_directory(root)
    if (root / "release.json").is_symlink() or sb.file_record(root / "release.json", 16384)["sha256"] != expected:
        raise ValueError("release inventory differs from independent anchor")
    value = sb.read_json(root / "release.json", 16384)
    reviewed = sd.review()
    if (set(value) != {"schema", "package", "version", "reviewSHA256", "deliveryManifestSHA256", "archive",
                       "serviceSHA256", "sourceSHA256", "completeCorrespondingSource", "published"}
            or type(value["schema"]) is not int or value["schema"] != 1
            or value["package"] != "firmingo-compiler-service-transport" or value["version"] != reviewed["id"]
            or value["reviewSHA256"] != sd.REVIEW_SHA256 or value["serviceSHA256"] != reviewed["service"]["sha256"]
            or value["sourceSHA256"] != reviewed["source"]["sha256"]
            or value["completeCorrespondingSource"] is not True or value["published"] is not False
            or set(value["archive"]) != {"path", "bytes", "sha256"} or value["archive"]["path"] != ARCHIVE
            or type(value["archive"]["bytes"]) is not int or not 0 < value["archive"]["bytes"] <= MAXIMUM
            or any(path.name not in {ARCHIVE, "release.json", "operation.json"} or path.is_symlink()
                   or not path.is_file() for path in root.iterdir())):
        raise ValueError("incompatible release inventory or content")
    return value


def unpack_verified(root, expected, destination):
    """Stream fixed roles into a private directory, verify complete source, then recheck transport bytes."""
    value = release_index(root, expected)
    path = root / ARCHIVE
    sd.checked(path, value["archive"])
    with regular(path) as source:
        archive, entries = archive_entries(source)
        with archive:
            for entry in entries:
                with archive.open(entry) as payload, (destination / entry.filename).open("xb") as output:
                    count = 0
                    while data := payload.read(1024 * 1024):
                        count += len(data)
                        if count > entry.file_size:
                            raise ValueError("transport member exceeded declared bound")
                        output.write(data)
                    if count != entry.file_size:
                        raise ValueError("truncated transport member")
    result = sd.verify(destination, value["deliveryManifestSHA256"])
    sd.checked(path, value["archive"])
    release_index(root, expected)
    return {**result, "status": "verified_service_transport", "releaseSHA256": expected,
            "archiveSHA256": value["archive"]["sha256"], "archiveBytes": value["archive"]["bytes"]}


def verify(root, expected):
    with tempfile.TemporaryDirectory(prefix="firmingo-service-transport-") as temporary:
        return unpack_verified(root, expected, Path(temporary))


def extract(root, expected, output):
    """Reserve a new output directory; failures remove only content created by this invocation."""
    output.mkdir()
    try:
        result = unpack_verified(root, expected, output)
        sb.write_json(output / "operation.json", result)
        return result
    except BaseException:
        shutil.rmtree(output)
        raise


def build(delivery, expected, output):
    """Package validated observed bytes with fixed metadata, excluding local completion receipts."""
    paired = sd.verify(delivery, expected)
    records = {name: sb.file_record(delivery / name, sd.MAXIMUM) for name in ROLES}
    if sum(record["bytes"] for record in records.values()) + 16384 > MAXIMUM:
        raise ValueError("service transport exceeds its total bound")
    output.mkdir()
    try:
        with zipfile.ZipFile(output / ARCHIVE, "x", compression=zipfile.ZIP_STORED, allowZip64=False) as archive:
            for name in ROLES:
                entry = zipfile.ZipInfo(name, STAMP)
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.file_size = records[name]["bytes"]
                with regular(delivery / name) as source, archive.open(entry, "w") as target:
                    count = 0
                    while data := source.read(1024 * 1024):
                        count += len(data)
                        if count > records[name]["bytes"]:
                            raise ValueError("delivery input grew during packaging")
                        target.write(data)
                    if count != records[name]["bytes"]:
                        raise ValueError("delivery input shrank during packaging")
                sd.checked(delivery / name, records[name])
        sd.verify(delivery, expected)
        reviewed = sd.review()
        sb.write_json(output / "release.json", {"schema": 1, "package": "firmingo-compiler-service-transport",
                      "version": reviewed["id"], "reviewSHA256": sd.REVIEW_SHA256,
                      "deliveryManifestSHA256": expected, "archive": {"path": ARCHIVE, **sb.file_record(output / ARCHIVE, MAXIMUM)},
                      "serviceSHA256": paired["serviceSHA256"], "sourceSHA256": paired["sourceSHA256"],
                      "completeCorrespondingSource": True, "published": False})
        anchor = sb.file_record(output / "release.json", 16384)["sha256"]
        result = verify(output, anchor)
        sb.write_json(output / "operation.json", result)
        return result
    except BaseException:
        shutil.rmtree(output)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    child = commands.add_parser("build"); child.add_argument("delivery", type=Path); child.add_argument("manifest_sha256"); child.add_argument("output", type=Path)
    for name in ("verify", "extract"):
        child = commands.add_parser(name); child.add_argument("root", type=Path); child.add_argument("release_sha256")
        if name == "extract": child.add_argument("output", type=Path)
    args = parser.parse_args()
    if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
        raise ValueError("use pinned Python -I -S -B")
    if args.command == "build": result = build(args.delivery, args.manifest_sha256, args.output)
    elif args.command == "extract": result = extract(args.root, args.release_sha256, args.output)
    else: result = verify(args.root, args.release_sha256)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, zipfile.BadZipFile, RuntimeError, struct.error) as error:
        print(str(error), file=sys.stderr); sys.exit(1)
