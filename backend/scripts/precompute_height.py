"""
预计算冠层高度图（一次性）：
用 SSLhuge 模型把 orange_tree.tif 的冠层高度算出来，存成 height_map.npy，
之后上传推理时直接读这个文件，跳过 SSLhuge 现场预测（省 15~30 分钟 + 省显存）。

运行前：关掉 Chrome/Edge 等占显存的软件，确保 6GB 显存够用。
运行：python scripts/precompute_height.py（在 backend 目录下，用 geoai 环境）
"""
import os
import sys
import numpy as np

# 加 backend 到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

IMAGE_PATH = r"D:\Esri_data_4people\orange_tree.tif"
OUTPUT_NPY = r"D:\Esri_data_4people\height_map.npy"
TEMP_TIF = "temp_height_precompute.tif"


def main():
    from geoai.canopy import CanopyHeightEstimation

    print("[Precompute] 加载 SSLhuge 冠层高度模型...")
    estimator = CanopyHeightEstimation(model_name="compressed_SSLhuge_aerial")
    print("[Precompute] 模型加载完成，开始预测高度图（可能需要几分钟）...")

    height_map = estimator.predict(IMAGE_PATH, output_path=TEMP_TIF, batch_size=4)

    if os.path.exists(TEMP_TIF):
        os.remove(TEMP_TIF)

    np.save(OUTPUT_NPY, height_map)
    print(f"[Precompute] 高度图已保存: {OUTPUT_NPY}")
    print(f"  形状: {height_map.shape}, dtype: {height_map.dtype}")
    print(f"  值域: {height_map.min():.2f} ~ {height_map.max():.2f} 米")


if __name__ == "__main__":
    main()
