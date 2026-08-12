"""Canopy Height Estimation Service using GeoAI model."""
import os
import numpy as np


class HeightService:
    """Singleton service for canopy height prediction from RGB imagery."""

    _instance = None
    _estimator = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            print("[HeightService] Loading canopy height model (compressed_SSLhuge_aerial)...")
            from geoai.canopy import CanopyHeightEstimation
            cls._estimator = CanopyHeightEstimation(model_name="compressed_SSLhuge_aerial")
            cls._instance = cls._estimator
            print("[HeightService] Model loaded.")
        return cls._estimator

    @staticmethod
    def predict_height_map(image_path: str, output_path: str = None) -> np.ndarray:
        """Run height prediction on a TIF, return height map (H, W) in meters."""
        estimator = HeightService.get_instance()
        import uuid
        if output_path is None:
            output_path = f"temp_height_{uuid.uuid4().hex[:8]}.tif"
        height_map = estimator.predict(image_path, output_path=output_path, batch_size=4)
        if os.path.exists(output_path):
            os.remove(output_path)
        return height_map

    @staticmethod
    def get_tree_height(height_map: np.ndarray, mask: np.ndarray) -> float:
        """Extract median canopy height within the tree mask. Returns height in meters."""
        if mask.sum() == 0:
            return 0.0
        values = height_map[mask > 0]
        values = values[values > 0]
        if len(values) == 0:
            return 0.0
        return float(np.median(values))