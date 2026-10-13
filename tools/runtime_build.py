#!/usr/bin/env python3
"""Explicit source-only WASI Preview 1 runtime maintenance; no installs outside a new output."""
import argparse
import os
from pathlib import Path
import re
import shlex
import shutil
import sys
import tarfile

# Isolated Python deliberately does not put the script's directory on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools import service_build as sb

RECIPE = sb.ROOT / "service/runtime-recipe.json"
TOOLS = {"clang": "22.1.8", "clangxx": "22.1.8", "ar": "22.1.8", "ranlib": "22.1.8",
         "nm": "22.1.8", "linker": "22.1.8", "cmake": "4.4.0", "ninja": "1.13.2"}
MAX_ARCHIVE = 8 * 1024 * 1024


def unpack(archive, pin, output):
    """Verify before parsing; reject links, devices, duplicate files and oversized expansions."""
    record = sb.file_record(archive, MAX_ARCHIVE)
    if record["sha256"] != pin["sha256"]:
        raise ValueError("archive differs from pinned SHA-256")
    entries, names, total = [], set(), 0
    with tarfile.open(archive, "r:gz") as source:
        for member in source:
            name = member.name.rstrip("/")
            sb.path_name(name)
            if name != pin["root"] and not name.startswith(pin["root"] + "/"):
                raise ValueError("archive root differs from pin")
            if name in names or not (member.isfile() or member.isdir()):
                raise ValueError("duplicate or unsupported archive entry")
            names.add(name); total += member.size
            if member.size > 16 * 1024 * 1024 or total > 128 * 1024 * 1024 or len(names) > 20000:
                raise ValueError("archive expansion exceeds bound")
            if member.isfile():
                entries.append(member)
        output.mkdir()
        records = []
        for member in entries:
            name = member.name[len(pin["root"]) + 1:]
            sb.path_name(name)
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.extractfile(member) as data, target.open("xb") as destination:
                shutil.copyfileobj(data, destination, 1024 * 1024)
            target.chmod(0o755 if member.mode & 0o111 else 0o644)
            records.append({"path": name, **sb.file_record(target)})
    if sb.file_record(archive, MAX_ARCHIVE) != record:
        raise ValueError("source archive changed while extracting")
    return sorted(records, key=lambda item: item["path"])


def configuration(path):
    config = sb.read_json(path)
    keys = {"schema", "llvmGit", "archives", "nativeResourceDirectory", "cmakeModules",
            "pythonStandardLibrary", "components", "tools", "dependencyInspector"}
    if not isinstance(config, dict) or set(config) != keys or type(config["schema"]) is not int or config["schema"] != 1:
        raise ValueError("unsupported runtime build configuration")
    if not isinstance(config["tools"], dict) or not isinstance(config["archives"], dict) or set(config["tools"]) != set(TOOLS) or set(config["archives"]) != {"libc", "wasiHeaders"}:
        raise ValueError("select all explicit tools and pinned archives")
    if not isinstance(config["components"], dict) or not 2 <= len(config["components"]) <= 16:
        raise ValueError("select explicit bootstrap component roots")
    for name in config["components"]:
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", name):
            raise ValueError("invalid component label")
    paths = [config[name] for name in keys - {"schema", "archives", "components", "tools"}]
    paths += list(config["tools"].values()) + list(config["components"].values()) + list(config["archives"].values())
    if any(not isinstance(path, str) or len(path) > 4096 or ";" in path or not Path(path).is_absolute() or any(ord(c) < 32 for c in path) for path in paths):
        raise ValueError("select absolute explicit input locators")
    return config


