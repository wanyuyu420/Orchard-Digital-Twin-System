"""
Visual overlay: YOLO+SAM detections vs SHP ground truth on sample tiles.
Red = SHP polygons, Green = YOLO+Sam detections.
Purpose: diagnose why F1 is only 0.52 - real misses or alignment issues?
"""
import sys, os, json
import numpy as np
import cv2
import rasterio
import geopandas as gpd
from shapely.geometry import Point, Polygon as ShapelyPolygon

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

import torch
from app.services.yolo_service import YoloService
from app.services.sam_service import SamInferenceService
from app.services.tif_service import TifService

TIF_PATH = "data/qc/orange_tree.tif"
SHP_PATH = "data/qc/orange_tree_shiliang.shp"
OUT_DIR = "data/qc/diagnosis"
os.makedirs(OUT_DIR, exist_ok=True)

CONF = 0.06
DEDUP_M = 0.8
TILE_SIZE = 512
OVERLAP = 112

print("Loading SHP...")
gdf = gpd.read_file(SHP_PATH)
print(f"  {len(gdf)} polygons")

print("Loading models...")
yolo = YoloService.get_instance()
sam_pred = SamInferenceService.get_instance()

with rasterio.open(TIF_PATH) as src:
    tif_transform = src.transform
    if gdf.crs != src.crs:
        gdf = gdf.to_crs(src.crs)

tiles = list(TifService.slice_tif_generator(
    TIF_PATH, window_size=TILE_SIZE, overlap=OVERLAP))

print(f"Running YOLO+SAM at conf={CONF}...")
all_detections = []

for idx, ti in enumerate(tiles):
    rgb = ti["tile_data"]
    vm = ti["valid_mask"]
    tx, ty = ti["window_x"], ti["window_y"]

    if rgb.max() < 10 or rgb.std() < 5:
        continue

    boxes = YoloService.detect_boxes(rgb, yolo, conf=CONF, padding_ratio=0.08)
    if len(boxes) == 0:
        continue

    sam_pred.set_image(rgb)
    for box in boxes:
        masks, scores, _ = sam_pred.predict(
            box=box[np.newaxis, :], multimask_output=False)
        m = masks[0]
        inter = np.logical_and(m, vm)
        if np.sum(inter) / max(np.sum(m), 1) < 0.5:
            continue

        y_idx, x_idx = np.where(m)
        px_cx = tx + float(np.mean(x_idx))
        px_cy = ty + float(np.mean(y_idx))
        geo_x, geo_y = rasterio.transform.xy(
            tif_transform, px_cy, px_cx, offset="center")

        all_detections.append({
            "geo_x": geo_x, "geo_y": geo_y,
            "tile_idx": idx, "tile_x": tx, "tile_y": ty,
            "px_cx": px_cx, "px_cy": px_cy,
        })

print(f"  {len(all_detections)} raw detections")

# Deduplicate
def geo_dist(a, b):
    return ((a["geo_x"]-b["geo_x"])**2 + (a["geo_y"]-b["geo_y"])**2)**0.5
sorted_dets = sorted(all_detections, key=lambda d: d.get("score", 0), reverse=True)
deduped = []
used = set()
for i, d in enumerate(sorted_dets):
    if i in used:
        continue
    for j in range(i+1, len(sorted_dets)):
        if j not in used and geo_dist(d, sorted_dets[j]) < DEDUP_M:
            used.add(j)
    deduped.append(d)
    used.add(i)

print(f"  {len(deduped)} after {DEDUP_M}m dedup")

# Group deduped detections by tile
tile_dets = {}
for d in deduped:
    tid = d["tile_idx"]
    if tid not in tile_dets:
        tile_dets[tid] = []
    tile_dets[tid].append(d)

# Draw 8 tiles with worst alignment
print("Drawing overlay tiles...")
drawn = 0
for idx, ti in enumerate(tiles):
    if drawn >= 8:
        break
    rgb = ti["tile_data"]
    if rgb.max() < 10 or rgb.std() < 5:
        continue

    tx, ty = ti["window_x"], ti["window_y"]
    h, w = rgb.shape[:2]

    # Get tile geo bounds
    left, top = rasterio.transform.xy(tif_transform, ty, tx, offset="ul")
    right, bottom = rasterio.transform.xy(tif_transform, ty+h, tx+w, offset="ul")
    tile_box = ShapelyPolygon([
        (left, top), (right, top), (right, bottom), (left, bottom), (left, top)
    ])

    # Get SHP polygons intersecting this tile
    shp_in_tile = gdf[gdf.intersects(tile_box)]

    # Get YOLO+Sam detections in this tile
    dets = tile_dets.get(idx, [])

    # Skip tiles with no detections and no SHP
    if len(shp_in_tile) == 0 and len(dets) == 0:
        continue

    overlay = rgb.copy()

    # Draw SHP polygons in RED
    for _, row in shp_in_tile.iterrows():
        geom = row.geometry
        if geom.geom_type == "MultiPolygon":
            polys = list(geom.geoms)
        elif geom.geom_type == "Polygon":
            polys = [geom]
        else:
            continue
        for poly in polys:
            pts = []
            for gx, gy in zip(*poly.exterior.coords.xy):
                col, row = rasterio.transform.rowcol(tif_transform, gx, gy)
                lx = int(col - tx)
                ly = int(row - ty)
                pts.append([lx, ly])
            if len(pts) >= 3:
                cv2.polylines(overlay, [np.array(pts, dtype=np.int32)], True, (255, 0, 0), 1)

    # Draw YOLO+Sam centroids in GREEN (dots)
    for d in dets:
        lx = int(d["px_cx"] - tx)
        ly = int(d["px_cy"] - ty)
        if 0 <= lx < w and 0 <= ly < h:
            cv2.circle(overlay, (lx, ly), 4, (0, 255, 0), -1)

    out_path = os.path.join(OUT_DIR, f"tile_{idx:02d}_overlay.png")
    cv2.imwrite(out_path, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
    drawn += 1
    print(f"  saved {out_path} (SHP={len(shp_in_tile)}, YOLO={len(dets)})")

print(f"\nOverlay images saved to: {OUT_DIR}/")
print("RED = SHP polygons, GREEN dots = YOLO+Sam centroids")
print("Done.")
