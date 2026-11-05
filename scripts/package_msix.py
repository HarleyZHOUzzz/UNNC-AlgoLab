#!/usr/bin/env python3
"""Build a Store MSIX from an already-built Tauri executable."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src-tauri" / "icons"
NS = "http://schemas.microsoft.com/appx/manifest/foundation/windows10"
UAP = "http://schemas.microsoft.com/appx/manifest/uap/windows10"
RESCAP = "http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
ET.register_namespace("", NS)
ET.register_namespace("uap", UAP)
ET.register_namespace("rescap", RESCAP)


def validate_identity(name: str, publisher: str, version: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{1,48}[A-Za-z0-9]", name):
        raise ValueError("Package name must be 3–50 letters, digits, dots or hyphens.")
    if not publisher.strip().upper().startswith("CN="):
        raise ValueError("Publisher must be the full CN=... value from Partner Center.")
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){3}", version):
        raise ValueError("Store package version must have four numeric components.")
    parts = [int(value) for value in version.split(".")]
    if any(value > 65535 for value in parts) or parts[0] == 0 or parts[3] != 0:
        raise ValueError("Store requires a nonzero first component, components <= 65535, and a final component of 0.")


def executable_architecture(path: Path) -> str:
    with path.open("rb") as stream:
        header = stream.read(64)
        if len(header) < 64 or header[:2] != b"MZ":
            raise ValueError(f"Not a Windows PE executable: {path}")
        stream.seek(struct.unpack_from("<I", header, 60)[0])
        pe = stream.read(6)
    if len(pe) != 6 or pe[:4] != b"PE\0\0":
        raise ValueError(f"Invalid Windows PE header: {path}")
    machine = struct.unpack_from("<H", pe, 4)[0]
    if machine not in {0x8664, 0xAA64}:
        raise ValueError(f"Unsupported executable architecture: {machine:#x}")
    return {0x8664: "x64", 0xAA64: "arm64"}[machine]


def make_manifest(name: str, publisher: str, version: str, arch: str) -> bytes:
    validate_identity(name, publisher, version)
    if arch not in {"x64", "arm64"}:
        raise ValueError("Architecture must be x64 or arm64.")
    package = ET.Element(f"{{{NS}}}Package", {"IgnorableNamespaces": "uap rescap"})
    ET.SubElement(package, f"{{{NS}}}Identity", {"Name": name, "Publisher": publisher, "Version": version, "ProcessorArchitecture": arch})
    properties = ET.SubElement(package, f"{{{NS}}}Properties")
    ET.SubElement(properties, f"{{{NS}}}DisplayName").text = "UNNC AlgoLab"
    ET.SubElement(properties, f"{{{NS}}}PublisherDisplayName").text = "Yinxi ZHOU"
    ET.SubElement(properties, f"{{{NS}}}Logo").text = r"Assets\StoreLogo.png"
    resources = ET.SubElement(package, f"{{{NS}}}Resources")
    ET.SubElement(resources, f"{{{NS}}}Resource", {"Language": "en-us"})
    dependencies = ET.SubElement(package, f"{{{NS}}}Dependencies")
    ET.SubElement(dependencies, f"{{{NS}}}TargetDeviceFamily", {"Name": "Windows.Desktop", "MinVersion": "10.0.17763.0", "MaxVersionTested": "10.0.26100.0"})
    applications = ET.SubElement(package, f"{{{NS}}}Applications")
    application = ET.SubElement(applications, f"{{{NS}}}Application", {"Id": "App", "Executable": "unnc-algolab.exe", "EntryPoint": "Windows.FullTrustApplication"})
    ET.SubElement(application, f"{{{UAP}}}VisualElements", {"DisplayName": "UNNC AlgoLab", "Description": "A pseudocode editor and interpreter for learning algorithms.", "BackgroundColor": "transparent", "Square150x150Logo": r"Assets\Square150x150Logo.png", "Square44x44Logo": r"Assets\Square44x44Logo.png"})
    capabilities = ET.SubElement(package, f"{{{NS}}}Capabilities")
    ET.SubElement(capabilities, f"{{{RESCAP}}}Capability", {"Name": "runFullTrust"})
    return ET.tostring(package, encoding="utf-8", xml_declaration=True)


def makeappx_path() -> Path:
    found = shutil.which("makeappx.exe")
    if found:
        return Path(found)
    program_files = os.environ.get("ProgramFiles(x86)")
    if program_files:
        sdk = Path(program_files) / "Windows Kits" / "10" / "bin"
        candidates = list(sdk.glob("*/x64/makeappx.exe")) + list(sdk.glob("*/arm64/makeappx.exe"))
        if candidates:
            return max(candidates, key=lambda item: tuple(int(part) for part in item.parent.parent.name.split(".")) + (item.parent.name == "x64",))
    raise FileNotFoundError("MakeAppx.exe not found. Install the Windows SDK or pass --makeappx.")


def stage_package(directory: Path, exe: Path, arch: str, name: str, publisher: str, version: str) -> None:
    if executable_architecture(exe) != arch:
        raise ValueError(f"Executable architecture does not match {arch}: {exe}")
    manifest = make_manifest(name, publisher, version, arch)
    directory.mkdir(parents=True, exist_ok=True)
    assets = directory / "Assets"
    assets.mkdir()
    for name in ("StoreLogo.png", "Square44x44Logo.png", "Square150x150Logo.png"):
        shutil.copy2(ASSETS / name, assets / name)
    shutil.copy2(exe, directory / "unnc-algolab.exe")
    (directory / "AppxManifest.xml").write_bytes(manifest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package-name", required=True, help="Package/Identity name from Partner Center")
    parser.add_argument("--publisher", required=True, help="Full Publisher value from Partner Center")
    parser.add_argument("--version", required=True, help="Store version, e.g. 1.1.11.0")
    parser.add_argument("--arch", required=True, choices=("x64", "arm64"))
    parser.add_argument("--exe", required=True, type=Path, help="Built Tauri executable for this architecture")
    parser.add_argument("--output", required=True, type=Path, help="Output .msix file")
    parser.add_argument("--makeappx", type=Path, help="Path to Windows SDK MakeAppx.exe")
    args = parser.parse_args()
    try:
        validate_identity(args.package_name, args.publisher, args.version)
        if args.output.suffix.lower() != ".msix":
            raise ValueError("Output must have an .msix extension.")
        if args.output.exists():
            raise FileExistsError(f"Output already exists: {args.output}")
        tool = args.makeappx or makeappx_path()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="unnc-msix-") as tmp:
            staging = Path(tmp) / "package"
            stage_package(staging, args.exe, args.arch, args.package_name, args.publisher, args.version)
            subprocess.run([str(tool), "pack", "/d", str(staging), "/p", str(args.output.resolve())], check=True)
        print(f"Created Store submission package: {args.output.resolve()}")
        print("Unsigned: do not use for direct installation. Submit to Partner Center for Store signing.")
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"MSIX packaging failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