def capture(config):
    recipe = sb.read_json(RECIPE)
    components = {key: sb.real_directory(path) for key, path in config["components"].items()}
    llvm = sb.real_directory(config["llvmGit"])
    if sb.git(llvm, "rev-parse", "--verify", recipe["llvmCommit"] + "^{commit}").decode().strip() != recipe["llvmCommit"]:
        raise ValueError("pinned LLVM source commit missing")
    objects = []
    for entry in sb.git(llvm, "ls-tree", "-rz", recipe["llvmCommit"], "--", *recipe["sourcePaths"], maximum=32*1024*1024).split(b"\0"):
        if not entry:
            continue
        header, name = entry.split(b"\t", 1); mode, kind, oid = header.decode().split()
        if mode not in ("100644", "100755", "120000") or kind != "blob":
            raise ValueError("unsupported runtime source object")
        objects.append({"path": sb.path_name(name.decode()), "mode": mode, "gitBlob": oid})
    if not 1 <= len(objects) <= 150000:
        raise ValueError("runtime source count outside bound")
    archives = {key: sb.file_record(path, MAX_ARCHIVE) for key, path in config["archives"].items()}
    if any(archives[key]["sha256"] != pin["sha256"] for key, pin in recipe["archives"].items()):
        raise ValueError("source archive differs from pin")
    versions = {}
    for key, version in TOOLS.items():
        path = config["tools"][key]
        if not re.search(r"(?<![0-9.])" + re.escape(version) + r"(?![0-9.])", sb.metadata([path, "--version"]).decode()):
            raise ValueError("unexpected runtime bootstrap version: " + key)
        versions[key] = {"version": version, **sb.file_record(path)}
    bootstrap, bootstrap_paths = sb.dependency_closure({**config["tools"], "python": sys.executable}, config["dependencyInspector"])
    if Path(config["cmakeModules"]).resolve() != sb.cmake_module_directory(config["tools"]["cmake"]):
        raise ValueError("selected CMake modules differ from actual tool")
    if Path(config["pythonStandardLibrary"]).resolve() != sb.python_library_directory():
        raise ValueError("selected Python standard library differs from actual interpreter")
    actual_resources = sb.metadata([config["tools"]["clang"], "-print-resource-dir"]).decode().strip()
    if Path(config["nativeResourceDirectory"]).resolve() != Path(actual_resources).resolve():
        raise ValueError("native resource headers differ from selected Clang resource directory")
    manifest = {"schema": 1, "operation": "runtime_source_inputs", "recipe": recipe,
                "recipeSHA256": sb.file_record(RECIPE)["sha256"], "llvmSources": objects, "archives": archives,
                "nativeTools": versions, "bootstrap": bootstrap, "gitTool": sb.file_record("/usr/bin/git"),
                "dependencyInspector": sb.file_record(config["dependencyInspector"]),
                "systemBuildTools": {name: sb.file_record("/usr/bin/" + name) for name in ("sed", "diff")},
                "maintenancePython": {"version": sb.platform.python_version(), **sb.file_record(sys.executable)},
                "maintenance": [{"path": "tools/" + name, **sb.file_record(sb.ROOT / "tools" / name)} for name in ("runtime_build.py", "service_build.py")],
                "distributionStatus": "unresolved", "headerGeneration": "pinned pre-generated libc headers; WASI source staged but Rust generator not executed"}
    locators = {"bootstrap": bootstrap_paths}
    for role, root in (("nativeHeaders", Path(config["nativeResourceDirectory"]) / "include"),
                       ("cmakeModules", config["cmakeModules"]), ("pythonStandardLibrary", config["pythonStandardLibrary"])):
        manifest[role], locators[role] = sb.tree_records(root, components, ("site-packages",))
    return manifest, locators


def quote(value):
    equals = ""
    while "]" + equals + "]" in value:
        equals += "="
    return "[" + equals + "[" + value + "]" + equals + "]"


def adapt_libcxx(source, output):
    """Enable one pinned source-local package under isolated Python, never user/site paths."""
    name = "libcxx/utils/generate_iwyu_mapping.py"
    path = source / name
    original = path.read_bytes()
    context = b"import libcxx.header_information\n"
    if original.count(context) != 1:
        raise ValueError("libc++ isolated generator adaptation context differs from pin")
    path.write_bytes(original.replace(context,
        b"import pathlib, sys\nsys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))\n" + context))
    sb.write_json(output / "libcxx-adaptation.json", {"path": name, "beforeSHA256": sb.sha(original),
                  "after": sb.file_record(path), "reason": "only source-local libcxx package lookup under Python -I -S -B"})


