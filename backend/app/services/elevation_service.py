"""Elevation Service -- Local high-res DSM (smoothed) + SRTM fallback."""
import math, os
import numpy as np
import rasterio

_LOCAL_DSM = os.path.join(os.path.dirname(__file__), "../../data/2019081929/3_dsm_ortho/1_dsm/2019081929_dsm_smooth.tif")

class ElevationService:
    _dsm_ds = None
    _dsm_arr = None
    _srtm = None

    @classmethod
    def _load_dsm(cls):
        if cls._dsm_ds is None and os.path.exists(_LOCAL_DSM):
            cls._dsm_ds = rasterio.open(_LOCAL_DSM)
            cls._dsm_arr = cls._dsm_ds.read(1)
        return cls._dsm_ds

    @classmethod
    def _dsm_elev(cls, utm_x, utm_y):
        dsm = cls._load_dsm()
        if dsm is None: return None
        px = int((utm_x - dsm.bounds.left) / dsm.res[0])
        py = int((dsm.bounds.top - utm_y) / abs(dsm.res[1]))
        if 0 <= py < dsm.height and 0 <= px < dsm.width:
            v = float(cls._dsm_arr[py, px])
            return v if v < 9999 else None  # nodata
        return None

    @classmethod
    def _srtm_elev(cls, lat, lng):
        try:
            if cls._srtm is None:
                import srtm
                cls._srtm = srtm.get_data()
            return float(cls._srtm.get_elevation(lat, lng) or 0)
        except Exception:
            return None

    @classmethod
    def get_slope_aspect(cls, lat, lng, utm_x=None, utm_y=None):
        try:
            dsm = cls._load_dsm()
            if dsm is not None and utm_x is not None:
                res = abs(dsm.res[0])
                z = cls._dsm_elev(utm_x, utm_y)
                zn = cls._dsm_elev(utm_x, utm_y + res)
                zs = cls._dsm_elev(utm_x, utm_y - res)
                ze = cls._dsm_elev(utm_x + res, utm_y)
                zw = cls._dsm_elev(utm_x - res, utm_y)
            else:
                # SRTM fallback
                res = 0.00027778
                z = cls._srtm_elev(lat, lng)
                zn = cls._srtm_elev(lat + res, lng)
                zs = cls._srtm_elev(lat - res, lng)
                ze = cls._srtm_elev(lat, lng + res)
                zw = cls._srtm_elev(lat, lng - res)
            if z is None or (zn is None and zs is None and ze is None and zw is None):
                return dict(elevation_m=None, slope_degree=None, aspect=None)
            dz_dy = (zn - zs) / (2 * res)
            dz_dx = (ze - zw) / (2 * res)
            slope_rad = math.atan(math.sqrt(dz_dx**2 + dz_dy**2))
            slope_deg = round(math.degrees(slope_rad), 2)
            aspect_rad = math.atan2(-dz_dx, -dz_dy)
            aspect_deg = round((math.degrees(aspect_rad) + 360) % 360, 1)
            return dict(elevation_m=round(z, 1), slope_degree=slope_deg, aspect=aspect_deg)
        except Exception: return dict(elevation_m=None, slope_degree=None, aspect=None)