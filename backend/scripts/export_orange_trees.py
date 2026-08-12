"""Export pipeline: YOLO + SAM -> GeoJSON (QGIS review) + YOLO-seg labels (training).

Outputs:
  1. GeoJSON with polygon contours, centroids, bboxes — drag into QGIS
  2. YOLO-seg .txt labels per tile — ready for fine-tuning
  3. Overlay PNGs — quick visual sanity check
"""
import sys
import os
import json
import time
import numpy as np
import cv2
import rasterio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

import torch
from app.services.yolo_service import YoloService
from app.services.sam_service import SamInferenceService
from app.services.tif_service import TifService

# ============================================================
INPUT_TIF = "data/orange_tree.tif"
OUT_DIR = "data/orange_tree_export"
TILE_SIZE = 512
TILE_OVERLAP = 112
YOLO_CONF = 0.08
BOX_PADDING = 0.08
DEDUP_DIST_M = 0.8         # trees within 0.8m geo are merged

os.makedirs(OUT_DIR, exist_ok=True)

print("=" * 70)
print("YOLO + SAM -> GeoJSON + YOLO-seg Export")
print("=" * 70)
print(f"Input: {INPUT_TIF}")
print(f"conf={YOLO_CONF}, overlap={TILE_OVERLAP}, padding={BOX_PADDING*100:.0f}%")
print()

# --- Load models ---
device = "cuda" if torch.cuda.is_available() else "cpu"
yolo = YoloService.get_instance()
sam_pred = SamInferenceService.get_instance()
print(f"Device: {device} | GPU: {torch.cuda.get_device_name(0) if device=='cuda' else 'CPU'}")
print()

# --- TIF info ---
with rasterio.open(INPUT_TIF) as src:
    tif_crs = str(src.crs)
    tif_transform = src.transform
    print(f"TIF: {src.width}x{src.height}, CRS: {tif_crs}")

tiles = list(TifService.slice_tif_generator(INPUT_TIF, window_size=TILE_SIZE, overlap=TILE_OVERLAP))
print(f"Tiles: {len(tiles)}")
print()

# --- Per-tile YOLO + SAM, collecting all trees ---
all_trees = []   # {mask, px_centroid, geo_centroid, bbox_px, area_px, tile_idx, score}

for idx, tile_info in enumerate(tiles):
    tile_rgb = tile_info["tile_data"].copy()
    valid_mask = tile_info["valid_mask"]
    tx, ty = tile_info["window_x"], tile_info["window_y"]

    if tile_rgb.max() < 10 or tile_rgb.std() < 5:
        continue

    # YOLO
    boxes = YoloService.detect_boxes(tile_rgb, yolo, conf=YOLO_CONF, padding_ratio=BOX_PADDING)
    if len(boxes) == 0:
        continue

    # SAM encoder
    sam_pred.set_image(tile_rgb)

    for box in boxes:
        masks, scores, _ = sam_pred.predict(box=box[np.newaxis, :], multimask_output=False)
        m = masks[0]
        inter = np.logical_and(m, valid_mask)
        if np.sum(inter) / max(np.sum(m), 1) < 0.8:
            continue

        y_idx, x_idx = np.where(m)
        px_cx = tx + float(np.mean(x_idx))
        px_cy = ty + float(np.mean(y_idx))

        # pixel -> geo
        geo_x, geo_y = rasterio.transform.xy(tif_transform, px_cy, px_cx, offset="center")

        # bbox in full-image pixel coords
        bx1, by1, bx2, by2 = box
        bx1 += tx; by1 += ty; bx2 += tx; by2 += ty

        all_trees.append({
            "mask_px": m.copy(),
            "tile_x": tx,
            "tile_y": ty,
            "px_cx": px_cx,
            "px_cy": px_cy,
            "geo_x": geo_x,
            "geo_y": geo_y,
            "bbox_px": (float(bx1), float(by1), float(bx2), float(by2)),
            "area_px": int(np.sum(m)),
            "score": float(scores[0]),
            "tile_idx": idx,
        })

    if (idx + 1) % 5 == 0:
        print(f"  tile {idx:>3} | boxes:{len(boxes):>3} kept:{len(all_trees):>4} trees so far")

print(f"\nRaw detections: {len(all_trees)}")

# --- Deduplicate by geo distance (handles overlap regions) ---
def geo_dist(a, b):
    return ((a["geo_x"] - b["geo_x"]) ** 2 + (a["geo_y"] - b["geo_y"]) ** 2) ** 0.5

