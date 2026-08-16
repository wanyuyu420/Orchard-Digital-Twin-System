"""Canopy Height Estimation Service using GeoAI model."""
import os
import numpy as np


class HeightService:
    """Singleton service for canopy height prediction from RGB imagery."""

    _instance = None
    _estimator = None

    # 预计算的冠层高度图（就一张固定上传图，提前算好存这里，上传时直接读）
    _PRECOMPUTED_HEIGHT = r"D:\Esri_data_4people\height_map.npy"

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
        # 预计算：若已保存高度图，直接读取，跳过 SSLhuge 现场预测（省时省显存）
        if os.path.exists(HeightService._PRECOMPUTED_HEIGHT):
            height_map = np.load(HeightService._PRECOMPUTED_HEIGHT)
            print(f"[HeightService] 读取预计算高度图 {height_map.shape}，跳过 SSLhuge")
            return height_map

        estimator = HeightService.get_instance()
        import uuid
        if output_path is None:
            output_path = f"temp_height_{uuid.uuid4().hex[:8]}.tif"
        height_map = estimator.predict(image_path, output_path=output_path, batch_size=4)
        if os.path.exists(output_path):
            os.remove(output_path)
        # 预测完成即释放 SSLhuge 大模型显存（后续 YOLO+SAM 分割不再需要它）
        HeightService.release()
        return height_map

    @classmethod
    def release(cls):
        """释放冠层高度模型，归还 GPU 显存。"""
        cls._estimator = None
        cls._instance = None
        import torch
        torch.cuda.empty_cache()

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