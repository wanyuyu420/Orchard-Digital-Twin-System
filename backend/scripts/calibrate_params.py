"""Calibrate YOLO+SAM parameters against SHP ground truth (966 polygons).
Finds optimal conf, dedup distance, and SAM overlap threshold.
"""
import sys, os, json, time, itertools
import numpy as np
import rasterio
import geopandas as gpd
from shapely.geometry import Polygon as ShapelyPolygon, box as ShapelyBox

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

import torch
from app.services.yolo_service import YoloService
from app.services.sam_service import SamInferenceService
from app.services.tif_service import TifService

# ============================================================
TIF_PATH = "data/qc/orange_tree.tif"
SHP_PATH = "data/qc/orange_tree_shiliang.shp"
OUT_DIR = "data/qc/calibration"
os.makedirs(OUT_DIR, exist_ok=True)

# Parameter grids to test
CONFS = [0.03, 0.05, 0.06, 0.08, 0.10, 0.12]
DEDUP_DISTS = [0.5, 0.8, 1.2, 1.5]
TILE_SIZE = 512
OVERLAP = 112
PADDING = 0.08

# ============================================================
print("=" * 70)
print("YOLO+SAM Parameter Calibration vs SHP Ground Truth")
print("=" * 70)

# Load SHP ground truth
print("\nLoading SHP ground truth...")
gdf = gpd.read_file(SHP_PATH)
print(f"  {len(gdf)} polygons, CRS: {gdf.crs}")

# Load models
print("Loading models...")
yolo = YoloService.get_instance()
sam_pred = SamInferenceService.get_instance()

# Get TIF info
with rasterio.open(TIF_PATH) as src:
    tif_crs = str(src.crs)
    tif_transform = src.transform
    if gdf.crs != src.crs:
        gdf = gdf.to_crs(src.crs)

# Generate tiles once
tiles = list(TifService.slice_tif_generator(
    TIF_PATH, window_size=TILE_SIZE, overlap=OVERLAP))
print(f"Tiles: {len(tiles)}")

# ============================================================
# 1. Run YOLO+SAM at each conf level (heavy, do once)
# ============================================================
print("\nRunning YOLO+SAM at multiple conf levels...")

# Store all raw detections per conf
all_runs = {}

for conf in CONFS:
    print(f"  conf={conf}...", end=" ", flush=True)
    all_dets = []

    for idx, ti in enumerate(tiles):
        rgb = ti["tile_data"]
        vm = ti["valid_mask"]
        tx, ty = ti["window_x"], ti["window_y"]

        if rgb.max() < 10 or rgb.std() < 5:
            continue

        boxes = YoloService.detect_boxes(rgb, yolo, conf=conf, padding_ratio=PADDING)
        if len(boxes) == 0:
            continue

        sam_pred.set_image(rgb)
        for box in boxes:
            masks, scores, _ = sam_pred.predict(
                box=box[np.newaxis, :], multimask_output=False)
            m = masks[0]

            # Use lenient SAM filter during calibration (we'll score later)
            inter = np.logical_and(m, vm)
            if np.sum(inter) / max(np.sum(m), 1) < 0.5:
                continue

            y_idx, x_idx = np.where(m)
            px_cx = tx + float(np.mean(x_idx))
            px_cy = ty + float(np.mean(y_idx))
            geo_x, geo_y = rasterio.transform.xy(
                tif_transform, px_cy, px_cx, offset="center")

            all_dets.append({
                "geo_x": geo_x,
                "geo_y": geo_y,
                "score": float(scores[0]),
            })

    all_runs[conf] = all_dets
    print(f"{len(all_dets)} detections")

# ============================================================
# 2. Score each (conf, dedup_dist) combination
# ============================================================
print("\nScoring parameter combinations...")

def geo_dist(a, b):
    return ((a["geo_x"] - b["geo_x"])**2 + (a["geo_y"] - b["geo_y"])**2)**0.5

