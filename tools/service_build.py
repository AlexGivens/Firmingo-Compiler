#!/usr/bin/env python3
"""Owned development service builds with explicit captured inputs; never install or distribute assets."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import stat
import subprocess
import sys
import sysconfig
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_PATH = ROOT / "docs/service-reference.json"
RECIPE_PATH = ROOT / "service/recipe.json"
TOOLCHAIN_PATH = ROOT / "service/WASIClangToolchain.cmake"
OWNED_SOURCE_ROOT = ROOT / "service/source"
MAX_FILE = 1024 * 1024 * 1024
MAX_TREE_FILES = 20000
MAX_TREE_BYTES = 4 * 1024 * 1024 * 1024
TOOLS = ("clang", "clangxx", "ar", "ranlib", "llvmTablegen", "clangTablegen", "linker", "cmake", "ninja", "node")
SERVICE_PREFIX = "Tools/ArduinoDirectWASM/CompilerService/"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def identity(value):
    return sha(json_bytes(value))


def json_bytes(value):
    return json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False).encode() + b"\n"


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate configuration key")
        result[key] = value
    return result


def read_json(path, maximum=1024 * 1024):
    data = read_small(path, maximum)
    return json.loads(data.decode("utf-8"), object_pairs_hook=unique_object,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def path_name(name):
    if not isinstance(name, str) or not name or "\\" in name or any(ord(c) < 32 for c in name):
        raise ValueError("unsafe relative input path")
    path = PurePosixPath(name)
    if path.is_absolute() or str(path) != name or any(p in (".", "..", "") for p in path.parts):
        raise ValueError("unsafe relative input path")
    return name


def real_directory(path):
    path = Path(path).absolute()
    if path.is_symlink() or not path.is_dir():
        raise ValueError("select a real explicit directory")
    return path.resolve()


def read_small(path, maximum):
    record = file_record(path, maximum)
    descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError("input is not a bounded regular file")
        with os.fdopen(descriptor, "rb", closefd=False) as source:
            data = source.read(record["bytes"] + 1)
    finally:
        os.close(descriptor)
    if len(data) != record["bytes"] or sha(data) != record["sha256"]:
        raise ValueError("input changed during capture")
    return data


def file_record(path, maximum=MAX_FILE):
    """Capture regular-file identity with bounded streaming; directory/FIFO inputs never block."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise ValueError("input is not a bounded regular file")
        digest = hashlib.sha256()
        count = 0
        with os.fdopen(descriptor, "rb", closefd=False) as source:
            while data := source.read(1024 * 1024):
                count += len(data)
                if count > maximum:
                    raise ValueError("input exceeded its byte bound")
                digest.update(data)
        after = os.fstat(descriptor)
        if count != before.st_size or (before.st_dev, before.st_ino, before.st_mtime_ns, before.st_size) != (
                after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size):
            raise ValueError("input changed during capture")
        return {"bytes": count, "sha256": digest.hexdigest()}
    finally:
        os.close(descriptor)


def clean_environment(output=None):
    env = {"PATH": "/usr/bin:/bin", "LC_ALL": "C", "LANG": "C", "GIT_OPTIONAL_LOCKS": "0",
           "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1", "GIT_NO_REPLACE_OBJECTS": "1", "GIT_NO_LAZY_FETCH": "1",
           "CLANG_NO_DEFAULT_CONFIG": "1", "ZERO_AR_DATE": "1"}
    if output:
        env.update(HOME=str(output / "home"), TMPDIR=str(output / "tmp"),
                   GIT_CEILING_DIRECTORIES=str(output),
                   SOURCE_DATE_EPOCH=str(read_json(RECIPE_PATH)["sourceDateEpoch"]))
    return env


def metadata(arguments, cwd=None, maximum=2 * 1024 * 1024, ceiling=None):
    env = clean_environment()
    if ceiling:
        env["GIT_CEILING_DIRECTORIES"] = str(ceiling)
    result = subprocess.run(list(map(str, arguments)), cwd=cwd, capture_output=True,
                            env=env, timeout=30)
    if result.returncode or len(result.stdout) + len(result.stderr) > maximum:
        raise ValueError("input metadata command failed or exceeded its bound: " + str(arguments[0]))
    return result.stdout


def git(root, *args, maximum=2 * 1024 * 1024):
    return metadata(["/usr/bin/git", "--no-optional-locks", "--no-replace-objects", "-c", "core.fsmonitor=false", "-c", "core.attributesFile=" + os.devnull,
                     "-C", root, *args], maximum=maximum)


