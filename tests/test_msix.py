import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_msix", ROOT / "scripts" / "package_msix.py")
msix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(msix)


def make_pe(path, machine):
    data = bytearray(134)
    data[:2] = b"MZ"
    struct.pack_into("<I", data, 60, 128)
    data[128:132] = b"PE\0\0"
    struct.pack_into("<H", data, 132, machine)
    path.write_bytes(data)


class StorePackageTests(unittest.TestCase):
    def test_manifest_uses_store_identity_and_full_trust(self):
        xml = msix.make_manifest("12345.UNNCAlgoLab", "CN=Yinxi ZHOU & Co", "1.1.11.0", "arm64")
        root = ET.fromstring(xml)
        identity = root.find(f"{{{msix.NS}}}Identity")
        self.assertEqual(identity.attrib["Publisher"], "CN=Yinxi ZHOU & Co")
        self.assertEqual(identity.attrib["ProcessorArchitecture"], "arm64")
        self.assertEqual(identity.attrib["Version"], "1.1.11.0")
        self.assertIsNotNone(root.find(f".//{{{msix.RESCAP}}}Capability[@Name='runFullTrust']"))

    def test_store_rejects_requested_version_and_bad_identity(self):
        for version in ("0.1.11.5", "0.1.11.0", "1.1.11.5", "1.1.beta.0", "65536.1.1.0"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                msix.validate_identity("12345.UNNCAlgoLab", "CN=Example", version)
        with self.assertRaises(ValueError):
            msix.validate_identity("not a store name", "CN=Example", "1.1.11.0")
        with self.assertRaises(ValueError):
            msix.validate_identity("12345.UNNCAlgoLab", "Yinxi ZHOU", "1.1.11.0")

    def test_staging_rejects_wrong_architecture(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            binary = path / "app.exe"
            make_pe(binary, 0xAA64)
            with self.assertRaisesRegex(ValueError, "architecture"):
                msix.stage_package(path / "wrong", binary, "x64", "12345.UNNCAlgoLab", "CN=Example", "1.1.11.0")
            msix.stage_package(path / "correct", binary, "arm64", "12345.UNNCAlgoLab", "CN=Example", "1.1.11.0")
            self.assertEqual((path / "correct" / "unnc-algolab.exe").read_bytes(), binary.read_bytes())
            self.assertTrue((path / "correct" / "Assets" / "Square44x44Logo.png").is_file())


if __name__ == "__main__":
    unittest.main()
