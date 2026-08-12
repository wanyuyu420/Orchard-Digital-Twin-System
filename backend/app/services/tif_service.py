import rasterio
from rasterio.windows import Window
import numpy as np
import cv2
import cv2


class TifService:

    @staticmethod
    def slice_tif_generator(file_path: str, window_size: int = 512, overlap: int = 64, use_clahe: bool = False):
        with rasterio.open(file_path) as src:
            crs = src.crs
            transform = src.transform
            width = src.width
            height = src.height
            band_count = src.count

            stride = window_size - overlap

            for y in range(0, height, stride):
                for x in range(0, width, stride):
                    w = min(window_size, width - x)
                    h = min(window_size, height - y)
                    needs_pad = (w != window_size) or (h != window_size)

                    window = Window(x, y, w, h)

                    bands = list(range(1, min(band_count + 1, 4)))
                    tile_data = src.read(bands, window=window)

                    # 单/双波段 → 补齐为 3 通道伪 RGB
                    if tile_data.shape[0] == 1:
                        tile_data = np.repeat(tile_data, 3, axis=0)
                    elif tile_data.shape[0] == 2:
                        tile_data = np.concatenate(
                            [tile_data, tile_data[-1:]], axis=0)

                    # 数值归一化：uint16 / int16 → uint8
                    if tile_data.dtype == np.uint16:
                        if tile_data.max() <= 255:
                            tile_data = tile_data.astype(np.uint8)
                        else:
                            tile_data = (tile_data / 65535.0 * 255).astype(np.uint8)
                    elif tile_data.dtype == np.int16:
                        tile_data = ((tile_data.astype(np.int32) + 32768)
                                     / 65535.0 * 255).astype(np.uint8)

                    if needs_pad:
                        padded = np.zeros(
                            (3, window_size, window_size), dtype=tile_data.dtype)
                        padded[:, :h, :w] = tile_data
                        valid_mask = np.zeros(
                            (window_size, window_size), dtype=np.uint8)
                        valid_mask[:h, :w] = 1
                        tile_rgb = np.moveaxis(padded, 0, -1)
                    else:
                        tile_rgb = np.moveaxis(tile_data, 0, -1)
                        valid_mask = np.ones(
                            (window_size, window_size), dtype=np.uint8)

                    # 窗口左上角地理坐标 (ul 对切片原点正确)
                    geo_x, geo_y = rasterio.transform.xy(
                        transform, y, x, offset="ul")

                    yield {
                        "window_x": x,
                        "window_y": y,
                        "width": w,
                        "height": h,
                        "crs": str(crs),
                        "geo_origin_x": geo_x,
                        "geo_origin_y": geo_y,
                        "tile_shape": tile_rgb.shape,
                        "tile_data": tile_rgb,
                        "valid_mask": valid_mask,
                        "transform": transform,
                    }

    @staticmethod
    def pixel_to_geo(transform, tile_x, tile_y, px, py, valid_mask=None):
        """像素坐标 → 地理坐标，自动跳过 padding 区域"""
        if valid_mask is not None:
            py_int, px_int = int(round(py)), int(round(px))
            if (py_int < 0 or py_int >= valid_mask.shape[0]
                    or px_int < 0 or px_int >= valid_mask.shape[1]):
                return None
            if valid_mask[py_int, px_int] == 0:
                return None

        return rasterio.transform.xy(
            transform, tile_y + py, tile_x + px, offset="center")
