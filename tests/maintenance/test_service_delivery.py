"""Tiny source/byte fixtures exercise paired-delivery gates, never compiler execution or license clearance."""
import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools import service_delivery as sd
from tools import source_package as sp
from tools import service_build as sb


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="firmingo-delivery-fixture-")
        self.root = Path(self.tmp.name)
        self.repo = self.root / "repo"; self.repo.mkdir()
        self.service = self.root / "service"; self.service.mkdir()
        package = self.root / "source"; package.mkdir()
        (package / "README").write_bytes(b"source fixture, NEVER DEPLOY\n")
        source_manifest = {"schema": 1, "operation": "candidate_corresponding_source_package", "sourceDateEpoch": 1,
                           "distributionStatus": "unresolved", "serviceBinaryIncluded": False, "files": sp.file_inventory(package)}
        sb.write_json(package / "manifest.json", source_manifest)
        self.archive = self.root / "source.tar.gz"; sp.create_archive(package, source_manifest, self.archive)
        (self.service / "compiler.wasm").write_bytes(b"nonexecutable byte fixture, NEVER DEPLOY")
        sb.write_json(self.service / "input-manifest.json", {"fixture": True})
        inputs_sha = sb.file_record(self.service / "input-manifest.json")["sha256"]
        sb.write_json(self.service / "operation.json", {"status": "built_owned_development_service", "inputManifestSHA256": inputs_sha})
        notices = self.repo / "third_party/service-notice-review"; notices.mkdir(parents=True)
        for name in ("FILE-NOTICES.txt", "LICENSES.txt"):
            (notices / name).write_bytes(b"fixture notice\n")
        sb.write_json(notices / "manifest.json", {"files": [{"path": name, **sb.file_record(notices / name)} for name in ("FILE-NOTICES.txt", "LICENSES.txt")]})
        (self.repo / "proof.json").write_bytes(b"fixture proof")
        (self.repo / "LICENSE").write_bytes(b"fixture license")
        docs = self.repo / "service/delivery"; docs.mkdir(parents=True)
        for name in ("README.md", "BUILDING.md"):
            (docs / name).write_bytes(b"fixture documentation")
        value = {"id": "fixture-only", "distributionStatus": "reviewed-paired-delivery", "source": {**sb.file_record(self.archive), "files": 1, "completeCorrespondingSource": True},
                 "service": {**sb.file_record(self.service / "compiler.wasm"), "abi": 2, "maximumMemoryBytes": 268435456},
                 "buildReceiptSHA256": sb.file_record(self.service / "operation.json")["sha256"], "buildInputsSHA256": inputs_sha,
                 "proof": {"path": "proof.json", **sb.file_record(self.repo / "proof.json")},
                 "noticeManifest": {"path": "third_party/service-notice-review/manifest.json", **sb.file_record(notices / "manifest.json")}}
        review = self.repo / "service/delivery-review.json"; sb.write_json(review, value)
        self.patches = [patch.object(sd, "ROOT", self.repo), patch.object(sd, "REVIEW", review), patch.object(sd, "REVIEW_SHA256", sb.file_record(review)["sha256"])]
        for p in self.patches: p.start()

    def tearDown(self):
        for p in reversed(self.patches): p.stop()
        self.tmp.cleanup()

    def build(self):
        output = self.root / "delivery"
        result = sd.build(self.service, self.archive, output)
        return output, result

    def test_repeat_pairing_verifies_every_source_member_and_observed_copy(self):
        root, result = self.build()
        second = sd.build(self.service, self.archive, self.root / "second")
        self.assertEqual(result, second)
        self.assertEqual(result["files"], 9)
        self.assertFalse(result["published"])
        self.assertEqual(sd.verify(root, result["manifestSHA256"]), result)
        with self.assertRaisesRegex(ValueError, "new"):
            sd.build(self.service, self.archive, root)

    def test_wrong_receipt_review_source_and_notice_fail_before_output(self):
        for path in (self.service / "operation.json", sd.REVIEW, self.archive, self.repo / "third_party/service-notice-review/LICENSES.txt"):
            original = path.read_bytes(); path.write_bytes(b"changed")
            with self.assertRaises(ValueError): self.build()
            self.assertFalse((self.root / "delivery").exists()); path.write_bytes(original)

    def test_corrupt_or_missing_binary_source_and_credit_prevent_success(self):
        root, result = self.build()
        for name in ("compiler.wasm", "compiler-source.tar.gz", "FILE-NOTICES.txt", "LICENSES.txt", "BUILDING.md"):
            path = root / name; original = path.read_bytes(); path.write_bytes(b"changed")
            with self.assertRaises(ValueError): sd.verify(root, result["manifestSHA256"])
            path.unlink()
            with self.assertRaises(OSError): sd.verify(root, result["manifestSHA256"])
            path.write_bytes(original)

    def test_wrong_anchor_symlink_and_unlisted_file_are_rejected(self):
        root, result = self.build()
        with self.assertRaisesRegex(ValueError, "anchor"): sd.verify(root, "0" * 64)
        (root / "extra").write_bytes(b"unlisted")
        with self.assertRaisesRegex(ValueError, "unlisted"): sd.verify(root, result["manifestSHA256"])
        (root / "extra").unlink()
        path = root / "compiler.wasm"; data = path.read_bytes(); path.unlink()
        external = self.root / "external"; external.write_bytes(data); path.symlink_to(external)
        with self.assertRaises(ValueError): sd.verify(root, result["manifestSHA256"])

    def test_binary_change_during_source_verification_is_not_a_stale_success(self):
        root, result = self.build()
        verify_source = sd.sp.verify_archive
        def changing_source(path, expected):
            value = verify_source(path, expected)
            (root / "compiler.wasm").write_bytes(b"changed during longer source verification")
            return value
        with patch.object(sd.sp, "verify_archive", side_effect=changing_source):
            with self.assertRaisesRegex(ValueError, "reviewed identity"):
                sd.verify(root, result["manifestSHA256"])

    def test_reanchored_manifest_cannot_change_approved_identity_or_roles(self):
        root, result = self.build(); path = root / "manifest.json"; original = sb.read_json(path)
        for change in (lambda m: m.update(schema=True), lambda m: m.update(serviceABI=True), lambda m: m.update(published=True),
                       lambda m: m.update(reviewSHA256="0" * 64), lambda m: m["files"].pop(), lambda m: m["files"][0].update(path="../outside")):
            value = copy.deepcopy(original); change(value); path.write_bytes(sb.json_bytes(value))
            with self.assertRaises(ValueError): sd.verify(root, sb.file_record(path)["sha256"])


if __name__ == "__main__":
    unittest.main()
