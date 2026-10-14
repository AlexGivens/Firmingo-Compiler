"""Exercise real transport parsing with tiny nonexecutable paired-source fixtures; never deploy."""
import copy
from pathlib import Path
import stat
import struct
import sys
import unittest
from unittest.mock import patch
import warnings
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools import service_release as sr
from tests.maintenance.test_service_delivery import DeliveryTests


class TransportTests(unittest.TestCase):
    def setUp(self):
        DeliveryTests.setUp(self)
        self.alias = patch.object(sr, "sd", sys.modules["tools.service_delivery"])
        self.alias.start()
        self.delivery, self.paired = DeliveryTests.build(self)

    def tearDown(self):
        self.alias.stop()
        DeliveryTests.tearDown(self)

    def build(self, name="transport"):
        root = self.root / name
        result = sr.build(self.delivery, self.paired["manifestSHA256"], root)
        return root, result

    def reanchor(self, root):
        path = root / "release.json"
        value = sr.sb.read_json(path)
        value["archive"].update(sr.sb.file_record(root / sr.ARCHIVE))
        path.write_bytes(sr.sb.json_bytes(value))
        return sr.sb.file_record(path)["sha256"]

    def test_repeat_archive_is_identical_despite_local_paths_modes_times_and_receipts(self):
        root, result = self.build()
        (self.delivery / "operation.json").write_bytes(b"untrusted local receipt")
        for path in self.delivery.iterdir(): path.chmod(0o600)
        second, repeated = self.build("second")
        self.assertEqual(result, repeated)
        self.assertEqual((root / sr.ARCHIVE).read_bytes(), (second / sr.ARCHIVE).read_bytes())
        self.assertEqual(sr.verify(root, result["releaseSHA256"]), result)
        output = self.root / "consumer"
        self.assertEqual(sr.extract(root, result["releaseSHA256"], output), result)
        for name in sr.ROLES: self.assertEqual((output / name).read_bytes(), (self.delivery / name).read_bytes())
        self.assertFalse(result["published"])
        with self.assertRaises(OSError): sr.extract(root, result["releaseSHA256"], output)
        with self.assertRaises(OSError): self.build()

    def test_wrong_anchors_and_corrupt_truncated_archive_remove_extraction(self):
        root, result = self.build(); path = root / sr.ARCHIVE; original = path.read_bytes()
        for contents in (original[:-1], original[:100], b"changed"):
            path.write_bytes(contents)
            with self.assertRaises(ValueError): sr.extract(root, result["releaseSHA256"], self.root / "failed")
            self.assertFalse((self.root / "failed").exists())
        path.write_bytes(original)
        with self.assertRaisesRegex(ValueError, "anchor"): sr.verify(root, "0" * 64)
        with self.assertRaises(ValueError): sr.build(self.delivery, "0" * 64, self.root / "bad-build")
        self.assertFalse((self.root / "bad-build").exists())

    def test_even_reanchored_transport_cannot_change_reviewed_payload(self):
        root, result = self.build(); path = root / sr.ARCHIVE
        with zipfile.ZipFile(path) as archive:
            entries = [(entry, archive.read(entry)) for entry in archive.infolist()]
        with zipfile.ZipFile(path, "w") as archive:
            for entry, data in entries:
                archive.writestr(entry, b"wrong service" if entry.filename == "compiler.wasm" else data)
        anchor = self.reanchor(root)
        with self.assertRaises(ValueError): sr.extract(root, anchor, self.root / "failed")
        self.assertFalse((self.root / "failed").exists())

    def test_duplicate_unsafe_missing_extra_and_link_members_are_rejected(self):
        root, result = self.build(); path = root / sr.ARCHIVE; original = path.read_bytes()
        with zipfile.ZipFile(path) as archive:
            entries = [(copy.copy(entry), archive.read(entry)) for entry in archive.infolist()]
        def renamed(items, name):
            items[0][0].filename = name; items[0][0].orig_filename = name
        for mutate in (lambda items: renamed(items, "../outside"), lambda items: renamed(items, "/outside"),
                       lambda items: renamed(items, items[1][0].filename), lambda items: items.pop(),
                       lambda items: items.append((zipfile.ZipInfo("extra"), b"extra")),
                       lambda items: setattr(items[0][0], "external_attr", (stat.S_IFLNK | 0o777) << 16)):
            changed = copy.deepcopy(entries); mutate(changed)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(path, "w") as archive:
                    for entry, data in changed: archive.writestr(entry, data)
            with self.assertRaises((ValueError, zipfile.BadZipFile)): sr.verify(root, self.reanchor(root))
            self.assertFalse((self.root / "outside").exists())
            path.write_bytes(original)

    def test_unsupported_compression_metadata_prefix_trailer_and_comment_are_rejected(self):
        root, result = self.build(); path = root / sr.ARCHIVE; original = path.read_bytes()
        with zipfile.ZipFile(path) as archive:
            entries = [(copy.copy(entry), archive.read(entry)) for entry in archive.infolist()]
        for field, value in (("compress_type", zipfile.ZIP_DEFLATED), ("extra", b"\x01\x02\x00\x00"),
                             ("date_time", (2020, 1, 1, 0, 0, 0)), ("comment", b"comment")):
            changed = copy.deepcopy(entries); setattr(changed[0][0], field, value)
            with zipfile.ZipFile(path, "w") as archive:
                for entry, data in changed: archive.writestr(entry, data)
            with self.assertRaises((ValueError, zipfile.BadZipFile)): sr.verify(root, self.reanchor(root))
        for contents in (b"prefix" + original, original + b"trailer"):
            path.write_bytes(contents)
            with self.assertRaises((ValueError, zipfile.BadZipFile)): sr.verify(root, self.reanchor(root))
        path.write_bytes(original)
        with zipfile.ZipFile(path, "a") as archive: archive.comment = b"comment"
        with self.assertRaises(ValueError): sr.verify(root, self.reanchor(root))

    def test_file_symlinks_extra_content_and_total_bound_are_rejected(self):
        root, result = self.build(); path = root / sr.ARCHIVE; original = path.read_bytes()
        path.unlink(); external = self.root / "external"; external.write_bytes(original); path.symlink_to(external)
        with self.assertRaises(ValueError): sr.verify(root, result["releaseSHA256"])
        path.unlink(); path.write_bytes(original)
        (root / "extra").write_bytes(b"extra")
        with self.assertRaises(ValueError): sr.verify(root, result["releaseSHA256"])
        (root / "extra").unlink()
        with patch.object(sr, "MAXIMUM", len(original) - 1):
            with self.assertRaises(ValueError): sr.verify(root, result["releaseSHA256"])

    def test_reanchored_release_cannot_promote_or_select_another_service_or_path(self):
        root, result = self.build(); path = root / "release.json"; original = sr.sb.read_json(path)
        for mutate in (lambda value: value.update(schema=True), lambda value: value.update(published=True),
                       lambda value: value.update(serviceSHA256="0" * 64),
                       lambda value: value["archive"].update(path="../outside"),
                       lambda value: value["archive"].update(bytes=True),
                       lambda value: value.update(deliveryManifestSHA256="0" * 64)):
            value = copy.deepcopy(original); mutate(value); path.write_bytes(sr.sb.json_bytes(value))
            with self.assertRaises(ValueError): sr.verify(root, sr.sb.file_record(path)["sha256"])

    def test_transport_changed_during_source_verification_cannot_return_stale_success(self):
        root, result = self.build()
        original = sr.sd.verify
        def change_transport(directory, expected):
            value = original(directory, expected)
            (root / sr.ARCHIVE).write_bytes(b"changed while checking corresponding source")
            return value
        with patch.object(sr.sd, "verify", side_effect=change_transport):
            with self.assertRaises(ValueError): sr.extract(root, result["releaseSHA256"], self.root / "failed")
        self.assertFalse((self.root / "failed").exists())

    def test_bounded_directory_and_local_header_corruption_cannot_hide_behind_reanchoring(self):
        root, result = self.build(); path = root / sr.ARCHIVE; original = path.read_bytes()
        for offset, payload in ((-12, struct.pack("<H", 65535)), (-10, struct.pack("<I", 20000)),
                                (28, struct.pack("<H", 1)), (6, struct.pack("<H", 1))):
            data = bytearray(original); start = offset if offset >= 0 else len(data) + offset
            data[start:start + len(payload)] = payload; path.write_bytes(data)
            with self.assertRaises((ValueError, zipfile.BadZipFile)): sr.verify(root, self.reanchor(root))
        # Same headers and length, wrong payload CRC: reject before accepting extracted files.
        data = bytearray(original)
        path.write_bytes(original)
        with zipfile.ZipFile(path) as archive:
            entry = archive.infolist()[0]
        data[entry.header_offset + 30 + len(entry.filename)] ^= 1
        path.write_bytes(data)
        with self.assertRaises(zipfile.BadZipFile): sr.extract(root, self.reanchor(root), self.root / "failed")
        self.assertFalse((self.root / "failed").exists())


if __name__ == "__main__":
    unittest.main(defaultTest="TransportTests")