def tree_records(root, components, excluded_directories=()):
    """Follow only symlinks into explicitly declared component roots; snapshot contents, not links."""
    records, locators, pending = [], {}, [(Path(root), "", frozenset())]
    total = 0
    while pending:
        directory, relative, ancestors = pending.pop()
        resolved = directory.resolve(strict=True)
        if resolved in ancestors:
            raise ValueError("cyclic input directory link")
        for child in sorted(directory.iterdir(), key=lambda path: path.name):
            name = path_name((relative + "/" if relative else "") + child.name)
            actual = child.resolve(strict=True)
            owners = [(key, base) for key, base in components.items() if actual.is_relative_to(base)]
            if child.is_dir():
                if name in excluded_directories:
                    continue
                if not owners and not actual.is_relative_to(Path(root).resolve()):
                    raise ValueError("input directory link escapes explicit component roots: " + name)
                pending.append((child, name, ancestors | {resolved}))
                continue
            if not owners:
                raise ValueError("input link escapes explicit component roots: " + name)
            key, base = max(owners, key=lambda pair: len(str(pair[1])))
            record = {"path": name, **file_record(child), "component": key,
                      "componentPath": actual.relative_to(base).as_posix()}
            total += record["bytes"]
            if len(records) >= MAX_TREE_FILES or total > MAX_TREE_BYTES:
                raise ValueError("input tree exceeds count/byte bounds")
            records.append(record)
            locators[name] = child
    if not records:
        raise ValueError("input tree is empty")
    return sorted(records, key=lambda record: record["path"]), locators


def dependency_closure(tools, inspector):
    """Record Darwin loader dependencies and identify OS shared-cache inputs without inventing file hashes."""
    files, systems, pending = {}, set(), list(tools.values())
    if platform.system() != "Darwin":
        raise ValueError("actual bootstrap dependency capture currently requires Darwin")
    while pending:
        path = Path(pending.pop()).resolve(strict=True)
        if str(path) in files:
            continue
        files[str(path)] = file_record(path)
        output = metadata([inspector, "-L", path]).decode("utf-8").splitlines()[1:]
        load = metadata([inspector, "-l", path]).decode("utf-8")
        rpaths = re.findall(r"cmd LC_RPATH\s+cmdsize \d+\s+path (\S+) \(offset \d+\)", load)
        for line in output:
            dependency = line.strip().split(" (", 1)[0]
            if dependency.startswith(("/usr/lib/", "/System/Library/")):
                systems.add(dependency)
                continue
            if dependency.startswith("@rpath/"):
                candidates = [Path(value.replace("@loader_path", str(path.parent)).replace("@executable_path", str(path.parent))) / dependency[7:] for value in rpaths]
                candidates += [path.parent / dependency[7:]]
                candidates = [candidate for candidate in candidates if candidate.is_file()]
                if not candidates:
                    raise ValueError("unresolved bootstrap runtime dependency: " + dependency)
                dependency = str(candidates[0])
            else:
                dependency = dependency.replace("@loader_path", str(path.parent)).replace("@executable_path", str(path.parent))
            if not Path(dependency).is_absolute():
                raise ValueError("unsupported native loader dependency")
            if Path(dependency).resolve() != path:
                pending.append(dependency)
    # Paths stay local in the locator map; portable identities use stable content-addressed records.
    records = sorted([{"name": Path(path).name, **record} for path, record in files.items()],
                     key=lambda record: (record["name"], record["sha256"]))
    return {"files": records, "systemLibraries": sorted(systems), "os": platform.platform(),
            "scope": "non-system Darwin loader file closure; OS shared-cache bytes/source reproduction outside this proof"}, files


def load_configuration(path):
    config = read_json(path, 65536)
    keys = {"schema", "sysroot", "resourceDirectory", "cmakeModules", "pythonStandardLibrary", "components", "tools", "dependencyInspector"}
    allowed = [keys | {custom, upstream} for custom in ("referenceRoot", "serviceSourceRoot") for upstream in ("llvmGit", "llvmSourceRoot")]
    if not isinstance(config, dict) or set(config) not in allowed or type(config["schema"]) is not int or config["schema"] != 1:
        raise ValueError("unsupported service build configuration")
    if not isinstance(config["tools"], dict) or set(config["tools"]) != set(TOOLS):
        raise ValueError("select every explicit native build tool")
    if not isinstance(config["components"], dict) or not 2 <= len(config["components"]) <= 16:
        raise ValueError("select explicit installed component roots")
    source_key = "serviceSourceRoot" if "serviceSourceRoot" in config else "referenceRoot"
    upstream_key = "llvmSourceRoot" if "llvmSourceRoot" in config else "llvmGit"
    values = [config[key] for key in (source_key, upstream_key, "sysroot", "resourceDirectory", "cmakeModules", "pythonStandardLibrary", "dependencyInspector")]
    values += list(config["tools"].values()) + list(config["components"].values())
    if any(not isinstance(value, str) or not value or len(value) > 4096 or ";" in value or any(ord(c) < 32 for c in value) for value in values):
        raise ValueError("select bounded literal local input paths without control/list characters")
    for key in config["components"]:
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]{0,63}", key):
            raise ValueError("invalid component label")
    return config


