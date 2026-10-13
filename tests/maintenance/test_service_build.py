"""Own synthetic sources/tools exercise actual maintenance gates, never native LLVM or real service execution."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools import service_build as sb


def uleb(value):
    output = bytearray()
    while True:
        output.append((value & 127) | (128 if value >> 7 else 0))
        value >>= 7
        if not value:
            return bytes(output)


def fake_wasm(exports):
    """Static wasm metadata with a dummy ABI-return function; no fixture code is executed."""
    def section(number, data):
        return bytes([number]) + uleb(len(data)) + data
    entries = []
    for name in ["_initialize", *exports, "memory"]:
        encoded = name.encode()
        entries.append(uleb(len(encoded)) + encoded + bytes([2 if name == "memory" else 0, 0]))
    return (b"\0asm\x01\0\0\0" + section(1, b"\x01\x60\0\x01\x7f") + section(3, b"\x01\0")
            + section(5, b"\x01\x01\x01" + uleb(4096)) + section(7, uleb(len(entries)) + b"".join(entries))
            + section(10, b"\x01\x04\0\x41\x02\x0b"))


def git(root, *args):
    env = sb.clean_environment()
    return subprocess.check_output(["/usr/bin/git", "-c", "core.hooksPath=" + os.devnull,
                                   "-c", "commit.gpgsign=false", "-C", str(root), *args], env=env).decode().strip()


class ServiceBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="firmingo-service-maintenance-")
        self.root = Path(self.temporary.name).resolve()
        self.reference, self.llvm = self.root / "reference", self.root / "llvm-git"
        for root in (self.reference, self.llvm):
            root.mkdir(); git(root, "init", "-b", "main")
        (self.llvm / "llvm").mkdir()
        (self.llvm / "llvm/Example.cpp").write_text("base\n")
        (self.llvm / "llvm/link.h").symlink_to("Example.cpp")
        git(self.llvm, "add", ".")
        git(self.llvm, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "source fixture; NEVER DEPLOY")
        llvm_commit = git(self.llvm, "rev-parse", "HEAD")
        source = {"Sources/ArduinoCompilerService.cpp": b"// synthetic service; NEVER DEPLOY\n",
                  "Patches/0001.patch": b"diff --git a/llvm/Example.cpp b/llvm/Example.cpp\n--- a/llvm/Example.cpp\n+++ b/llvm/Example.cpp\n@@ -1 +1 @@\n-base\n+patched\n"}
        records = []
        for name, data in source.items():
            path = self.reference / sb.SERVICE_PREFIX / name
            path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            records.append({"path": sb.SERVICE_PREFIX + name, "role": "patch" if name.endswith("patch") else "source",
                            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        git(self.reference, "add", ".")
        git(self.reference, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "reference fixture; NEVER DEPLOY")
        pins = {"referenceCommit": git(self.reference, "rev-parse", "HEAD"), "files": records,
                "referenceRootLicense": "synthetic fixture, not a distribution decision"}
        self.pins_path = self.root / "pins.json"; self.pins_path.write_text(json.dumps(pins))
        recipe = sb.read_json(sb.RECIPE_PATH)
        recipe.update(llvmCommit=llvm_commit, sourcePaths=["llvm"], sources=["Sources/ArduinoCompilerService.cpp"])
        self.recipe_path = self.root / "recipe.json"; self.recipe_path.write_text(json.dumps(recipe))
        self.wasm = fake_wasm(recipe["exports"])
        component = self.root / "component"; component.mkdir()
        sysroot = component / "sysroot"; (sysroot / "lib/wasm32-wasip1").mkdir(parents=True)
        for name in ("libc.a", "libc++.a", "libc++abi.a", "crt1-reactor.o", "libwasi-emulated-mman.a"):
            (sysroot / "lib/wasm32-wasip1" / name).write_bytes(b"non-executable library fixture")
        resources = component / "resources"; (resources / "lib/wasm32-unknown-wasip1").mkdir(parents=True)
        (resources / "lib/wasm32-unknown-wasip1/libclang_rt.builtins.a").write_bytes(b"dummy builtins")
        (component / "LICENSE").write_text("synthetic component fixture\n")
        for name in ("cmakeModules", "pythonStandardLibrary"):
            folder = component / name; folder.mkdir(); (folder / "Fixture.txt").write_text("NEVER DEPLOY")
        second = self.root / "second-component"; second.mkdir()
        tools = {}
        for name in sb.TOOLS:
            if name == "node":
                tools[name] = shutil_which_node()
                continue
            path = self.root / (name + "-fixture-tool")
            version = "4.4.0" if name == "cmake" else "1.13.2" if name == "ninja" else "22.1.8"
            code = f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\nargs=sys.argv[1:]\nif args == ['--version']:\n print('{version}')\n"
            if name == "cmake":
                code += "elif '-B' in args:\n p=Path(args[args.index('-B')+1]); (p/'lib').mkdir(parents=True); (p/'lib/libLLVMFixture.a').write_bytes(b'NEVER DEPLOY')\n for n in ['include','tools/clang/include','tools/lld/include']:\n  d=p/n; d.mkdir(parents=True); (d/'Generated.h').write_bytes(b'fixture header')\n"
            if name == "clangxx":
                code += f"elif '-o' in args:\n Path(args[args.index('-o')+1]).write_bytes(bytes.fromhex('{self.wasm.hex()}'))\n"
            path.write_text(code); path.chmod(0o755); tools[name] = str(path)
        inspector = self.root / "inspector"
        inspector.write_text("#!/bin/sh\nprintf 'fixture:\\n'\n"); inspector.chmod(0o755)
        self.config = {"schema": 1, "referenceRoot": str(self.reference), "llvmGit": str(self.llvm), "sysroot": str(sysroot),
                       "resourceDirectory": str(resources), "components": {"fixture": str(component), "second": str(second)},
                       "cmakeModules": str(component / "cmakeModules"), "pythonStandardLibrary": str(component / "pythonStandardLibrary"),
                       "tools": tools, "dependencyInspector": str(inspector)}
        self.config_path = self.root / "config.json"; self.save_config()
        self.patches = [patch.object(sb, "REFERENCE_PATH", self.pins_path), patch.object(sb, "RECIPE_PATH", self.recipe_path),
                        patch.object(sb, "python_library_directory", return_value=(component / "pythonStandardLibrary").resolve()),
                        patch.object(sb, "cmake_module_directory", return_value=(component / "cmakeModules").resolve()),
                        patch.object(sb.platform, "system", return_value="Darwin")]
        for item in self.patches:
            item.start()
        self.addCleanup(self.cleanup)

    def cleanup(self):
        for item in reversed(self.patches):
            item.stop()
        self.temporary.cleanup()

    def save_config(self):
        self.config_path.write_text(json.dumps(self.config))

    def captured(self):
        return sb.capture(self.config)[0]

    def test_capture_is_deterministic_and_inventory_anchor_hashes_actual_file_bytes(self):
        before = git(self.reference, "status", "--short")
        first, second = self.captured(), self.captured()
        self.assertEqual(first, second)
        output = self.root / "capture"
        summary = sb.capture_command(self.config_path, output)
        self.assertEqual(summary["inputManifestSHA256"], hashlib.sha256((output / "input-manifest.json").read_bytes()).hexdigest())
        self.assertEqual(summary["distributionStatus"], "unresolved")
        self.assertEqual(git(self.reference, "status", "--short"), before)
        self.assertEqual(git(self.llvm, "status", "--short"), "")

    def test_owned_build_snapshots_source_applies_patch_and_preserves_reference(self):
        anchor = sb.identity(self.captured())
        output = self.root / "owned"
        result = sb.build_command(self.config_path, anchor, output, 2)
        self.assertEqual(result["status"], "built_owned_development_service")
        self.assertEqual((output / "llvm-source/llvm/Example.cpp").read_text(), "patched\n")
        self.assertEqual((output / "llvm-source/llvm/link.h").read_text(), "patched\n")
        self.assertEqual((self.llvm / "llvm/Example.cpp").read_text(), "base\n")
        self.assertEqual(git(self.reference, "status", "--short"), "")
        self.assertEqual(git(self.llvm, "status", "--short"), "")
        commands = sb.read_json(output / "commands.json")
        self.assertIn("--no-default-config", commands[-1])
        self.assertIn("-Wl,--max-memory=268435456", commands[-1])
        self.assertNotIn("main.cpp", " ".join(commands[-1]))
        self.assertEqual(sb.read_json(output / "module-inspection.json")["instantiated"], False)
        self.assertTrue((output / "maintenance/tools/inspect-service.mjs").is_file())
        with self.assertRaises(FileExistsError):
            sb.build_command(self.config_path, anchor, output, 2)

    def test_stale_anchor_and_source_or_library_drift_reject_before_output(self):
        manifest = self.captured(); anchor = sb.identity(manifest)
        with self.assertRaisesRegex(ValueError, "anchor"):
            sb.build_command(self.config_path, "0" * 64, self.root / "bad-anchor", 2)
        self.assertFalse((self.root / "bad-anchor").exists())
        library = Path(self.config["sysroot"]) / "lib/wasm32-wasip1/libc.a"
        library.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "anchor"):
            sb.build_command(self.config_path, anchor, self.root / "drift", 2)
        self.assertFalse((self.root / "drift").exists())
        source = self.reference / sb.SERVICE_PREFIX / "Sources/ArduinoCompilerService.cpp"
        source.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "pin"):
            self.captured()

    def test_snapshot_inside_parent_repository_does_not_skip_patches_or_modify_parent(self):
        git(self.root, "init", "-b", "main")
        marker = self.root / "outside.cpp"; marker.write_text("parent repository input\n")
        anchor = sb.identity(self.captured()); output = self.root / "nested-owned"
        sb.build_command(self.config_path, anchor, output, 2)
        self.assertEqual((output / "llvm-source/llvm/Example.cpp").read_text(), "patched\n")
        self.assertEqual(marker.read_text(), "parent repository input\n")

    def test_paths_closed_config_duplicate_json_and_unexpected_tool_version_reject(self):
        for name in ("../x", "/x", "a//b", "a/./b", "a\\b", "a\n"):
            with self.assertRaises(ValueError):
                sb.path_name(name)
        self.config_path.write_text('{"schema":1,"schema":1}')
        with self.assertRaisesRegex(ValueError, "duplicate"):
            sb.load_configuration(self.config_path)
        self.config["extra"] = "unsafe"
        self.save_config()
        with self.assertRaises(ValueError):
            sb.load_configuration(self.config_path)
        del self.config["extra"]
        tool = Path(self.config["tools"]["clang"])
        tool.write_text("#!/bin/sh\necho 23.0.0\n")
        with self.assertRaisesRegex(ValueError, "tool version"):
            self.captured()

    def test_symlink_escape_cycle_special_file_and_size_bounds_reject(self):
        tree = Path(self.config["sysroot"])
        outside = self.root / "outside"; outside.write_text("outside")
        link = tree / "escape"; link.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.captured()
        link.unlink(); link.symlink_to(tree)
        with self.assertRaisesRegex(ValueError, "cyclic"):
            self.captured()
        link.unlink()
        fifo = tree / "fifo"; os.mkfifo(fifo)
        with self.assertRaises(ValueError):
            sb.file_record(fifo)
        fifo.unlink()
        with self.assertRaises(ValueError):
            sb.file_record(outside, 1)

    def test_failed_configure_preserves_log_failure_and_has_no_success_marker(self):
        tool = Path(self.config["tools"]["cmake"])
        tool.write_text("#!/bin/sh\nif [ \"$1\" = --version ]; then echo 4.4.0; else echo 'expected fixture failure'; exit 7; fi\n")
        anchor = sb.identity(self.captured()); output = self.root / "failed"
        with self.assertRaisesRegex(ValueError, "phase failed"):
            sb.build_command(self.config_path, anchor, output, 2)
        self.assertFalse((output / "operation.json").exists())
        self.assertIn("expected fixture failure", (output / "configure.log").read_text())
        self.assertEqual(sb.read_json(output / "failure.json")["status"], "failed_owned_service_build")

    def test_compare_checks_completed_receipts_and_actual_bytes_not_just_declared_hashes(self):
        first, second = self.root / "first", self.root / "second"
        anchor = sb.identity(self.captured())
        for output in (first, second):
            sb.build_command(self.config_path, anchor, output, 2)
        self.assertEqual(sb.compare_command(first, second)["status"], "byte_identical_owned_service_rebuilds")
        (second / "compiler.wasm").write_bytes(b"corrupt")
        with self.assertRaisesRegex(ValueError, "receipt"):
            sb.compare_command(first, second)
        receipt = sb.read_json(second / "operation.json")
        receipt["module"].update(sb.file_record(second / "compiler.wasm"))
        (second / "operation.json").write_bytes(sb.json_bytes(receipt))
        with self.assertRaisesRegex(ValueError, "repeat service builds differ"):
            sb.compare_command(first, second)
        (second / "input-manifest.json").write_text("changed manifest")
        with self.assertRaisesRegex(ValueError, "input manifest"):
            sb.compare_command(first, second)

    def test_clean_environment_does_not_inherit_config_header_library_or_sdk_overrides(self):
        with patch.dict(os.environ, {"CPATH": "/unsafe", "LIBRARY_PATH": "/unsafe", "SDKROOT": "/unsafe", "CXX": "/unsafe"}):
            env = sb.clean_environment(self.root)
        for name in ("CPATH", "LIBRARY_PATH", "SDKROOT", "CXX"):
            self.assertNotIn(name, env)
        self.assertEqual(env["CLANG_NO_DEFAULT_CONFIG"], "1")
        self.assertEqual(env["GIT_NO_LAZY_FETCH"], "1")
        self.assertEqual(env["SOURCE_DATE_EPOCH"], "1781562833")


def shutil_which_node():
    import shutil
    path = shutil.which("node")
    if not path:
        raise RuntimeError("Maintenance tests require pinned Node 22.12.0")
    return path


if __name__ == "__main__":
    unittest.main()