def deduplicate(detections, distance_m):
    kept = []
    used = set()
    # Sort by score desc
    sorted_dets = sorted(enumerate(detections), key=lambda x: x[1]["score"], reverse=True)
    for i, det in sorted_dets:
        if i in used:
            continue
        # Remove nearby lower-scored detections
        for j, other in enumerate(detections):
            if j != i and j not in used and geo_dist(det, other) < distance_m:
                used.add(j)
        kept.append(det)
        used.add(i)
    return kept

def score_against_shp(detections, gdf):
    """Score detections against SHP polygons.
    Returns: precision, recall, f1, count_delta"""
    # Create shapely points for detections
    from shapely.geometry import Point
    det_pts = [Point(d["geo_x"], d["geo_y"]) for d in detections]

    # Match each detection to nearest SHP polygon
    matched_shp = set()
    matched_det = 0

    for i, det in enumerate(detections):
        pt = Point(det["geo_x"], det["geo_y"])
        # Find nearest SHP polygon
        min_dist = float('inf')
        best_idx = -1
        for j, row in gdf.iterrows():
            if j in matched_shp:
                continue
            dist = pt.distance(row.geometry)
            if dist < min_dist:
                min_dist = dist
                best_idx = j
        # Match if within 1.5m of polygon boundary
        if min_dist < 1.5:
            matched_shp.add(best_idx)
            matched_det += 1

    precision = matched_det / max(len(detections), 1)
    recall = len(matched_shp) / max(len(gdf), 1)
    f1 = 2 * precision * recall / max(precision + recall, 0.001)
    count_error = abs(len(detections) - len(gdf))

    return {
        "det_count": len(detections),
        "shp_count": len(gdf),
        "matched_det": matched_det,
        "matched_shp": len(matched_shp),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "count_error": count_error,
        "count_ratio": round(len(detections) / len(gdf), 3),
    }

results = []
for conf, dets in all_runs.items():
    for dd in DEDUP_DISTS:
        deduped = deduplicate(dets, dd)
        metrics = score_against_shp(deduped, gdf)
        metrics["conf"] = conf
        metrics["dedup_m"] = dd
        results.append(metrics)

# Sort by F1 score
results.sort(key=lambda x: (x["f1"], -x["count_error"]), reverse=True)

# ============================================================
# 3. Report
# ============================================================
print()
print("=" * 70)
print("TOP 10 PARAMETER COMBINATIONS")
print("=" * 70)
print(f"{'Rank':<5} {'Conf':<7} {'Dedup':<7} {'Det':<6} {'MatchSHP':<9} {'Prec':<7} {'Rec':<7} {'F1':<7} {'CountErr':<8}")
print("-" * 70)

for rank, r in enumerate(results[:15]):
    print(f"{rank+1:<5} {r['conf']:<7} {r['dedup_m']:<7} {r['det_count']:<6} "
          f"{r['matched_shp']:<9} {r['precision']:<7.4f} {r['recall']:<7.4f} "
          f"{r['f1']:<7.4f} {r['count_error']:<8}")

# Also rank by count proximity (closest to 966)
by_count = sorted(results, key=lambda x: x["count_error"])
print()
print("=" * 70)
print("TOP 10 BY COUNT PROXIMITY (CLOSEST TO 966)")
print("=" * 70)
print(f"{'Rank':<5} {'Conf':<7} {'Dedup':<7} {'Det':<6} {'MatchSHP':<9} {'Prec':<7} {'Rec':<7} {'F1':<7} {'CountErr':<8}")
print("-" * 70)
for rank, r in enumerate(by_count[:15]):
    print(f"{rank+1:<5} {r['conf']:<7} {r['dedup_m']:<7} {r['det_count']:<6} "
          f"{r['matched_shp']:<9} {r['precision']:<7.4f} {r['recall']:<7.4f} "
          f"{r['f1']:<7.4f} {r['count_error']:<8}")

# Save full results
with open(os.path.join(OUT_DIR, "calibration_results.json"), "w") as f:
    json.dump(results, f, indent=2)
print(f"\nFull results saved to: {os.path.join(OUT_DIR, 'calibration_results.json')}")
print("Done.")
