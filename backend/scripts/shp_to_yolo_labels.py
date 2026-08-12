"""
Convert QC shapefile (manual annotations) to YOLO-seg training labels.
Input:  data/qc/orange_tree_shiliang.shp + data/qc/orange_tree.tif
Output: YOLO-seg dataset ready for fine-tuning
"""
import sys
import os
import json
import rasterio
import numpy as np
import geopandas as gpd
from shapely.geometry import box as shapely_box
from rasterio import features

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

# ============================================================
SHP_PATH = "data/qc/orange_tree_shiliang.shp"
TIF_PATH = "data/qc/orange_tree.tif"
OUT_DIR = "data/qc/yolo_dataset"
TILE_SIZE = 512
OVERLAP = 112   # same as inference
STRIDE = TILE_SIZE - OVERLAP

os.makedirs(OUT_DIR, exist_ok=True)

print("Loading SHP...")
gdf = gpd.read_file(SHP_PATH)
print(f"  {len(gdf)} polygons, CRS: {gdf.crs}")

# Ensure CRS matches TIF
with rasterio.open(TIF_PATH) as src:
    tif_bounds = src.bounds
    tif_transform = src.transform
    tif_w, tif_h = src.width, src.height
print(f"  TIF: {tif_w}x{tif_h}, bounds={src.bounds}")

# Reproject SHP to TIF pixel CRS if needed
if gdf.crs != src.crs:
    gdf = gdf.to_crs(src.crs)
    print(f"  Reprojected SHP to {src.crs}")

# Generate tile grid
tiles_info = []
for y in range(0, tif_h, STRIDE):
    for x in range(0, tif_w, STRIDE):
        w = min(TILE_SIZE, tif_w - x)
        h = min(TILE_SIZE, tif_h - y)
        # tile bbox in TIF pixel coords
        tile_px_bbox = shapely_box(x, y, x + w, y + h)
        # tile bbox in geo coords
        left, top = rasterio.transform.xy(tif_transform, y, x, offset="ul")
        right, bottom = rasterio.transform.xy(tif_transform, y + h, x + w, offset="ul")
        tile_geo_bbox = shapely_box(left, bottom, right, top)  # shapely uses minx,miny,maxx,maxy

        tiles_info.append({
            "idx": len(tiles_info),
            "px_x": x, "px_y": y, "px_w": w, "px_h": h,
            "px_bbox": tile_px_bbox,
            "geo_bbox": tile_geo_bbox,
        })

print(f"  Tiles: {len(tiles_info)} ({TILE_SIZE}x{TILE_SIZE}, stride={STRIDE})")

# For each tile, find intersecting SHP polygons and convert to YOLO-seg format
label_files = 0
total_labels = 0

for tile in tiles_info:
    # Spatial join: which polygons intersect this tile
    intersecting = gdf[gdf.intersects(tile["geo_bbox"])]

    if len(intersecting) == 0:
        continue

    label_lines = []

    for _, row in intersecting.iterrows():
        geom = row.geometry.intersection(tile["geo_bbox"])

        if geom.is_empty:
            continue

        # Handle MultiPolygon by taking each part
        if geom.geom_type == "MultiPolygon":
            polygons = list(geom.geoms)
        elif geom.geom_type == "Polygon":
            polygons = [geom]
        else:
            continue

        for poly in polygons:
            if poly.is_empty:
                continue

            # Geo coords -> TIF pixel coords
            px_coords = []
            for gx, gy in zip(*poly.exterior.coords.xy):
                # rasterio transform: row, col from geo
                col, row = rasterio.transform.rowcol(tif_transform, gx, gy)
                # Convert to tile-local pixel
                local_x = col - tile["px_x"]
                local_y = row - tile["px_y"]
                px_coords.append((local_x, local_y))

            if len(px_coords) < 3:
                continue

            # Normalize to 0-1 within tile (use actual tile w/h, then clip)
            norm_parts = []
            tw, th = tile["px_w"], tile["px_h"]
            for lx, ly in px_coords:
                nx = max(0.0, min(1.0, lx / tw))
                ny = max(0.0, min(1.0, ly / th))
                norm_parts.append(f"{nx:.6f}")
                norm_parts.append(f"{ny:.6f}")

            label_lines.append(f"0 {' '.join(norm_parts)}")
            total_labels += 1

    if label_lines:
        label_path = os.path.join(OUT_DIR, f"tile_{tile['idx']:04d}.txt")
        with open(label_path, "w") as f:
            f.write("\n".join(label_lines))
        label_files += 1

print(f"\nLabels written: {total_labels} polygons across {label_files}/{len(tiles_info)} tiles")

# Save tile geometry to a JSON so we can reconstruct later
tile_meta = []
for t in tiles_info:
    tile_meta.append({
        "idx": t["idx"], "px_x": t["px_x"], "px_y": t["px_y"],
        "px_w": t["px_w"], "px_h": t["px_h"],
    })
with open(os.path.join(OUT_DIR, "tile_meta.json"), "w") as f:
    json.dump(tile_meta, f, indent=2)

print(f"Tile metadata: {os.path.join(OUT_DIR, 'tile_meta.json')}")
print(f"\nOutput dir: {OUT_DIR}/")
print("Done.")
