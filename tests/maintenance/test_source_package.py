"""Owned tiny raw sources and archives test production packaging gates; no compiler execution."""
import hashlib
import io
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools import source_package as sp
from tools import service_build as sb


class SourcePackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="firmingo-source-package-")
        self.root = Path(self.tmp.name).resolve()

    def tearDown(self):
        self.tmp.cleanup()

    def snapshot(self):
        root = self.root / "snapshot"; (root / "source/llvm").mkdir(parents=True)
        records = []
        for name, data, mode in (("llvm/source.cpp", b"// source fixture; NEVER DEPLOY\n", "100644"),
                                 ("llvm/tool.py", b"# generation fixture\n", "100755"),
                                 ("llvm/link.h", b"source.cpp", "120000")):
            path = root / "source" / name
            if mode == "120000":
                path.symlink_to(data.decode())
            else:
                path.write_bytes(data); path.chmod(0o755 if mode == "100755" else 0o644)
            records.append({"path": name, "mode": mode, "bytes": len(data), "sha256": sb.sha(data),
                            "gitBlob": hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()})
        manifest = {"schema": 1, "llvmCommit": "a"*40, "files": records}
        sb.write_json(root / "manifest.json", manifest)
        return root, {"llvmSourceRoot": str(root)}, {"llvmCommit": "a"*40, "sourcePaths": ["llvm"]}, manifest

    def test_raw_snapshot_verifies_git_blobs_modes_and_preserves_safe_file_links(self):
        root, config, recipe, manifest = self.snapshot()
        with patch.object(sb, "git", side_effect=AssertionError("packaged source must not access Git")):
            objects, provider = sb.llvm_source_inputs(config, recipe)
            output = self.root / "copied"
            self.assertEqual(sb.snapshot_llvm(provider, recipe, output, objects), manifest["files"])
        self.assertEqual((output / "llvm/link.h").read_bytes(), (root / "source/llvm/source.cpp").read_bytes())
        self.assertTrue((output / "llvm/link.h").is_symlink())
        self.assertTrue((output / "llvm/tool.py").stat().st_mode & 0o111)

    def test_raw_snapshot_rejects_drift_wrong_commit_duplicates_paths_and_blob_claims(self):
        root, config, recipe, manifest = self.snapshot()
        original = (root / "manifest.json").read_bytes()
        for change in (lambda m: m.update(llvmCommit="b"*40), lambda m: m["files"].append(m["files"][0]),
                       lambda m: m["files"][0].update(path="../escape"), lambda m: m["files"][0].update(gitBlob="b"*40)):
            value = sb.json.loads(original); change(value); (root / "manifest.json").write_bytes(sb.json_bytes(value))
            with self.assertRaises(ValueError):
                sb.llvm_source_inputs(config, recipe)
        (root / "manifest.json").write_bytes(original)
        (root / "source/llvm/source.cpp").write_bytes(b"drift")
        with self.assertRaisesRegex(ValueError, "Git blob"):
            sb.llvm_source_inputs(config, recipe)

    def test_raw_snapshot_rejects_file_mode_alias_and_escaping_link(self):
        root, config, recipe, _ = self.snapshot()
        path = root / "source/llvm/tool.py"; path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "mode mismatch"):
            sb.llvm_source_inputs(config, recipe)
        path.chmod(0o755)
        link = root / "source/llvm/link.h"; link.unlink(); link.symlink_to("../../outside")
        (root / "outside").write_text("external")
        with self.assertRaisesRegex(ValueError, "unsafe|escapes"):
            sb.llvm_source_inputs(config, recipe)

    def package(self):
        package = self.root / "package"; package.mkdir()
        (package / "source.cpp").write_text("// owned fixture\n")
        (package / "LICENSE").write_text("retained fixture notice\n\n")
        (package / "link.cpp").symlink_to("source.cpp")
        manifest = {"schema": 1, "operation": "candidate_corresponding_source_package", "sourceDateEpoch": 1781562833,
                    "distributionStatus": "unresolved", "serviceBinaryIncluded": False, "files": sp.file_inventory(package)}
        sb.write_json(package / "manifest.json", manifest)
        return package, manifest

    def test_archive_repeat_bytes_and_every_payload_verified_without_extraction(self):
        package, manifest = self.package()
        first, second = self.root / "first.tar.gz", self.root / "second.tar.gz"
        sp.create_archive(package, manifest, first); sp.create_archive(package, manifest, second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        verified = sp.verify_archive(first, sb.file_record(first)["sha256"])
        self.assertEqual(verified["files"], 3)
        self.assertEqual(verified["distributionStatus"], "unresolved")
        with self.assertRaisesRegex(ValueError, "anchor"):
            sp.verify_archive(first, "0"*64)
        with self.assertRaises(FileExistsError):
            sp.create_archive(package, manifest, first)
        manifest["schema"] = True
        (package / "manifest.json").write_bytes(sb.json_bytes(manifest))
        invalid = self.root / "boolean-schema.tar.gz"; sp.create_archive(package, manifest, invalid)
        with self.assertRaisesRegex(ValueError, "manifest"):
            sp.verify_archive(invalid, sb.file_record(invalid)["sha256"])

    def malicious_archive(self, members):
        path = self.root / "malicious.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name, data, kind, link in members:
                info = tarfile.TarInfo(name); info.type = kind; info.mode = 0o644
                info.size = len(data) if kind == tarfile.REGTYPE else 0; info.linkname = link
                archive.addfile(info, io.BytesIO(data) if info.isfile() else None)
        return path

    def test_anchored_archive_still_rejects_duplicate_paths_traversal_special_types_and_missing_manifest(self):
        for members in ([('firmingo-compiler-source/../outside', b'', tarfile.REGTYPE, '')],
                        [('wrong/file', b'', tarfile.REGTYPE, '')], [('firmingo-compiler-source/fifo', b'', tarfile.FIFOTYPE, '')],
                        [('firmingo-compiler-source/file', b'a', tarfile.REGTYPE, '')]*2,
                        [('firmingo-compiler-source/file', b'a', tarfile.REGTYPE, '')]):
            path = self.malicious_archive(members)
            with self.assertRaises(ValueError):
                sp.verify_archive(path, sb.file_record(path)["sha256"])

    def test_archive_rejects_payload_drift_extra_members_and_cyclic_links(self):
        package, manifest = self.package()
        (package / "source.cpp").write_text("changed")
        path = self.root / "changed.tar.gz"; sp.create_archive(package, manifest, path)
        with self.assertRaisesRegex(ValueError, "payload"):
            sp.verify_archive(path, sb.file_record(path)["sha256"])
        for record in manifest["files"]:
            if record["path"] == "link.cpp":
                record["link"] = "link.cpp"
        (package / "manifest.json").write_bytes(sb.json_bytes(manifest))
        path = self.root / "cycle.tar.gz"; sp.create_archive(package, manifest, path)
        with self.assertRaisesRegex(ValueError, "cyclic"):
            sp.verify_archive(path, sb.file_record(path)["sha256"])

    def test_package_preflight_failure_creates_no_output_and_configuration_is_closed(self):
        with patch.object(sp, "preflight", side_effect=ValueError("fixture anchor failure")):
            with self.assertRaisesRegex(ValueError, "anchor failure"):
                sp.build({}, self.root / "output")
        self.assertFalse((self.root / "output").exists())
        path = self.root / "config.json"; path.write_text('{"schema":1,"extra":true}')
        with self.assertRaisesRegex(ValueError, "configuration"):
            sp.configuration(path)

    def test_completed_build_rejects_wrong_anchor_and_input_manifest_drift(self):
        root = self.root / "completed"; root.mkdir()
        inputs = {"fixture": "not real compiler evidence"}; sb.write_json(root / "input-manifest.json", inputs)
        receipt = {"status": "built_owned_development_service", "distributionStatus": "unresolved",
                   "inputManifestSHA256": sb.file_record(root / "input-manifest.json")["sha256"]}
        sb.write_json(root / "operation.json", receipt)
        anchor = sb.file_record(root / "operation.json")["sha256"]
        self.assertEqual(sp.completed(root, anchor, receipt["status"])[2], inputs)
        with self.assertRaisesRegex(ValueError, "anchor"):
            sp.completed(root, "0"*64, receipt["status"])
        (root / "input-manifest.json").write_text('{"changed":true}')
        with self.assertRaisesRegex(ValueError, "manifest"):
            sp.completed(root, anchor, receipt["status"])

    def test_bounded_small_reader_rejects_growth_and_replacement_with_special_file(self):
        path = self.root / "small"; path.write_bytes(b"x")
        old = sb.file_record(path); path.write_bytes(b"x"*1024)
        with patch.object(sb, "file_record", return_value=old):
            with self.assertRaisesRegex(ValueError, "changed"):
                sb.read_small(path, 1)
            path.unlink(); os.mkfifo(path)
            with self.assertRaisesRegex(ValueError, "regular file"):
                sb.read_small(path, 1)

    def test_custom_materials_reject_unlisted_files_links_and_changed_license_text(self):
        import shutil
        root = self.root / "custom"
        shutil.copytree(sb.OWNED_SOURCE_ROOT, root)
        grant = sb.read_json(root / "manifest.json")
        custom = [{key: item[key] for key in ("path", "role", "bytes", "sha256")} for item in grant["files"]]
        with patch.object(sb, "OWNED_SOURCE_ROOT", root):
            sp.verify_custom_materials(grant, custom)
            extra = root / "unlisted.wasm"; extra.write_bytes(b"not an executable fixture")
            with self.assertRaisesRegex(ValueError, "unlisted"):
                sp.verify_custom_materials(grant, custom)
            extra.unlink()
            source = root / custom[0]["path"]; data = source.read_bytes()
            outside = self.root / "alias.patch"; outside.write_bytes(data); source.unlink(); source.symlink_to(outside)
            with self.assertRaisesRegex(ValueError, "unsafe|escapes|aliased"):
                sp.verify_custom_materials(grant, custom)
            source.unlink(); source.write_bytes(data)
            (root / "LICENSE").write_text("changed license")
            with self.assertRaisesRegex(ValueError, "license"):
                sp.verify_custom_materials(grant, custom)


if __name__ == "__main__":
    unittest.main()