def python_library_directory():
    return Path(sysconfig.get_path("stdlib")).resolve()


def cmake_module_directory(executable):
    # Query only the selected CMake executable; no project/configure/install operation occurs.
    with tempfile.TemporaryDirectory(prefix="firmingo-cmake-metadata-") as directory:
        script = Path(directory) / "root.cmake"
        script.write_text('message(STATUS "firmingo_cmake_root=${CMAKE_ROOT}")\n')
        result = metadata([executable, "-P", script], cwd=directory).decode("utf-8").strip()
    prefix = "-- firmingo_cmake_root="
    if not result.startswith(prefix) or "\n" in result:
        raise ValueError("selected CMake did not identify its module root")
    return Path(result[len(prefix):]).resolve(strict=True)


def llvm_source_inputs(config, recipe):
    """Select pinned Git objects or an anchored package's raw source snapshot; never a working tree."""
    if "llvmSourceRoot" not in config:
        root = real_directory(config["llvmGit"])
        if git(root, "rev-parse", "--verify", recipe["llvmCommit"] + "^{commit}").decode().strip() != recipe["llvmCommit"]:
            raise ValueError("pinned LLVM source commit missing")
        entries = git(root, "ls-tree", "-rz", recipe["llvmCommit"], "--", *recipe["sourcePaths"], maximum=32*1024*1024)
        objects = []
        for entry in entries.split(b"\0"):
            if not entry:
                continue
            header, name = entry.split(b"\t", 1); mode, kind, oid = header.decode().split()
            if kind != "blob" or mode not in ("100644", "100755", "120000"):
                raise ValueError("unsupported committed source object")
            objects.append({"path": path_name(name.decode()), "mode": mode, "gitBlob": oid})
        provider = {"git": root}
    else:
        root = real_directory(config["llvmSourceRoot"])
        if (root / "manifest.json").is_symlink():
            raise ValueError("symlinked LLVM snapshot inventory")
        manifest = read_json(root / "manifest.json", 64*1024*1024)
        if set(manifest) != {"schema", "llvmCommit", "files"} or type(manifest["schema"]) is not int or manifest["schema"] != 1 or manifest["llvmCommit"] != recipe["llvmCommit"] or not isinstance(manifest["files"], list) or not 1 <= len(manifest["files"]) <= 150000:
            raise ValueError("unsupported LLVM source snapshot")
        selected, names, total = [], set(), 0
        for record in manifest["files"]:
            if not isinstance(record, dict) or set(record) != {"path", "mode", "gitBlob", "bytes", "sha256"} or record["mode"] not in ("100644", "100755", "120000") or not isinstance(record["gitBlob"], str) or not re.fullmatch(r"[0-9a-f]{40}", record["gitBlob"]) or not isinstance(record["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]) or type(record["bytes"]) is not int or not 0 <= record["bytes"] <= 32*1024*1024:
                raise ValueError("unsupported LLVM snapshot record")
            name = path_name(record["path"]); total += record["bytes"]
            if name in names or total > 8*1024*1024*1024:
                raise ValueError("duplicate or excessive LLVM snapshot")
            names.add(name)
            if any(name == prefix or name.startswith(prefix + "/") for prefix in recipe["sourcePaths"]):
                selected.append(record)
        selected_names = {record["path"] for record in selected}
        for record in selected:
            snapshot_blob(root, record, selected_names)
        objects = [{key: record[key] for key in ("path", "mode", "gitBlob")} for record in selected]
        provider = {"snapshot": root, "records": selected, "manifest": file_record(root / "manifest.json", 64*1024*1024)}
    if not 1 <= len(objects) <= 150000:
        raise ValueError("LLVM source count outside bound")
    return objects, provider


def snapshot_blob(root, record, names):
    """Read one bounded raw Git blob, including literal safe link targets, without parent aliases."""
    path = root / "source" / record["path"]
    for parent in path.parents:
        if parent == root:
            break
        if parent.is_symlink():
            raise ValueError("symlinked LLVM snapshot parent")
    if record["mode"] == "120000":
        if not path.is_symlink():
            raise ValueError("LLVM snapshot link mode mismatch")
        target = os.readlink(path)
        name = path_name(os.path.normpath(str(PurePosixPath(record["path"]).parent / target)))
        if Path(target).is_absolute() or name not in names or not path.resolve(strict=True).is_relative_to(root / "source"):
            raise ValueError("LLVM snapshot link escapes selected sources")
        data = target.encode()
    else:
        if path.is_symlink() or bool(path.stat().st_mode & 0o111) != (record["mode"] == "100755"):
            raise ValueError("LLVM snapshot file mode mismatch")
        data = read_small(path, 32*1024*1024)
    if len(data) != record["bytes"] or sha(data) != record["sha256"] or hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() != record["gitBlob"]:
        raise ValueError("LLVM snapshot bytes differ from recorded Git blob")
    return data


def snapshot_llvm(provider, recipe, output, objects):
    if "git" in provider:
        return export_git(provider["git"], recipe, output, objects)
    output.mkdir()
    records = provider["records"]; names = {record["path"] for record in records}
    links = []
    for record in records:
        data = snapshot_blob(provider["snapshot"], record, names)
        path = output / record["path"]; path.parent.mkdir(parents=True, exist_ok=True)
        if record["mode"] == "120000":
            links.append((path, data.decode()))
        else:
            with path.open("xb") as target:
                target.write(data)
            path.chmod(0o755 if record["mode"] == "100755" else 0o644)
    for path, target in links:
        path.symlink_to(target)
    for path, _ in links:
        if not path.resolve(strict=True).is_relative_to(output):
            raise ValueError("LLVM snapshot link escapes owned output")
    if file_record(provider["snapshot"] / "manifest.json", 64*1024*1024) != provider["manifest"]:
        raise ValueError("LLVM snapshot inventory changed during copy")
    return records


def capture(config, pins=None):
    """Capture all direct source, patch, header/sysroot/resource and bootstrap inputs before any build output."""
    pins = pins or read_json(REFERENCE_PATH)
    recipe = read_json(RECIPE_PATH)
    owned = "serviceSourceRoot" in config
    reference = real_directory(config["serviceSourceRoot"] if owned else config["referenceRoot"])
    if not owned and git(reference, "rev-parse", "HEAD").decode().strip() != pins["referenceCommit"]:
        raise ValueError("reference commit differs from pin")
    service, service_locators, grant_records, grant_locators = [], {}, [], {}
    if owned:
        # The grant is selected from this repository, not trusted from a caller's JSON.
        for name in ("manifest.json", "SOURCE-LICENSE.md", "LICENSE", "LLVM-LICENSE.txt"):
            source = reference / name
            if source.is_symlink() or read_small(source, 65536) != read_small(OWNED_SOURCE_ROOT / name, 65536):
                raise ValueError("owned source license grant differs from reviewed repository materials")
            grant_records.append({"path": name, **file_record(source, 65536)})
            grant_locators[name] = source
        grant = read_json(reference / "manifest.json", 65536)
        if grant["contributionLicense"] != "GPL-3.0-only" or grant["ownershipStatus"] != "confirmed by author" or grant["origin"]["commit"] != pins["referenceCommit"]:
            raise ValueError("unsupported owned source license grant")
    for record in pins["files"]:
        if not record["path"].startswith(SERVICE_PREFIX) or record["role"] not in ("source", "patch"):
            continue
        name = path_name(record["path"][len(SERVICE_PREFIX):])
        source = reference / (name if owned else record["path"])
        if source.is_symlink() or (owned and any(parent.is_symlink() for parent in source.parents if parent != reference and parent.is_relative_to(reference))):
            raise ValueError("symlinked reference service input")
        data = read_small(source, 524288)
        if len(data) != record["bytes"] or sha(data) != record["sha256"] or (not owned and data != git(reference, "show", pins["referenceCommit"] + ":" + record["path"])):
            raise ValueError("reference source/patch differs from pin")
        service.append({"path": name, "bytes": len(data), "sha256": sha(data), "role": record["role"]})
        service_locators[name] = source
    if owned:
        declared = [{key: record[key] for key in ("path", "bytes", "sha256", "role")} for record in grant["files"]]
        if sorted(declared, key=lambda record: record["path"]) != sorted(service, key=lambda record: record["path"]):
            raise ValueError("owned source license inventory differs from input pins")
    objects, llvm_provider = llvm_source_inputs(config, recipe)
    components = {key: real_directory(path) for key, path in config["components"].items()}
    if Path(config["pythonStandardLibrary"]).resolve() != python_library_directory():
        raise ValueError("Python standard-library selection differs from the actual isolated interpreter")
    if Path(config["cmakeModules"]).resolve() != cmake_module_directory(config["tools"]["cmake"]):
        raise ValueError("CMake module selection differs from the actual selected tool")
    sysroot, sysroot_paths = tree_records(config["sysroot"], components)
    resources, resource_paths = tree_records(config["resourceDirectory"], components)
    cmake_modules, cmake_module_paths = tree_records(config["cmakeModules"], components)
    python_library, python_library_paths = tree_records(config["pythonStandardLibrary"], components, ("site-packages",))
    required = {"lib/wasm32-wasip1/" + name for name in ["libc.a", "libc++.a", "libc++abi.a", "crt1-reactor.o", "libwasi-emulated-mman.a"]}
    if not required.issubset({record["path"] for record in sysroot}) or not any(record["path"].endswith("libclang_rt.builtins.a") for record in resources):
        raise ValueError("required WASI libraries/resources missing")
    tools = {key: str(Path(path).absolute()) for key, path in config["tools"].items()}
    versions = {}
    for key, path in tools.items():
        file_record(path)
        output = metadata([path, "--version"]).decode("utf-8").strip()
        version = "4.4.0" if key == "cmake" else "1.13.2" if key == "ninja" else "22.12.0" if key == "node" else "22.1.8"
        if not re.search(r"(?<![0-9.])" + re.escape(version) + r"(?![0-9.])", output):
            raise ValueError("unexpected native tool version: " + key)
        versions[key] = {"version": version, **file_record(path)}
    bootstrap, bootstrap_paths = dependency_closure({**tools, "python": sys.executable}, config["dependencyInspector"])
    notices, notice_paths = [], {}
    for key, base in components.items():
        names = [path for path in base.iterdir() if path.is_file() and (path.name.startswith(("LICENSE", "COPYING", "NOTICE")) or path.name in ("INSTALL_RECEIPT.json", "sbom.spdx.json"))]
        brew = base / ".brew"
        if brew.is_dir():
            names += sorted(brew.glob("*.rb"))
        for path in names:
            name = key + "/" + path.relative_to(base).as_posix()
            notices.append({"path": name, **file_record(path, 2 * 1024 * 1024)})
            notice_paths[name] = path
    manifest = {"schema": 1, "operation": "owned_service_build_inputs", "recipe": recipe,
                "recipeSHA256": file_record(RECIPE_PATH)["sha256"], "toolchainSHA256": file_record(TOOLCHAIN_PATH)["sha256"],
                "referenceCommit": pins["referenceCommit"], "referenceLicenseStatus": pins["referenceRootLicense"],
                "llvmSources": objects, "serviceInputs": sorted(service, key=lambda record: record["path"]),
                "sysroot": sysroot, "resources": resources, "cmakeModules": cmake_modules, "pythonStandardLibrary": python_library,
                "componentRecords": sorted(notices, key=lambda record: record["path"]),
                "nativeTools": versions, "bootstrap": bootstrap,
                "maintenancePython": {"version": platform.python_version(), **file_record(sys.executable)},
                "gitTool": file_record("/usr/bin/git"),
                "dependencyInspector": file_record(config["dependencyInspector"]),
                "maintenanceImplementation": [{"path": str(path.relative_to(ROOT)), **file_record(path)} for path in (
                    Path(__file__), ROOT / "tools/inspect-service.mjs", ROOT / "tools/bounded-file.mjs", ROOT / "runtime/ModuleMemory.js")],
                "distributionStatus": "unresolved", "upstreamRuntimeSourceReproduction": "not established by installed-component capture"}
    if owned:
        manifest["customSourceLicense"] = {"contributionLicense": "GPL-3.0-only", "ownershipStatus": "confirmed by author",
                                          "provider": "owned source", "materials": grant_records}
    if "snapshot" in llvm_provider:
        manifest["llvmSourceSnapshot"] = llvm_provider["manifest"]
    return manifest, {"service": service_locators, "sourceGrant": grant_locators, "sysroot": sysroot_paths, "resources": resource_paths,
                      "cmakeModules": cmake_module_paths, "pythonStandardLibrary": python_library_paths,
                      "notices": notice_paths, "bootstrap": bootstrap_paths, "llvmProvider": llvm_provider, "tools": tools}


def write_json(path, value):
    with Path(path).open("xb") as destination:
        destination.write(json_bytes(value))


def capture_command(config_path, output):
    manifest, _ = capture(load_configuration(config_path))
    output.mkdir()
    write_json(output / "input-manifest.json", manifest)
    summary = {"status": "captured_development_service_inputs", "inputManifestSHA256": identity(manifest),
               "llvmSourceFiles": len(manifest["llvmSources"]), "sysrootFiles": len(manifest["sysroot"]),
               "resourceFiles": len(manifest["resources"]), "distributionStatus": "unresolved"}
    write_json(output / "operation.json", summary)
    return summary


def copy_records(output, records, locators):
    for record in records:
        destination = output / path_name(record["path"])
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as target, Path(locators[record["path"]]).open("rb") as source:
            shutil.copyfileobj(source, target, 1024 * 1024)
        if file_record(destination) != {key: record[key] for key in ("bytes", "sha256")}:
            raise ValueError("captured input changed before owned snapshot")


def export_git(llvm_git, recipe, output, objects):
    """Snapshot anchored raw Git blobs with a bounded batch reader; archive attributes cannot rewrite source."""
    output.mkdir()
    process = subprocess.Popen(["/usr/bin/git", "--no-optional-locks", "--no-replace-objects", "-C", str(llvm_git),
                                "cat-file", "--batch"], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=clean_environment())
    expected = {record["path"]: record for record in objects}
    total, links, captured = 0, [], []
    try:
        for record in objects:
            name = path_name(record["path"])
            oid = record["gitBlob"]
            if not re.fullmatch(r"[0-9a-f]{40}", oid):
                raise ValueError("invalid anchored Git object")
            process.stdin.write(oid.encode() + b"\n"); process.stdin.flush()
            header = process.stdout.readline(128).decode("ascii").strip().split()
            if len(header) != 3 or header[0] != oid or header[1] != "blob" or not header[2].isdigit():
                raise ValueError("unexpected Git object response")
            size = int(header[2]); total += size
            if size > MAX_FILE or total > 8 * 1024 * 1024 * 1024:
                raise ValueError("LLVM source exceeded byte bound")
            digest = hashlib.sha1(b"blob " + str(size).encode() + b"\0")
            sha256 = hashlib.sha256()
            if record["mode"] == "120000":
                if size > 4096:
                    raise ValueError("excessive source link")
                data = process.stdout.read(size)
                if len(data) != size:
                    raise ValueError("truncated Git source link")
                digest.update(data); sha256.update(data)
                target = data.decode("utf-8")
                normalized = os.path.normpath(str(PurePosixPath(name).parent / target))
                path_name(normalized)
                if Path(target).is_absolute() or normalized not in expected or "\\" in target or any(ord(c) < 32 for c in target):
                    raise ValueError("source link escapes anchored source objects")
                links.append((name, target))
            else:
                destination = output / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                remaining = size
                with destination.open("xb") as target:
                    while remaining:
                        data = process.stdout.read(min(1024 * 1024, remaining))
                        if not data:
                            raise ValueError("truncated Git source blob")
                        digest.update(data); sha256.update(data); target.write(data); remaining -= len(data)
                destination.chmod(0o755 if record["mode"] == "100755" else 0o644)
            if process.stdout.read(1) != b"\n" or digest.hexdigest() != oid:
                raise ValueError("source bytes differ from anchored Git blob: " + name)
            captured.append({**record, "bytes": size, "sha256": sha256.hexdigest()})
        process.stdin.close()
        if process.wait(timeout=30):
            raise ValueError("incomplete Git source snapshot")
        for name, target in links:
            destination = output / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.symlink_to(target)
        for name, _ in links:
            if not (output / name).resolve(strict=True).is_relative_to(output):
                raise ValueError("source link escaped owned snapshot")
        return captured
    finally:
        if process.poll() is None:
            process.kill(); process.wait()
        if not process.stdin.closed:
            process.stdin.close()
        process.stdout.close(); process.stderr.close()


def execute(arguments, output, log_name, maximum_seconds=7200):
    """Run only the selected maintenance tools in owned paths; no inherited compiler/header/config environment."""
    with (output / log_name).open("xb") as log:
        result = subprocess.run(list(map(str, arguments)), cwd=output, env=clean_environment(output),
                                stdout=log, stderr=subprocess.STDOUT, timeout=maximum_seconds)
    if result.returncode:
        raise ValueError("service build phase failed; inspect " + str(output / log_name))


def build_command(config_path, expected, output, jobs, configure_only=False):
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or type(jobs) is not int or not 1 <= jobs <= 16:
        raise ValueError("select a reviewed input-manifest SHA-256 and 1..16 jobs")
    manifest, inputs = capture(load_configuration(config_path))
    if identity(manifest) != expected:
        raise ValueError("service input manifest differs from independent reviewed anchor")
    output.mkdir()
    for name in ("home", "tmp"):
        (output / name).mkdir()
    write_json(output / "input-manifest.json", manifest)
    try:
        source = output / "llvm-source"
        recipe = manifest["recipe"]
        source_objects = snapshot_llvm(inputs["llvmProvider"], recipe, source, manifest["llvmSources"])
        write_json(output / "source-objects.json", source_objects)
        for role, key in (("service", "serviceInputs"), ("sysroot", "sysroot"), ("resources", "resources"), ("notices", "componentRecords")):
            copy_records(output / role, manifest[key], inputs[role])
        if "customSourceLicense" in manifest:
            copy_records(output / "service", manifest["customSourceLicense"]["materials"], inputs["sourceGrant"])
        for role in ("cmakeModules", "pythonStandardLibrary"):
            copy_records(output / role, manifest[role], inputs[role])
        copy_records(output / "maintenance", manifest["maintenanceImplementation"],
                     {record["path"]: ROOT / record["path"] for record in manifest["maintenanceImplementation"]})
        (output / "maintenance/service").mkdir()
        write_json(output / "maintenance/package.json", {"type": "module"})
        shutil.copyfile(RECIPE_PATH, output / "maintenance/service/recipe.json")
        if file_record(output / "maintenance/service/recipe.json")["sha256"] != manifest["recipeSHA256"]:
            raise ValueError("recipe changed before owned snapshot")
        for record in manifest["serviceInputs"]:
            if record["role"] == "patch":
                metadata(["/usr/bin/git", "apply", "--whitespace=nowarn", output / "service" / record["path"]], cwd=source, ceiling=output)
        # Capture all patched source file identities, including newly added files, before configuration.
        patches = [record for record in manifest["serviceInputs"] if record["role"] == "patch"]
        targets = set()
        for record in patches:
            text = (output / "service" / record["path"]).read_text()
            for name in re.findall(r"^diff --git a/[^\s]+ b/([^\s]+)$", text, re.MULTILINE):
                targets.add(path_name(name))
        write_json(output / "patched-sources.json", [{"path": name, **file_record(source / name)} for name in sorted(targets)])
        template = output / "WASIClangTemplate.cmake"
        shutil.copyfile(TOOLCHAIN_PATH, template)
        if file_record(template)["sha256"] != manifest["toolchainSHA256"]:
            raise ValueError("toolchain changed before build")
        tools = inputs["tools"]
        build = output / "llvm-build"
        toolchain = output / "WASIClangToolchain.cmake"
        python_wrapper = output / "python-isolated"
        with python_wrapper.open("x") as destination:
            # Shell quoting is used only for this exact captured interpreter locator, never compiler arguments.
            import shlex
            destination.write("#!/bin/sh\nexec " + shlex.quote(sys.executable) + " -I -S -B \"$@\"\n")
        python_wrapper.chmod(0o755)
        paths = {"CMAKE_C_COMPILER": tools["clang"], "CMAKE_CXX_COMPILER": tools["clangxx"], "CMAKE_AR": tools["ar"],
                 "CMAKE_RANLIB": tools["ranlib"], "CMAKE_SYSROOT": str(output / "sysroot"),
                 "FIRMINGO_RESOURCE_DIR": str(output / "resources"), "FIRMINGO_LD": tools["linker"], "FIRMINGO_BUILD_ROOT": str(output)}
        def quote(value):
            equals = ""
            while "]" + equals + "]" in value:
                equals += "="
            return "[" + equals + "[" + value + "]" + equals + "]"
        with toolchain.open("x") as destination:
            for key, value in paths.items():
                destination.write("set(" + key + " " + quote(value) + " CACHE STRING \"Explicit captured input\")\n")
            destination.write("include(" + quote(str(template)) + ")\n")
        definitions = dict(recipe["cmakeOptions"], CMAKE_TOOLCHAIN_FILE=str(toolchain),
                           CMAKE_C_COMPILER=tools["clang"], CMAKE_CXX_COMPILER=tools["clangxx"],
                           CMAKE_AR=tools["ar"], CMAKE_RANLIB=tools["ranlib"], CMAKE_MAKE_PROGRAM=tools["ninja"],
                           CMAKE_SYSROOT=str(output / "sysroot"), FIRMINGO_RESOURCE_DIR=str(output / "resources"),
                           FIRMINGO_LD=tools["linker"], FIRMINGO_BUILD_ROOT=str(output), LLVM_TABLEGEN=tools["llvmTablegen"], CLANG_TABLEGEN=tools["clangTablegen"],
                           Python3_EXECUTABLE=str(python_wrapper), CMAKE_INSTALL_PREFIX=str(output / "install"))
        commands = [[tools["cmake"], "-S", str(source / "llvm"), "-B", str(build), "-G", "Ninja",
                     *["-D" + key + "=" + value for key, value in sorted(definitions.items())]]]
        write_json(output / "configure-command.json", commands[0])
        execute(commands[0], output, "configure.log")
        if configure_only:
            summary = {"status": "configured_owned_development_service", "inputManifestSHA256": expected,
                       "compiled": False, "distributionStatus": "unresolved"}
            write_json(output / "operation.json", summary)
            return summary
        commands.append([tools["cmake"], "--build", str(build), "--parallel", str(jobs), "--target", *recipe["targets"]])
        execute(commands[-1], output, "compile.log")
        library_dir = build / "lib"
        libraries = sorted([path for path in library_dir.glob("*.a") if path.name.startswith(("libclang", "liblld", "libLLVM"))])
        if not libraries or len(libraries) > 256:
            raise ValueError("missing or excessive LLVM link archives")
        library_inventory = [{"path": path.relative_to(build).as_posix(), **file_record(path)} for path in libraries]
        generated, _ = tree_records(build / "include", {"generated": build})
        clang_generated, _ = tree_records(build / "tools/clang/include", {"generated": build})
        lld_generated = []
        if (build / "tools/lld/include").is_dir():
            lld_generated, _ = tree_records(build / "tools/lld/include", {"generated": build})
        write_json(output / "link-inputs.json", {"libraries": library_inventory, "llvmHeaders": generated,
                                                  "clangHeaders": clang_generated, "lldHeaders": lld_generated})
        service = output / "service"
        module = output / "compiler.wasm"
        link = [tools["clangxx"], "--no-default-config", "--target=wasm32-wasip1", "--sysroot=" + str(output / "sysroot"),
                "-resource-dir=" + str(output / "resources"), "-fuse-ld=" + tools["linker"], "-mexec-model=reactor",
                "-D_WASI_EMULATED_MMAN", "-std=c++20", "-O3", "-flto", "-fno-exceptions", "-fno-rtti", "-ffile-prefix-map=" + str(output) + "=/firmingo-service-build",
                "-I" + str(service / "include"), "-I" + str(service / "Sources")]
        for path in (source / "llvm/include", source / "clang/include", source / "lld/include", build / "include", build / "tools/clang/include", build / "tools/lld/include"):
            link += ["-isystem", str(path)]
        link += [str(service / name) for name in recipe["sources"]]
        link += ["-Wl,--gc-sections", "-Wl,--export-memory", "-Wl,-z,stack-size=" + str(recipe["stackBytes"]),
                 "-Wl,--max-memory=" + str(recipe["maximumMemoryBytes"])]
        link += ["-Wl,--export=" + name for name in recipe["exports"]]
        link += [str(path) for path in libraries] + ["-lwasi-emulated-mman", "-o", str(module)]
        commands.append(link)
        write_json(output / "commands.json", commands)
        execute(link, output, "link.log")
        inspection = json.loads(metadata([tools["node"], output / "maintenance/tools/inspect-service.mjs", module]))
        write_json(output / "module-inspection.json", inspection)
        # A build may take hours; refuse success if native tool/dependency bytes changed meanwhile.
        for path, record in inputs["bootstrap"].items():
            if file_record(path) != record:
                raise ValueError("bootstrap input changed during build")
        for role in ("cmakeModules", "pythonStandardLibrary"):
            for record in manifest[role]:
                if file_record(inputs[role][record["path"]]) != {key: record[key] for key in ("bytes", "sha256")}:
                    raise ValueError("bootstrap module/standard-library input changed during build")
        summary = {"schema": 1, "status": "built_owned_development_service", "inputManifestSHA256": expected,
                   "recipeIdentifier": recipe["identifier"], "module": {"path": "compiler.wasm", **file_record(module)},
                   "linkedArchiveCount": len(libraries), "distributionStatus": "unresolved",
                   "upstreamRuntimeSourceReproduction": manifest["upstreamRuntimeSourceReproduction"]}
        write_json(output / "operation.json", summary)
        return summary
    except BaseException as error:
        write_json(output / "failure.json", {"status": "failed_owned_service_build", "type": type(error).__name__, "detail": str(error)[:4096]})
        raise


def compare_command(first, second):
    a, b = read_json(first / "operation.json"), read_json(second / "operation.json")
    if a.get("status") != "built_owned_development_service" or b.get("status") != a["status"] or a.get("inputManifestSHA256") != b.get("inputManifestSHA256"):
        raise ValueError("select two successful builds from the same reviewed input identity")
    for directory, receipt in ((first, a), (second, b)):
        if file_record(directory / "input-manifest.json", 128 * 1024 * 1024)["sha256"] != receipt["inputManifestSHA256"]:
            raise ValueError("input manifest differs from completed build receipt")
    for path, record in ((first / "compiler.wasm", a["module"]), (second / "compiler.wasm", b["module"])):
        if file_record(path) != {key: record[key] for key in ("bytes", "sha256")}:
            raise ValueError("module differs from completed build receipt")
    if a["module"]["sha256"] != b["module"]["sha256"]:
        raise ValueError("repeat service builds differ; inspect pinned commands and inputs")
    return {"status": "byte_identical_owned_service_rebuilds", "moduleSHA256": a["module"]["sha256"],
            "inputManifestSHA256": a["inputManifestSHA256"], "distributionStatus": "unresolved"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    capture_parser = sub.add_parser("capture", help="capture explicit source/sysroot/resource/bootstrap inputs, no build")
    capture_parser.add_argument("config", type=Path)
    capture_parser.add_argument("output", type=Path)
    for command in ("configure", "build"):
        child = sub.add_parser(command, help="verify reviewed inputs, snapshot and patch owned sources, then " + command)
        child.add_argument("config", type=Path)
        child.add_argument("input_manifest_sha256")
        child.add_argument("output", type=Path)
        child.add_argument("--jobs", type=int, default=4)
    compare = sub.add_parser("compare", help="verify successful receipts and compare actual bytes from two clean builds")
    compare.add_argument("first", type=Path)
    compare.add_argument("second", type=Path)
    args = parser.parse_args()
    try:
        if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
            raise ValueError("start the maintenance host with Python -I -S -B; see docs/service-build.md")
        if args.command == "capture":
            result = capture_command(args.config, args.output.absolute())
        elif args.command == "compare":
            result = compare_command(real_directory(args.first), real_directory(args.second))
        else:
            result = build_command(args.config, args.input_manifest_sha256, args.output.absolute(), args.jobs, args.command == "configure")
        print(json.dumps(result, sort_keys=True))
    except (OSError, ValueError, subprocess.SubprocessError, UnicodeError) as error:
        parser.exit(1, "Service maintenance failed: " + str(error)[:4096] + "\n")


if __name__ == "__main__":
    main()
