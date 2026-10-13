"""Owned tiny archives/receipts exercise maintenance boundaries; no WASM fixture is executed."""
import io
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools import runtime_build as rb
from tools import service_build as sb


class RuntimeBuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="firmingo-runtime-maintenance-")
        self.root = Path(self.tmp.name).resolve()

    def tearDown(self):
        self.tmp.cleanup()

    def archive(self, members):
        path = self.root / "fixture.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name, content, kind in members:
                member = tarfile.TarInfo(name); member.type = kind
                member.size = len(content) if kind == tarfile.REGTYPE else 0
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    member.linkname = "../../outside"
                archive.addfile(member, io.BytesIO(content) if member.size else None)
        return path, {"root": "source", "sha256": sb.file_record(path)["sha256"]}

    def test_pinned_regular_archive_snapshots_bytes_and_preserves_notice(self):
        path, pin = self.archive([("source/", b"", tarfile.DIRTYPE), ("source/LICENSE", b"upstream notice\n\n", tarfile.REGTYPE),
                                  ("source/sub/file.c", b"// synthetic source\n", tarfile.REGTYPE)])
        before = path.read_bytes(); output = self.root / "output"
        records = rb.unpack(path, pin, output)
        self.assertEqual((output / "LICENSE").read_bytes(), b"upstream notice\n\n")
        self.assertEqual([record["path"] for record in records], ["LICENSE", "sub/file.c"])
        self.assertEqual(path.read_bytes(), before)
        with self.assertRaises(FileExistsError):
            rb.unpack(path, pin, output)

    def test_wrong_archive_anchor_rejects_before_creating_output(self):
        path, pin = self.archive([("source/file", b"data", tarfile.REGTYPE)])
        pin["sha256"] = "0" * 64; output = self.root / "output"
        with self.assertRaisesRegex(ValueError, "pinned SHA"):
            rb.unpack(path, pin, output)
        self.assertFalse(output.exists())

    def test_traversal_links_devices_and_duplicates_reject_without_output(self):
        for members in ([('source/../outside', b'', tarfile.REGTYPE)], [("/source/file", b'', tarfile.REGTYPE)],
                        [("wrong/file", b'', tarfile.REGTYPE)], [("source/link", b'', tarfile.SYMTYPE)],
                        [("source/link", b'', tarfile.LNKTYPE)], [("source/fifo", b'', tarfile.FIFOTYPE)],
                        [("source/file", b'', tarfile.REGTYPE), ("source/file", b'', tarfile.REGTYPE)]):
            with self.subTest(members=members):
                path, pin = self.archive(members); output = self.root / "output"
                with self.assertRaises(ValueError):
                    rb.unpack(path, pin, output)
                self.assertFalse(output.exists())

    def test_archive_size_bound_and_failed_capture_leave_no_success(self):
        path, pin = self.archive([("source/file", b"data", tarfile.REGTYPE)])
        with patch.object(rb, "MAX_ARCHIVE", 1):
            with self.assertRaisesRegex(ValueError, "bounded"):
                rb.unpack(path, pin, self.root / "output")
        output = self.root / "build"
        with patch.object(rb, "capture", return_value=({"unexpected": True}, {})):
            with self.assertRaisesRegex(ValueError, "reviewed anchor"):
                rb.build({}, "0" * 64, output, 4)
        self.assertFalse(output.exists())
        with self.assertRaisesRegex(ValueError, "1..16"):
            rb.build({}, "0" * 64, output, 17)

    def test_configuration_rejects_missing_tools_lists_and_nonliteral_paths(self):
        config = {"schema": 1, "llvmGit": "/explicit/git", "nativeResourceDirectory": "/explicit/resources",
                  "cmakeModules": "/explicit/cmake", "pythonStandardLibrary": "/explicit/python",
                  "dependencyInspector": "/usr/bin/otool", "components": {"first": "/explicit/a", "second": "/explicit/b"},
                  "archives": {"libc": "/explicit/libc.tar.gz", "wasiHeaders": "/explicit/wasi.tar.gz"},
                  "tools": {key: "/explicit/" + key for key in rb.TOOLS}}
        path = self.root / "config.json"
        def save(value):
            path.write_bytes(sb.json_bytes(value))
        save(config); self.assertEqual(rb.configuration(path), config)
        for change in ({"tools": []}, {"archives": []}, {"components": []}, {"llvmGit": "/bad;list"},
                       {"nativeResourceDirectory": "relative"}, {"schema": True}, {"extra": True}):
            with self.subTest(change=change):
                save({**config, **change})
                with self.assertRaises(ValueError):
                    rb.configuration(path)

    def receipt(self, name):
        root = self.root / name; root.mkdir()
        inventory = {}
        for role in ("sysroot", "resources"):
            (root / role).mkdir(); (root / role / "fixture.a").write_bytes(b"non-executable receipt fixture")
            inventory[role], _ = sb.tree_records(root / role, {"owned": root})
        inputs = {"schema": 1, "note": "synthetic, never deploy"}
        for filename, data in (("input-manifest.json", inputs), ("output-files.json", inventory),
                               ("operation.json", {"status": "built_owned_wasip1_runtime", "inputManifestSHA256": sb.identity(inputs),
                                 "outputInventorySHA256": sb.identity(inventory), "outputFiles": {role: 1 for role in inventory}})):
            sb.write_json(root / filename, data)
        return root

    def test_repeat_compares_observed_bytes_and_rejects_extra_missing_corrupt_inputs(self):
        first, second = self.receipt("first"), self.receipt("second")
        self.assertEqual(rb.compare(first, second)["status"], "identical_owned_runtime_builds")
        path = second / "sysroot/fixture.a"; original = path.read_bytes(); path.write_bytes(b"corrupted")
        with self.assertRaisesRegex(ValueError, "output bytes"):
            rb.compare(first, second)
        path.write_bytes(original); (second / "resources/extra.a").write_bytes(b"extra")
        with self.assertRaisesRegex(ValueError, "output bytes"):
            rb.compare(first, second)
        (second / "resources/extra.a").unlink(); path.unlink()
        with self.assertRaisesRegex(ValueError, "output bytes|input tree is empty"):
            rb.compare(first, second)
        path.write_bytes(original); (second / "input-manifest.json").write_text('{"schema":2}\n')
        with self.assertRaisesRegex(ValueError, "receipt identity"):
            rb.compare(first, second)

    def test_unfinished_or_changed_output_receipt_cannot_pass_repeat_check(self):
        first, second = self.receipt("first"), self.receipt("second")
        (second / "operation.json").unlink()
        with self.assertRaises(OSError):
            rb.compare(first, second)
        sb.write_json(second / "operation.json", {"status": "failed_owned_runtime_build"})
        with self.assertRaisesRegex(ValueError, "receipt identity"):
            rb.compare(first, second)
        (second / "operation.json").unlink()
        result = sb.read_json(first / "operation.json"); result["outputInventorySHA256"] = "0" * 64
        sb.write_json(second / "operation.json", result)
        with self.assertRaisesRegex(ValueError, "receipt identity"):
            rb.compare(first, second)

    def test_build_phase_failure_retains_log_and_failure_without_success(self):
        archive, pin = self.archive([("source/CMakeLists.txt", b"# owned fixture\n", tarfile.REGTYPE)])
        recipe = {"archives": {"libc": pin, "wasiHeaders": pin}}
        manifest = {"recipe": recipe, "llvmSources": [], "nativeHeaders": [],
                    "cmakeModules": [], "pythonStandardLibrary": [], "maintenance": []}
        config = {"llvmGit": self.root, "archives": {key: archive for key in recipe["archives"]},
                  "tools": {key: "/explicit/" + key for key in rb.TOOLS}}
        locators = {key: {} for key in ("nativeHeaders", "cmakeModules", "pythonStandardLibrary")}
        output = self.root / "failed-build"
        def fail(arguments, root, name):
            (root / name).write_text("synthetic configure failure\n")
            raise ValueError("fixture phase failed")
        def export(*args):
            args[2].mkdir(); return []
        with patch.object(rb, "capture", return_value=(manifest, locators)), \
                patch.object(sb, "export_git", side_effect=export), patch.object(sb, "execute", side_effect=fail):
            with self.assertRaisesRegex(ValueError, "fixture phase"):
                rb.build(config, sb.identity(manifest), output, 4)
        self.assertTrue((output / "builtins-configure.log").is_file())
        self.assertEqual(sb.read_json(output / "failure.json")["status"], "failed_owned_runtime_build")
        self.assertFalse((output / "operation.json").exists())

    def test_explicit_toolchain_and_clean_environment_prevent_user_override(self):
        tools = {name: "/explicit/" + name for name in rb.TOOLS}
        chain = rb.toolchain(self.root, tools, self.root / "sysroot", self.root / "resources").read_text()
        self.assertIn("--no-default-config", chain); self.assertIn("-mcpu=lime1", chain)
        self.assertIn("CMAKE_FIND_USE_SYSTEM_ENVIRONMENT_PATH [[OFF]]", chain)
        self.assertIn("CMAKE_AR [[/explicit/ar]]", chain)
        spaced = self.root / "path with spaces"; spaced.mkdir()
        chain = rb.toolchain(spaced, tools, spaced / "sysroot", spaced / "resources").read_text()
        self.assertIn("'-resource-dir=", chain)
        with patch.dict(os.environ, {"CPATH": "/bad", "LIBRARY_PATH": "/bad", "SDKROOT": "/bad", "CFLAGS": "-bad"}):
            env = sb.clean_environment(self.root)
            for key in ("CPATH", "LIBRARY_PATH", "SDKROOT", "CFLAGS"):
                self.assertNotIn(key, env)

    def test_isolated_generator_uses_only_pinned_local_package_and_checks_context(self):
        source = self.root / "source"; utils = source / "libcxx/utils"
        package = utils / "libcxx"; package.mkdir(parents=True)
        (package / "header_information.py").write_text('VALUE = "owned fixture"\n')
        script = utils / "generate_iwyu_mapping.py"
        script.write_text('import libcxx.header_information\nprint(libcxx.header_information.VALUE)\n')
        original = script.read_bytes(); rb.adapt_libcxx(source, self.root)
        result = sb.metadata([sys.executable, "-I", "-S", "-B", script])
        self.assertEqual(result, b"owned fixture\n")
        receipt = sb.read_json(self.root / "libcxx-adaptation.json")
        self.assertEqual(receipt["beforeSHA256"], sb.sha(original))
        self.assertEqual(receipt["after"], sb.file_record(script))
        self.assertFalse((package / "__pycache__").exists())
        script.write_text("# changed context\n")
        with self.assertRaisesRegex(ValueError, "context differs"):
            rb.adapt_libcxx(source, self.root)


if __name__ == "__main__":
    unittest.main()
