"""
Generate frame manifest files for HEC-RAS scenarios.
Creates JSON files listing all WebP frames in sorted order.
"""
import json
from pathlib import Path


def generate_manifest(frames_dir: Path, output_path: Path):
    """Generate manifest JSON for a frames directory."""
    if not frames_dir.exists():
        print(f"[SKIP] {frames_dir} not found")
        return

    # Get all WebP files sorted by name
    frames = sorted([f.name for f in frames_dir.glob("*.webp")])

    manifest = {
        "total": len(frames),
        "frames": frames
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"[OK] Generated {output_path} with {len(frames)} frames")


def main():
    base_dir = Path(r"D:\data\gis-data\simulation\hec-ras")

    scenarios = ["kb", "flow"]

    for scenario in scenarios:
        frames_dir = base_dir / scenario / "frames"
        output_path = base_dir / scenario / "manifest.json"
        generate_manifest(frames_dir, output_path)

    print("\nDone!")


if __name__ == "__main__":
    main()
