"""
PNG to WebP Batch Converter for HEC-RAS Simulation Frames
Converts PNG files to WebP format with ~60% size reduction.
"""
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    os.system(f"{sys.executable} -m pip install Pillow")
    from PIL import Image


def convert_png_to_webp(src_path: Path, dst_path: Path, quality: int = 85) -> tuple:
    """Convert a single PNG to WebP."""
    try:
        with Image.open(src_path) as img:
            # Preserve transparency
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')

            img.save(dst_path, 'WEBP', quality=quality, method=4)

            src_size = src_path.stat().st_size
            dst_size = dst_path.stat().st_size
            savings = (1 - dst_size / src_size) * 100
            return (src_path.name, True, savings)
    except Exception as e:
        return (src_path.name, False, str(e))


def process_scenario(name: str, src_dir: Path, dst_dir: Path, quality: int = 85):
    """Process all PNG files in a scenario directory."""
    print(f"\n[{name}] Processing {src_dir}")

    png_files = sorted(src_dir.glob("*.png"))
    total = len(png_files)
    print(f"[{name}] Found {total} PNG files")

    if total == 0:
        print(f"[{name}] No files to process")
        return

    dst_dir.mkdir(parents=True, exist_ok=True)

    converted = 0
    total_savings = 0

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}
        for png_path in png_files:
            webp_name = png_path.stem + ".webp"
            webp_path = dst_dir / webp_name
            futures[executor.submit(
                convert_png_to_webp, png_path, webp_path, quality)] = png_path

        for future in as_completed(futures):
            name_file, success, result = future.result()
            if success:
                converted += 1
                total_savings += result
                if converted % 50 == 0:
                    print(f"[{name}] Converted {converted}/{total}...")
            else:
                print(f"[{name}] Failed: {name_file} - {result}")

    avg_savings = total_savings / converted if converted > 0 else 0
    print(f"[{name}] Done! {converted}/{total} files, avg ~{avg_savings:.1f}% size reduction")


def main():
    # Source directories (hec-vue project)
    hec_vue_assets = Path(r"D:\para\projects-windows\hec-vue\src\assets")

    # Destination directories (local GIS data)
    gis_data_base = Path(r"D:\data\gis-data\simulation\hec-ras")

    scenarios = [
        ("kb", hec_vue_assets / "results_png_kb", gis_data_base / "kb" / "frames"),
        ("flow", hec_vue_assets / "results_png_flow",
         gis_data_base / "flow" / "frames"),
    ]

    print("=" * 60)
    print("HEC-RAS PNG to WebP Converter")
    print("=" * 60)

    for name, src, dst in scenarios:
        if not src.exists():
            print(f"[{name}] Source directory not found: {src}")
            continue
        process_scenario(name, src, dst, quality=85)

    print("\n" + "=" * 60)
    print("Conversion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