def toolchain(output, tools, sysroot, resources):
    flags = ("--no-default-config -mcpu=lime1 " + shlex.quote("-resource-dir=" + str(resources))
             + " " + shlex.quote("-ffile-prefix-map=" + str(output) + "=/firmingo-runtime-build"))
    values = {"CMAKE_SYSTEM_NAME": "WASI", "CMAKE_SYSTEM_VERSION": "1", "CMAKE_SYSTEM_PROCESSOR": "wasm32",
              "CMAKE_C_COMPILER": tools["clang"], "CMAKE_CXX_COMPILER": tools["clangxx"], "CMAKE_ASM_COMPILER": tools["clang"],
              "CMAKE_AR": tools["ar"], "CMAKE_RANLIB": tools["ranlib"], "CMAKE_NM": tools["nm"],
              "CMAKE_C_COMPILER_TARGET": "wasm32-wasip1", "CMAKE_CXX_COMPILER_TARGET": "wasm32-wasip1",
              "CMAKE_ASM_COMPILER_TARGET": "wasm32-wasip1", "CMAKE_SYSROOT": str(sysroot),
              "CMAKE_C_FLAGS_INIT": flags, "CMAKE_CXX_FLAGS_INIT": flags, "CMAKE_ASM_FLAGS_INIT": flags,
              "CMAKE_EXE_LINKER_FLAGS_INIT": shlex.quote("-fuse-ld=" + tools["linker"]), "CMAKE_SHARED_LINKER_FLAGS_INIT": shlex.quote("-fuse-ld=" + tools["linker"]),
              "CMAKE_TRY_COMPILE_TARGET_TYPE": "STATIC_LIBRARY", "CMAKE_FIND_FRAMEWORK": "NEVER",
              "CMAKE_FIND_USE_PACKAGE_REGISTRY": "OFF", "CMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY": "OFF",
              "CMAKE_FIND_USE_CMAKE_ENVIRONMENT_PATH": "OFF", "CMAKE_FIND_USE_SYSTEM_ENVIRONMENT_PATH": "OFF",
              "CMAKE_C_LINKER_DEPFILE_SUPPORTED": "OFF", "CMAKE_CXX_LINKER_DEPFILE_SUPPORTED": "OFF"}
    path = output / "toolchain.cmake"
    with path.open("x") as target:
        for key, value in values.items():
            target.write("set(" + key + " " + quote(value) + " CACHE STRING \"Explicit owned runtime input\")\n")
    return path