deduped = []
used = set()
for i, tree in enumerate(all_trees):
    if i in used:
        continue
    # find all trees within DEDUP_DIST_M
    cluster = [j for j in range(i + 1, len(all_trees))
               if j not in used and geo_dist(tree, all_trees[j]) < DEDUP_DIST_M]
    # keep highest-score one
    best = tree
    for j in cluster:
        used.add(j)
        if all_trees[j]["score"] > best["score"]:
            best = all_trees[j]
    deduped.append(best)
    used.add(i)

print(f"After dedup ({DEDUP_DIST_M}m): {len(deduped)} trees")

# ============================================================
# 1. Export GeoJSON (for QGIS review)
# ============================================================
geojson_path = os.path.join(OUT_DIR, "orange_trees.geojson")
features = []

for i, tree in enumerate(deduped):
    m = tree["mask_px"]
    tx, ty = tree["tile_x"], tree["tile_y"]

    # Extract contour and convert to geo
    contours, _ = cv2.findContours(
        m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        continue

    # Use largest contour, simplify
    contour = max(contours, key=cv2.contourArea)
    epsilon = 0.005 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    pts = approx.squeeze(1)  # (N, 2) in tile-local [x, y]

    if pts.ndim != 2 or len(pts) < 3:
        continue

    # Convert tile-local -> full-image pixel -> geo
    geo_coords = []
    for px, py in pts:
        full_px = tx + float(px)
        full_py = ty + float(py)
        gx, gy = rasterio.transform.xy(tif_transform, full_py, full_px, offset="center")
        geo_coords.append([gx, gy])

    b = tree["bbox_px"]
    features.append({
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [geo_coords],
        },
        "properties": {
            "tree_id": i,
            "geo_x": tree["geo_x"],
            "geo_y": tree["geo_y"],
            "area_px": tree["area_px"],
            "area_m2": round(tree["area_px"] * 0.03 * 0.03, 2),  # rough ~3cm/pixel
            "score": round(tree["score"], 4),
            "bbox": list(b),
            "status": "auto",       # user changes to "confirmed" / "missed" / "false"
        },
    })

geojson = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": tif_crs}},
    "features": features,
}

with open(geojson_path, "w", encoding="utf-8") as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)
print(f"\nGeoJSON: {geojson_path} ({len(features)} polygons)")

# ============================================================
# 2. Export YOLO-seg training labels (one .txt per tile)
# ============================================================
labels_dir = os.path.join(OUT_DIR, "yolo_seg_labels")
os.makedirs(labels_dir, exist_ok=True)

# Group detections by tile
tile_trees = {}
for tree in all_trees:  # use raw (not deduped) so each tile is complete
    tid = tree["tile_idx"]
    if tid not in tile_trees:
        tile_trees[tid] = []
    tile_trees[tid].append(tree)

for tid, trees in tile_trees.items():
    label_lines = []
    for tree in trees:
        m = tree["mask_px"]
        contours, _ = cv2.findContours(
            m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        pts = approx.squeeze(1)

        if pts.ndim != 2 or len(pts) < 3:
            continue

        # Normalize to 0-1 within tile
        norm_pts = []
        for px, py in pts:
            norm_pts.append(f"{px / TILE_SIZE:.6f}")
            norm_pts.append(f"{py / TILE_SIZE:.6f}")

        label_lines.append(f"0 {' '.join(norm_pts)}")

    if label_lines:
        label_path = os.path.join(labels_dir, f"tile_{tid:04d}.txt")
        with open(label_path, "w") as f:
            f.write("\n".join(label_lines))

print(f"YOLO-seg labels: {labels_dir}/tile_*.txt ({len(tile_trees)} tiles)")

# ============================================================
# 3. Save masks as compressed npz (for later reload, no re-inference)
# ============================================================
npz_path = os.path.join(OUT_DIR, "tree_masks.npz")
mask_arrays = {}
for i, tree in enumerate(deduped):
    mask_arrays[f"mask_{i}"] = tree["mask_px"]
    mask_arrays[f"tile_x_{i}"] = np.array(tree["tile_x"])
    mask_arrays[f"tile_y_{i}"] = np.array(tree["tile_y"])
np.savez_compressed(npz_path, **mask_arrays)
print(f"Masks (backup): {npz_path}")

# ============================================================
# Summary
# ============================================================
print()
print("=" * 70)
print("EXPORT COMPLETE")
print("=" * 70)
print(f"  Trees detected:     {len(deduped)}")
print(f"  GeoJSON:            {geojson_path}")
print(f"  YOLO-seg labels:    {labels_dir}/")
print(f"  Mask backup:        {npz_path}")
print()
print("Next steps:")
print("  1. Open GeoJSON in QGIS -> review -> change 'status' for missed trees")
print("  2. Manually label missed trees, add their masks to the dataset")
print("  3. Use yolo_seg_labels/ + data_fixed_v3.yaml to fine-tune")
print("=" * 70)
