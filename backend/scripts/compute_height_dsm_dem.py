"""
用 DSM - DEM 计算冠层高度图，存成预存文件 height_map.npy。
（覆盖之前 SSLhuge 反演的 0.01 米错误结果）

树冠高度 = DSM(含树冠高程) - DEM(地表高程)，单位米。
只传一张 RGB TIF 的主体亮点仍保留（SSLhuge），这里是"摄影测量精确树高"作为标定/校正源。

运行：python scripts/compute_height_dsm_dem.py（geoai 环境）
"""
import numpy as np
import rasterio

DSM_PATH = r"D:\Esri_data_4people\地2_冠层高度\dsm21.tif"
DEM_PATH = r"D:\Esri_data_4people\地2_冠层高度\dem2.tif"
OUTPUT_NPY = r"D:\Esri_data_4people\height_map.npy"


def main():
    with rasterio.open(DSM_PATH) as dsm, rasterio.open(DEM_PATH) as dem:
        dsm_arr = dsm.read(1).astype(np.float32)
        dem_arr = dem.read(1).astype(np.float32)

        # 无效值（nodata）处理
        for arr, src in [(dsm_arr, dsm), (dem_arr, dem)]:
            if src.nodata is not None:
                arr[arr == src.nodata] = np.nan

        height = dsm_arr - dem_arr  # 冠层高度
        height = np.nan_to_num(height, nan=0.0)
        height = np.clip(height, 0.0, None)  # 负值（噪声）clip 到 0

        np.save(OUTPUT_NPY, height.astype(np.float32))

        valid = height[height > 0]
        print(f"[OK] 冠层高度图已保存: {OUTPUT_NPY}")
        print(f"  形状: {height.shape}, dtype: {height.dtype}")
        print(f"  值域: {height.min():.2f} ~ {height.max():.2f} 米")
        print(f"  正值均值: {valid.mean():.2f} 米, 正值中位数: {np.median(valid):.2f} 米")


if __name__ == "__main__":
    main()