def build(config, expected, output, jobs):
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or type(jobs) is not int or not 1 <= jobs <= 16:
        raise ValueError("select a reviewed input SHA-256 and 1..16 jobs")
    manifest, locators = capture(config)
    if sb.identity(manifest) != expected:
        raise ValueError("runtime input manifest differs from reviewed anchor")
    output.mkdir()
    for name in ("home", "tmp"):
        (output / name).mkdir()
    sb.write_json(output / "input-manifest.json", manifest)
    commands = []
    try:
        source = output / "llvm-source"
        objects = sb.export_git(config["llvmGit"], manifest["recipe"], source, manifest["llvmSources"])
        sb.write_json(output / "llvm-source-objects.json", objects)
        for key, pin in manifest["recipe"]["archives"].items():
            records = unpack(config["archives"][key], pin, output / key)
            sb.write_json(output / (key + "-source-files.json"), records)
        # Stage the separately pinned source without claiming header regeneration.
        shutil.copytree(output / "wasiHeaders", output / "libc/tools/wasi-headers/WASI", dirs_exist_ok=True)
        for role in ("cmakeModules", "pythonStandardLibrary"):
            sb.copy_records(output / role, manifest[role], locators[role])
        sb.copy_records(output / "resources/include", manifest["nativeHeaders"], locators["nativeHeaders"])
        sb.copy_records(output / "maintenance", manifest["maintenance"],
                        {record["path"]: sb.ROOT / record["path"] for record in manifest["maintenance"]})
        wrapper = output / "python-isolated"
        wrapper.write_text("#!/bin/sh\nexec " + shlex.quote(sys.executable) + " -I -S -B \"$@\"\n")
        wrapper.chmod(0o755)
        tools = config["tools"]; sysroot = output / "sysroot"; resources = output / "resources"
        sysroot.mkdir()
        chain = toolchain(output, tools, sysroot, resources)
        common = {"CMAKE_TOOLCHAIN_FILE": str(chain), "CMAKE_MAKE_PROGRAM": tools["ninja"], "CMAKE_BUILD_TYPE": "Release",
                  "Python3_EXECUTABLE": str(wrapper), "FETCHCONTENT_FULLY_DISCONNECTED": "ON",
                  "CMAKE_C_COMPILER_WORKS": "ON", "CMAKE_CXX_COMPILER_WORKS": "ON"}
        def phase(name, src, options):
            directory = output / (name + "-build")
            args = [tools["cmake"], "-S", str(src), "-B", str(directory), "-G", "Ninja",
                    *["-D" + key + "=" + value for key, value in sorted({**common, **options}.items())]]
            commands.append(args); sb.write_json(output / (name + "-configure-command.json"), args)
            sb.execute(args, output, name + "-configure.log")
            for step, args in (("compile", [tools["cmake"], "--build", str(directory), "--parallel", str(jobs)]),
                               ("install", [tools["cmake"], "--install", str(directory)])):
                commands.append(args); sb.execute(args, output, name + "-" + step + ".log")
        options = {"LLVM_ENABLE_PER_TARGET_RUNTIME_DIR": "ON", "COMPILER_RT_BAREMETAL_BUILD": "ON",
                   "COMPILER_RT_DEFAULT_TARGET_ONLY": "ON", "COMPILER_RT_HAS_FPIC_FLAG": "OFF",
                   "CMAKE_INSTALL_PREFIX": str(resources), "CMAKE_DISABLE_FIND_PACKAGE_LLVM": "ON"}
        for flag in ("XRAY", "SANITIZERS", "LIBFUZZER", "PROFILE", "CTX_PROFILE", "MEMPROF", "ORC", "GWP_ASAN"):
            options["COMPILER_RT_BUILD_" + flag] = "OFF"
        options["COMPILER_RT_INCLUDE_TESTS"] = "OFF"
        phase("builtins", source / "compiler-rt", options)
        builtins = list(resources.glob("lib/**/libclang_rt.builtins.a"))
        if len(builtins) != 1:
            raise ValueError("expected exactly one newly built Preview 1 builtins archive")
        # Preview 2/3 helper includes declare downloading tools; not used by this p1 recipe.
        cmake = output / "libc/CMakeLists.txt"
        original = cmake.read_text()
        before = "include(wasm-tools)\ninclude(wasi-wits)"
        if original.count(before) != 1 or original.count("add_compile_options(--target=${TARGET_TRIPLE})") != 1:
            raise ValueError("libc owned adaptation context differs from pin")
        cmake.write_text(original.replace(before, "# Owned p1-only build: no wasm-tools/WIT download targets.").replace(
            "add_compile_options(--target=${TARGET_TRIPLE})", "add_compile_options(--target=${TARGET_TRIPLE} " + quote("-resource-dir=" + str(resources)) + ")"))
        sb.write_json(output / "libc-adaptation.json", {"path": "CMakeLists.txt", "beforeSHA256": sb.sha(original.encode()),
                      "after": sb.file_record(cmake), "reason": "p1-only helpers and explicit resource headers"})
        phase("libc", output / "libc", {"TARGET_TRIPLE": "wasm32-wasip1", "CMAKE_INSTALL_PREFIX": str(sysroot),
              "SED": "/usr/bin/sed",
              "CMAKE_LINK_DEPENDS_USE_LINKER": "FALSE", "BUILTINS_LIB": str(builtins[0]), "BINDINGS_TARGET": "OFF",
              "CHECK_SYMBOLS": "ON", "BUILD_TESTS": "OFF"})
        adapt_libcxx(source, output)
        options = {"LLVM_ENABLE_RUNTIMES": "libcxx;libcxxabi", "LLVM_INCLUDE_TESTS": "OFF", "CMAKE_STAGING_PREFIX": str(sysroot),
                   "CMAKE_INSTALL_PREFIX": str(sysroot), "CMAKE_INSTALL_INCLUDEDIR": "include/wasm32-wasip1",
                   "CMAKE_POSITION_INDEPENDENT_CODE": "ON", "CXX_SUPPORTS_CXX11": "ON", "LLVM_COMPILER_CHECKED": "ON", "UNIX": "ON",
                   "LIBCXX_CXX_ABI": "libcxxabi", "LIBCXX_CXX_ABI_INCLUDE_PATHS": str(source / "libcxxabi/include"),
                   "LIBCXX_ABI_VERSION": "2", "LIBCXX_ENABLE_FILESYSTEM": "ON", "LIBCXX_HAS_MUSL_LIBC": "OFF",
                   "LIBCXX_LIBDIR_SUFFIX": "/wasm32-wasip1", "LIBCXXABI_LIBDIR_SUFFIX": "/wasm32-wasip1",
                   "LIBCXXABI_SILENT_TERMINATE": "ON", "LIBCXXABI_ENABLE_PIC": "ON", "LIBCXXABI_USE_LLVM_UNWINDER": "OFF"}
        for prefix in ("LIBCXX", "LIBCXXABI"):
            options.update({prefix + "_ENABLE_SHARED": "OFF", prefix + "_ENABLE_EXCEPTIONS": "OFF",
                            prefix + "_ENABLE_THREADS": "ON", prefix + "_HAS_PTHREAD_API": "ON",
                            prefix + "_HAS_EXTERNAL_THREAD_API": "OFF", prefix + "_BUILD_EXTERNAL_THREAD_LIBRARY": "OFF",
                            prefix + "_HAS_WIN32_THREAD_API": "OFF", prefix + "_INCLUDE_TESTS": "OFF"})
        options.update(LIBCXX_ENABLE_EXPERIMENTAL_LIBRARY="OFF", LIBCXX_ENABLE_ABI_LINKER_SCRIPT="OFF", LIBCXX_INCLUDE_BENCHMARKS="OFF")
        phase("cxx", source / "runtimes", options)
        required = ["lib/wasm32-wasip1/" + name for name in ("libc.a", "libc++.a", "libc++abi.a", "crt1-reactor.o", "libwasi-emulated-mman.a")]
        for name in required:
            sb.file_record(sysroot / name)
        inventory = {}
        for role, root in (("sysroot", sysroot), ("resources", resources)):
            inventory[role], _ = sb.tree_records(root, {"owned": output})
        sb.write_json(output / "output-files.json", inventory)
        sb.write_json(output / "commands.json", commands)
        for path, record in locators["bootstrap"].items():
            if sb.file_record(path) != record:
                raise ValueError("runtime bootstrap changed during build")
        for name, record in manifest["systemBuildTools"].items():
            if sb.file_record("/usr/bin/" + name) != record:
                raise ValueError("system build tool changed during build")
        for role in ("nativeHeaders", "cmakeModules", "pythonStandardLibrary"):
            for record in manifest[role]:
                if sb.file_record(locators[role][record["path"]]) != {key: record[key] for key in ("bytes", "sha256")}:
                    raise ValueError("bootstrap headers/modules changed during build")
        result = {"schema": 1, "status": "built_owned_wasip1_runtime", "inputManifestSHA256": expected,
                  "recipeIdentifier": manifest["recipe"]["identifier"], "outputInventorySHA256": sb.identity(inventory),
                  "outputFiles": {key: len(value) for key, value in inventory.items()}, "distributionStatus": "unresolved",
                  "headerGeneration": manifest["headerGeneration"]}
        sb.write_json(output / "operation.json", result)
        return result
    except BaseException as error:
        sb.write_json(output / "failure.json", {"status": "failed_owned_runtime_build", "type": type(error).__name__, "detail": str(error)[:4096]})
        raise


