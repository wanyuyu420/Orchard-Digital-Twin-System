"""
JSON Stats Converter for HEC-RAS Integration
Copies and converts JSON stats files to the target directory.
"""
import json
import shutil
from pathlib import Path


def convert_stats():
    # Source and destination
    src_data = Path(r"D:\para\projects-windows\hec-vue\src\assets\data")
    dst_base = Path(r"D:\data\gis-data\simulation\hec-ras")

    # Mapping: source file -> (destination scenario, output name)
    file_mapping = {
        "reservoir_stats.json": ("kb", "stats.json"),
        "reservoir_outflow.json": ("kb", "outflow.json"),
        "river_volumes.json": ("flow", "stats.json"),
    }

    for src_name, (scenario, dst_name) in file_mapping.items():
        src_path = src_data / src_name
        dst_dir = dst_base / scenario
        dst_path = dst_dir / dst_name

        if not src_path.exists():
            print(f"[SKIP] {src_name} not found")
            continue

        dst_dir.mkdir(parents=True, exist_ok=True)

        # Load, add metadata, and save
        with open(src_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Wrap in a standard format if needed
        output = {
            "scenario": scenario,
            "source": src_name,
            "data": data
        }

        with open(dst_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"[OK] {src_name} -> {dst_path}")

    print("\nDone!")


if __name__ == "__main__":
    convert_stats()
