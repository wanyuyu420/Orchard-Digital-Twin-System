import os
import numpy as np
from ultralytics import YOLO


class YoloService:
    _instance = None
    _model = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            print("[YoloService] Loading YOLO tree-crown model...")
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            checkpoint_path = os.path.join(os.path.dirname(BASE_DIR), "weights", "qc_memorize_v2_best.pt")

            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(BASE_DIR, "..", "weights", "qc_memorize_v2_best.pt")

            # Fallback to original tree_crown model
            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(os.path.dirname(BASE_DIR), "weights", "yolov8s_tree_crown.pt")
            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(BASE_DIR, "..", "weights", "yolov8s_tree_crown.pt")

            print(f"[YoloService] Checkpoint: {checkpoint_path}")
            cls._model = YOLO(checkpoint_path)
            cls._instance = cls._model
            print(f"[YoloService] Loaded. Classes: {cls._model.names}")

        return cls._model

    @staticmethod
    def detect_boxes(tile_rgb, model, conf: float = 0.08, padding_ratio: float = 0.08, iou: float = 0.7):
        """
        Run YOLO inference on a tile and return bounding boxes.
        Optionally pads boxes outward to give SAM better edge context.
        iou: NMS IoU threshold (default 0.7, higher = keep more overlapping boxes).
        Returns np.ndarray of shape (N, 4) in xyxy format, or empty array.
        """
        results = model(tile_rgb, verbose=False, conf=conf, iou=iou)
        boxes = results[0].boxes
        if boxes is None:
            return np.empty((0, 4), dtype=np.float32)
        xyxy = boxes.xyxy.cpu().numpy()

        if padding_ratio > 0 and len(xyxy) > 0:
            h, w = tile_rgb.shape[:2]
            bw = xyxy[:, 2] - xyxy[:, 0]
            bh = xyxy[:, 3] - xyxy[:, 1]
            dx = np.maximum(bw * padding_ratio, 2.0)
            dy = np.maximum(bh * padding_ratio, 2.0)
            xyxy[:, 0] = np.maximum(0, xyxy[:, 0] - dx)
            xyxy[:, 1] = np.maximum(0, xyxy[:, 1] - dy)
            xyxy[:, 2] = np.minimum(w, xyxy[:, 2] + dx)
            xyxy[:, 3] = np.minimum(h, xyxy[:, 3] + dy)

        return xyxy
