"""Extract tile images from TIF for YOLO-seg training."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from app.services.tif_service import TifService

TIF_PATH = "data/qc/orange_tree.tif"
TILE_META = "data/qc/yolo_dataset/tile_meta.json"
IMAGES_DIR = "data/qc/yolo_dataset/images"

os.makedirs(IMAGES_DIR, exist_ok=True)

with open(TILE_META) as f:
    tiles_meta = json.load(f)

tiles = list(TifService.slice_tif_generator(TIF_PATH, window_size=512, overlap=112))

# Only save tiles that have labels
label_tiles = set()
for fname in os.listdir("data/qc/yolo_dataset"):
    if fname.startswith("tile_") and fname.endswith(".txt"):
        label_tiles.add(fname.replace(".txt", ""))

label_tile_indices = {int(t.split("_")[1]) for t in label_tiles}
print(f"Labeled tiles: {label_tile_indices}")

saved = 0
for idx, tile_info in enumerate(tiles):
    if idx not in label_tile_indices:
        continue
    import cv2
    img = tile_info["tile_data"]
    path = os.path.join(IMAGES_DIR, f"tile_{idx:04d}.png")
    cv2.imwrite(path, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    saved += 1

print(f"Saved {saved} tile images to {IMAGES_DIR}/")
