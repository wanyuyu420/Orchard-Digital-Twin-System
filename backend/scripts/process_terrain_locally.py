"""
Local Terrain Processing Script
Converts DEM GeoTIFF to Cesium quantized-mesh terrain tiles using CTB (Docker)

Prerequisites:
1. Install Docker Desktop
2. Pull CTB image: docker pull geodesy/cesium-terrain-builder

Usage:
1. Run this script to see the Docker commands
2. Execute the commands in a terminal with Docker access
"""
import os
import subprocess
import sys

# Configuration
DEM_SOURCE = r"D:\data\gis-data\dem\cesium_use.tif"
OUTPUT_DIR = r"D:\para\projects-windows\water-digital-twin-platform\local\terrain\xinjiang"
DOCKER_IMAGE = "geodesy/cesium-terrain-builder"

# Windows paths need to be converted for Docker mount
# D:\data\gis-data -> /d/data/gis-data (Docker format)


def to_docker_path(win_path: str) -> str:
    """Convert Windows path to Docker mount format"""
    # D:\data\gis-data -> /d/data/gis-data
    drive = win_path[0].lower()
    rest = win_path[2:].replace("\\", "/")
    return f"/{drive}{rest}"


def main():
    print("=" * 60)
    print("Local Terrain Processing Guide")
    print("=" * 60)

    # Check if Docker is available
    try:
        result = subprocess.run(["docker", "--version"],
                                capture_output=True, text=True)
        print(f"\n✓ Docker found: {result.stdout.strip()}")
    except FileNotFoundError:
        print("\n✗ Docker not found! Please install Docker Desktop first.")
        print("  Download: https://www.docker.com/products/docker-desktop/")
        sys.exit(1)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n✓ Output directory: {OUTPUT_DIR}")

    # Docker mount paths
    dem_dir = os.path.dirname(DEM_SOURCE)
    dem_file = os.path.basename(DEM_SOURCE)
    dem_docker = to_docker_path(dem_dir)
    out_docker = to_docker_path(OUTPUT_DIR)

    print("\n" + "=" * 60)
    print("Run the following commands in PowerShell/Command Prompt:")
    print("=" * 60)

    # Step 1: Pull Docker image
    print("\n# Step 1: Pull CTB Docker image (one-time)")
    print(f"docker pull {DOCKER_IMAGE}")

    # Step 2: Generate terrain tiles
    print("\n# Step 2: Generate quantized-mesh tiles (takes 1-2 hours for 1.4GB)")
    cmd_tiles = f'''docker run --rm ^
  -v "{dem_dir}:{dem_docker}" ^
  -v "{OUTPUT_DIR}:{out_docker}" ^
  {DOCKER_IMAGE} ^
  ctb-tile -f Mesh -C -N -o {out_docker} {dem_docker}/{dem_file}'''
    print(cmd_tiles)

    # Step 3: Generate layer.json
    print("\n# Step 3: Generate layer.json metadata")
    cmd_layer = f'''docker run --rm ^
  -v "{dem_dir}:{dem_docker}" ^
  -v "{OUTPUT_DIR}:{out_docker}" ^
  {DOCKER_IMAGE} ^
  ctb-tile -f Mesh -C -N -l -o {out_docker} {dem_docker}/{dem_file}'''
    print(cmd_layer)

    print("\n" + "=" * 60)
    print("After processing completes, verify:")
    print(f"  - {OUTPUT_DIR}\\layer.json exists")
    print(f"  - {OUTPUT_DIR}\\0\\0\\0.terrain exists")
    print("=" * 60)

    print("\nThen restart the backend server to serve the local terrain.")


if __name__ == "__main__":
    main()
