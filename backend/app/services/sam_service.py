import os
import torch
import numpy as np

# CPU thread binding — must happen BEFORE any PyTorch model creation
_NUM_THREADS = os.cpu_count() or 4
torch.set_num_threads(min(_NUM_THREADS, 8))
os.environ["OMP_NUM_THREADS"] = str(min(_NUM_THREADS, 8))
os.environ["MKL_NUM_THREADS"] = str(min(_NUM_THREADS, 8))

from mobile_sam import sam_model_registry, SamPredictor


class SamInferenceService:
    _instance = None
    _predictor = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            print("[SamService] Loading MobileSAM (Box Prompt mode)...")
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            checkpoint_path = os.path.join(os.path.dirname(BASE_DIR), "weights", "mobile_sam.pt")

            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(BASE_DIR, "..", "weights", "mobile_sam.pt")

            print(f"[SamService] Checkpoint: {checkpoint_path}")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[SamService] Device: {device}  |  CPU threads: {torch.get_num_threads()}")

            sam = sam_model_registry["vit_t"](checkpoint=checkpoint_path)
            sam.to(device=device)
            sam.eval()

            cls._predictor = SamPredictor(sam)
            cls._instance = sam
            print("[SamService] MobileSAM + SamPredictor loaded successfully!")

        return cls._predictor

    @staticmethod
    def infer_tile_with_boxes(tile_rgb, valid_mask, boxes_xyxy, predictor):
        """
        Run SAM Box-Prompt inference on a tile.
        boxes_xyxy: np.ndarray of shape (N, 4) in [x1, y1, x2, y2] format.
        Returns list of tree dicts with centroid, area, mask.
        """
        if len(boxes_xyxy) == 0:
            return []

        predictor.set_image(tile_rgb)

        filtered_trees = []
        for box in boxes_xyxy:
            masks, scores, _ = predictor.predict(
                box=box[np.newaxis, :],
                multimask_output=False,
            )
            m = masks[0]

            intersection = np.logical_and(m, valid_mask)
            if np.sum(intersection) / max(np.sum(m), 1) < 0.8:
                continue

            y_idx, x_idx = np.where(m)
            local_cx = float(np.mean(x_idx))
            local_cy = float(np.mean(y_idx))

            filtered_trees.append({
                "local_centroid": (local_cx, local_cy),
                "area_pixels": int(np.sum(m)),
                "segmentation_mask": m,
                "bbox": (float(box[0]), float(box[1]), float(box[2]), float(box[3])),
                "iou_score": float(scores[0]),
            })

        return filtered_trees
