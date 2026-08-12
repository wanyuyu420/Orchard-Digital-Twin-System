import rasterio
from rasterio.windows import Window
import numpy as np


class TifService:
    @staticmethod
    def slice_tif(file_path: str, window_size: int = 1024, overlap: int = 128):
        with rasterio.open(file_path) as src:
            crs = src.crs
            transform = src.transform
            width = src.width
            height = src.height
            stride = window_size - overlap
            tiles = []

            for y in range(0, height, stride):
                for x in range(0, width, stride):
                    w = min(window_size, width - x)
                    h = min(window_size, height - y)
                    needs_pad = (w != window_size) or (h != window_size)
                    window = Window(x, y, w, h)
                    tile_data = src.read([1, 2, 3], window=window)

                    if needs_pad: