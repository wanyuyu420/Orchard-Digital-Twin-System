"""YOLOv8s + SAM ViT-B — high-precision orchard demo segmentation

Key upgrades over previous script:
  - YOLO: best.pt (nano) → yolov8s_tree_crown.pt (small, tree-specific)
  - SAM:  mobile_sam.pt    → sam_vit_b_01ec64.pth (full SAM)
  - Outputs saved alongside input TIF
"""
import sys
import os
import json
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

import cv2
import rasterio
from shapely.geometry import Polygon, Point, mapping
import torch
from ultralytics import YOLO
from segment_anything import sam_model_registry, SamPredictor
from app.services.tif_service import TifService

# ============================================================
# Config
# ============================================================
BASE = "data/uploads"
INPUT_TIF = os.path.join(BASE, "2019081929_orchard_center_demo.tif")
OUT_PREFIX = os.path.join(BASE, "orchard_demo_v2")

YOLO_CONF = 0.30
TILE_SIZE = 1024
TILE_OVERLAP = 128
# YOLOv8s seg already outputs masks; if False, use SAM for refinement
USE_SAM_REFINE = True
SAM_SCORE_THRESH = 0.88

os.makedirs(BASE, exist_ok=True)

print("=" * 70)
print("YOLOv8s + SAM ViT-B — High-Precision Orchard Segmentation")
print("=" * 70)

# ============================================================
# 1. Load models
# ============================================================
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {device}")

print("Loading YOLOv8s (yolov8s_tree_crown.pt)...", end=" ", flush=True)
t0 = time.time()
yolo = YOLO("weights/yolov8s_tree_crown.pt")
print(f"{time.time() - t0:.1f}s")
print(f"  Task: {yolo.task}, Classes: {yolo.names}")

print("Loading SAM ViT-B (sam_vit_b_01ec64.pth)...", end=" ", flush=True)
t0 = time.time()
sam = sam_model_registry["vit_b"](checkpoint="weights/sam_vit_b_01ec64.pth")
sam.to(device=device)
sam.eval()
predictor = SamPredictor(sam)
print(f"{time.time() - t0:.1f}s")

# ============================================================
# 2. Read TIF
# ============================================================
print()
print("Reading TIF...")
with rasterio.open(INPUT_TIF) as src:
    tif_width = src.width
    tif_height = src.height
    tif_crs = str(src.crs)
    tif_transform = src.transform
    tif_profile = src.profile
    print(f"  Size: {tif_width} x {tif_height}, Bands: {src.count}")
    print(f"  CRS: {tif_crs}")

tiles = list(TifService.slice_tif_generator(INPUT_TIF, window_size=TILE_SIZE, overlap=TILE_OVERLAP))
print(f"  Tiles: {len(tiles)}")

# ============================================================
# 3. YOLOv8s detection + SAM refinement
# ============================================================
print()
print(f"Phase: YOLOv8s detection + SAM ViT-B refinement (conf={YOLO_CONF})")
print("-" * 70)

full_mask = np.zeros((tif_height, tif_width), dtype=np.uint8)
all_polygons = []
all_centroids = []
tree_id = 0

total_yolo_ms = 0.0
total_sam_enc_ms = 0.0
total_sam_dec_ms = 0.0
total_yolo_boxes = 0
total_sam_trees = 0

for idx, tile_info in enumerate(tiles):
    tile_rgb = tile_info["tile_data"].copy()
    valid_mask = tile_info["valid_mask"]
    wx = tile_info["window_x"]
    wy = tile_info["window_y"]

    # --- YOLOv8s Detection ---
    t0 = time.time()
    results = yolo(tile_rgb, verbose=False, conf=YOLO_CONF)
    yolo_ms = (time.time() - t0) * 1000

    boxes = results[0].boxes
    yolo_masks = results[0].masks

    if boxes is None:
        boxes_xyxy = np.empty((0, 4), dtype=np.float32)
    else:
        boxes_xyxy = boxes.xyxy.cpu().numpy()

    # --- SAM Encoder (if refining) ---
    enc_ms = 0.0
    dec_ms = 0.0
    masks_list = []

    if USE_SAM_REFINE and len(boxes_xyxy) > 0:
        t0 = time.time()
        predictor.set_image(tile_rgb)
        enc_ms = (time.time() - t0) * 1000

        for box in boxes_xyxy:
            t0 = time.time()
            mask, score, _ = predictor.predict(
                box=box[np.newaxis, :], multimask_output=False)
            dec_ms += (time.time() - t0) * 1000

            m = mask[0]
            intersection = np.logical_and(m, valid_mask)
            if (np.sum(intersection) / max(np.sum(m), 1) >= 0.8
                    and float(score[0]) >= SAM_SCORE_THRESH):
                masks_list.append((m, box, float(score[0])))
    elif not USE_SAM_REFINE and yolo_masks is not None:
        # Use YOLO's own masks directly
        for i, box in enumerate(boxes_xyxy):
            m = yolo_masks.data[i].cpu().numpy()
            m = (m > 0.5).astype(np.uint8)
            masks_list.append((m, box, 0.95))

    total_yolo_ms += yolo_ms
    total_sam_enc_ms += enc_ms
    total_sam_dec_ms += dec_ms
    total_yolo_boxes += len(boxes_xyxy)
    total_sam_trees += len(masks_list)

    # --- Map to full-image coords ---
    for m, box, score in masks_list:
        tree_id += 1
        mask_rows, mask_cols = np.where(m > 0)
        if len(mask_rows) < 10:
            continue

        global_rows = wy + mask_rows
        global_cols = wx + mask_cols
        valid = (global_rows >= 0) & (global_rows < tif_height) & \
                (global_cols >= 0) & (global_cols < tif_width)
        global_rows = global_rows[valid]
        global_cols = global_cols[valid]
        if len(global_rows) < 10:
            continue

        full_mask[global_rows, global_cols] = tree_id

        # Polygon from contour
        m_uint8 = m.astype(np.uint8)
        contours, _ = cv2.findContours(m_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            if len(cnt) < 4:
                continue
            epsilon = 0.005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True).squeeze(1)
            if approx.ndim < 2 or len(approx) < 4:
                continue
            global_pts = approx + np.array([wx, wy])
            all_polygons.append({
                "tree_id": tree_id,
                "score": float(score),
                "pixels": global_pts.tolist(),
            })
            cy, cx = np.mean(global_pts[:, 1]), np.mean(global_pts[:, 0])
            all_centroids.append({
                "tree_id": tree_id,
                "score": float(score),
                "pixel_x": float(cx),
                "pixel_y": float(cy),
            })
            break

    if idx % 2 == 0 or idx == len(tiles) - 1:
        tag = "SAM" if USE_SAM_REFINE else "YOLO-only"
        print(f"  [{idx+1}/{len(tiles)}] tile ({wx},{wy}) "
              f"YOLO:{len(boxes_xyxy):>3}box ({yolo_ms:>6.0f}ms) | "
              f"SAM enc:{enc_ms:>6.0f}ms dec:{dec_ms:>6.0f}ms | "
              f"kept:{len(masks_list):>3}trees [{tag}]")

# ============================================================
# 4. Visualization overlay
# ============================================================
print()
print("Generating visualization overlay...")

with rasterio.open(INPUT_TIF) as src:
    img_data = src.read([1, 2, 3])
    img_rgb = np.moveaxis(img_data, 0, -1)
    if img_rgb.dtype == np.uint16:
        img_rgb = (img_rgb / 65535.0 * 255).astype(np.uint8)
    h, w = img_rgb.shape[:2]

overlay = img_rgb.copy()
rng = np.random.RandomState(42)
unique_ids = np.unique(full_mask)
unique_ids = unique_ids[unique_ids > 0]

for tid in unique_ids:
    color = rng.randint(80, 255, 3).tolist()
    overlay[full_mask == tid] = (
        overlay[full_mask == tid] * 0.35 + np.array(color) * 0.65
    ).astype(np.uint8)

boundary = np.zeros((h, w), dtype=np.uint8)
for tid in unique_ids:
    m = (full_mask == tid).astype(np.uint8)
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(boundary, contours, -1, 255, 1)
overlay[boundary > 0] = [255, 255, 255]

overlay_path = OUT_PREFIX + "_overlay.png"
cv2.imwrite(overlay_path, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
print(f"  Saved: {overlay_path}")

# ============================================================
# 5. Georeferenced mask TIF
# ============================================================
print("Saving georeferenced mask TIF...")
binary_mask = (full_mask > 0).astype(np.uint8)
mask_profile = tif_profile.copy()
mask_profile.update({"count": 1, "dtype": "uint8", "compress": "lzw"})
mask_tif_path = OUT_PREFIX + "_masks.tif"
with rasterio.open(mask_tif_path, "w", **mask_profile) as dst:
    dst.write(binary_mask, 1)
print(f"  Saved: {mask_tif_path}")

# ============================================================
# 6. GeoJSON
# ============================================================
print("Converting to geo coordinates and saving GeoJSON...")

def pixel_to_geo(px, py):
    return rasterio.transform.xy(tif_transform, py, px, offset="center")

geojson_features = []
for poly in all_polygons:
    px_coords = poly["pixels"]
    geo_coords = []
    for px, py in px_coords:
        gx, gy = pixel_to_geo(px, py)
        geo_coords.append([gx, gy])
    if geo_coords and geo_coords[0] != geo_coords[-1]:
        geo_coords.append(geo_coords[0])
    if len(geo_coords) < 4:
        continue
    geom = Polygon(geo_coords)
    if not geom.is_valid:
        geom = geom.buffer(0)
    if geom.is_empty:
        continue
    geojson_features.append({
        "type": "Feature",
        "geometry": mapping(geom),
        "properties": {"tree_id": poly["tree_id"], "score": poly["score"]},
    })

polygons_geojson = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": tif_crs}},
    "features": geojson_features,
}
polygons_path = OUT_PREFIX + "_polygons.geojson"
with open(polygons_path, "w", encoding="utf-8") as f:
    json.dump(polygons_geojson, f, ensure_ascii=False, indent=2)
print(f"  Saved: {polygons_path} ({len(geojson_features)} polygons)")

centroid_features = []
for c in all_centroids:
    gx, gy = pixel_to_geo(c["pixel_x"], c["pixel_y"])
    centroid_features.append({
        "type": "Feature",
        "geometry": mapping(Point(gx, gy)),
        "properties": {"tree_id": c["tree_id"], "score": c["score"]},
    })
centroids_geojson = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": tif_crs}},
    "features": centroid_features,
}
centroids_path = OUT_PREFIX + "_centroids.geojson"
with open(centroids_path, "w", encoding="utf-8") as f:
    json.dump(centroids_geojson, f, ensure_ascii=False, indent=2)
print(f"  Saved: {centroids_path} ({len(centroid_features)} centroids)")

# ============================================================
# 7. Summary
# ============================================================
n_tiles = len(tiles)
print()
print("=" * 70)
print("SEGMENTATION COMPLETE — Summary")
print("=" * 70)
print(f"  YOLO model:    yolov8s_tree_crown.pt (small, tree-specific)")
print(f"  SAM model:     sam_vit_b_01ec64.pth (full ViT-B)")
print(f"  Image size:    {tif_width} x {tif_height}")
print(f"  Tiles:         {n_tiles} ({TILE_SIZE}x{TILE_SIZE})")
print()
print(f"  YOLOv8s:")
print(f"    Total time:  {total_yolo_ms:.0f}ms")
print(f"    Avg/tile:    {total_yolo_ms/n_tiles:.1f}ms")
print(f"    Total boxes: {total_yolo_boxes}")
print()
print(f"  SAM ViT-B:")
print(f"    Enc total:   {total_sam_enc_ms:.0f}ms")
print(f"    Dec total:   {total_sam_dec_ms:.0f}ms")
print(f"    Avg/tile:    {(total_sam_enc_ms + total_sam_dec_ms)/n_tiles:.1f}ms")
print()
print(f"  Trees:         {total_sam_trees} masks, {len(unique_ids)} unique")
print(f"  Polygons:      {len(geojson_features)}")
print(f"  Centroids:     {len(centroid_features)}")
print()
total_s = (total_yolo_ms + total_sam_enc_ms + total_sam_dec_ms) / 1000
print(f"  Pipeline time: {total_s:.1f}s (excl. model loading)")
print()
print(f"  Outputs:")
print(f"    {overlay_path}")
print(f"    {mask_tif_path}")
print(f"    {polygons_path}")
print(f"    {centroids_path}")
print("=" * 70)
print("Done.")