def compare(first, second):
    receipts = []
    for root in (first, second):
        result = sb.read_json(root / "operation.json")
        inputs = sb.read_json(root / "input-manifest.json", 32*1024*1024)
        inventory = sb.read_json(root / "output-files.json", 8*1024*1024)
        if result.get("status") != "built_owned_wasip1_runtime" or sb.identity(inputs) != result["inputManifestSHA256"] or sb.identity(inventory) != result["outputInventorySHA256"]:
            raise ValueError("completed runtime receipt identity mismatch")
        for role, records in inventory.items():
            if role not in ("sysroot", "resources"):
                raise ValueError("unexpected output role")
            observed, _ = sb.tree_records(root / role, {"owned": root})
            if observed != records:
                raise ValueError("runtime output bytes differ from receipt")
        receipts.append(result)
    if receipts[0] != receipts[1]:
        raise ValueError("runtime builds differ in inputs or output bytes")
    return {"status": "identical_owned_runtime_builds", "inputManifestSHA256": receipts[0]["inputManifestSHA256"],
            "outputInventorySHA256": receipts[0]["outputInventorySHA256"], "outputFiles": receipts[0]["outputFiles"]}


def main():
    if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
        raise ValueError("run this optional maintenance tool with Python -I -S -B")
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("capture", "build"):
        item = sub.add_parser(name); item.add_argument("config", type=Path)
        if name == "build":
            item.add_argument("expected"); item.add_argument("--jobs", type=int, default=4)
        item.add_argument("output", type=Path)
    item = sub.add_parser("compare"); item.add_argument("first", type=Path); item.add_argument("second", type=Path)
    args = parser.parse_args()
    if args.command == "compare":
        result = compare(args.first.resolve(), args.second.resolve())
    else:
        config = configuration(args.config)
        if args.command == "capture":
            manifest, _ = capture(config); args.output.mkdir()
            sb.write_json(args.output / "input-manifest.json", manifest)
            result = {"status": "captured_runtime_source_inputs", "inputManifestSHA256": sb.identity(manifest)}
            sb.write_json(args.output / "operation.json", result)
        else:
            result = build(config, args.expected, args.output.resolve(), args.jobs)
    print(sb.json_bytes(result).decode(), end="")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sb.subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr); sys.exit(1)
