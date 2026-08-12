
"""
GeoScene Server REST API client - all spatial data operations go through this service.
"""
import time
from typing import Any

import httpx

from app.config import get_settings


class GeoSceneError(Exception):
    """Raised when GeoScene Server is unavailable. System must refuse to run."""


class GeoSceneService:
    """GeoScene FeatureServer REST client (singleton, built-in token cache)."""

    _token: str | None = None
    _token_expires: float = 0.0

    @classmethod
    def _get_token(cls) -> str:
        settings = get_settings()
        now = time.time()

        if cls._token and cls._token_expires > now + 60:
            return cls._token

        try:
            resp = httpx.post(
                f"{settings.geoscene_server_url}/tokens/generateToken",
                data={
                    "username": settings.geoscene_username,
                    "password": settings.geoscene_password,
                    "client": "referer",
                    "referer": settings.geoscene_server_url,
                    "expiration": settings.geoscene_token_duration,
                    "f": "json",
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise GeoSceneError(f"Token request rejected: {data['error']}")
            cls._token = data["token"]
            cls._token_expires = now + settings.geoscene_token_duration * 60
            return cls._token
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f"Failed to connect GeoScene Server for token: {e}")

    @classmethod
    def health_check(cls) -> dict:
        settings = get_settings()
        try:
            info = httpx.get(
                f'{settings.geoscene_server_url}/rest/info',
                params={'f': 'json'},
                timeout=15,
            )
            info.raise_for_status()
        except Exception as e:
            raise GeoSceneError(f'GeoScene Server unreachable: {e}')

        token = cls._get_token()

        try:
            fs = httpx.get(
                f'{settings.geoscene_feature_server_url}',
                params={'f': 'json', 'token': token},
                timeout=15,
            )
            fs.raise_for_status()
            fs_data = fs.json()
            if 'error' in fs_data:
                raise GeoSceneError(f'FeatureServer unavailable: {fs_data['error']}')
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'FeatureServer unreachable: {e}')

        return {
            'server': info.json().get('currentVersion', 'unknown'),
            'feature_service': fs_data.get('serviceDescription', 'ok'),
        }

    @classmethod
    def query_features(
        cls,
        *,
        geometry: dict | None = None,
        geometry_type: str | None = None,
        spatial_rel: str = 'esriSpatialRelIntersects',
        where: str = '1=1',
        out_fields: str = '*',
        out_sr: int = 4326,
        limit: int = 500,
        return_geometry: bool = True,
    ) -> list[dict]:
        settings = get_settings()
        token = cls._get_token()

        params: dict[str, Any] = {
            'f': 'json',
            'token': token,
            'where': where,
            'outFields': out_fields,
            'returnGeometry': str(return_geometry).lower(),
            'outSR': out_sr,
            'resultRecordCount': limit,
        }

        if geometry is not None:
            params['geometry'] = geometry
            params['geometryType'] = geometry_type
            params['spatialRel'] = spatial_rel
            params['inSR'] = 4326

        try:
            resp = httpx.get(
                f'{settings.geoscene_feature_server_url}/0/query',
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if 'error' in data:
                raise GeoSceneError(f'Query failed: {data['error']}')
            return data.get('features', [])
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer query failed: {e}')

    @classmethod
    def query_stats(
        cls,
        *,
        geometry: dict,
        geometry_type: str = 'esriGeometryPolygon',
        spatial_rel: str = 'esriSpatialRelContains',
    ) -> dict:
        features = cls.query_features(
            geometry=geometry,
            geometry_type=geometry_type,
            spatial_rel=spatial_rel,
            out_fields='*',
            limit=1000,
            return_geometry=False,
        )

        if not features:
            return {
                'total_count': 0,
                'avg_height': 0.0,
                'avg_area': 0.0,
                'avg_growth_index': 0.0,
                'light_count': 0,
                'medium_count': 0,
                'heavy_count': 0,
            }

        attrs = [f['attributes'] for f in features]
        heights = [a.get('height_m') for a in attrs if a.get('height_m')]
        areas = [a.get('area_m2') for a in attrs if a.get('area_m2')]
        gis = [a.get('growth_idx') for a in attrs if a.get('growth_idx')]

        def _count_level(level: int) -> int:
            return sum(1 for a in attrs if a.get('fert_level') == level)

        return {
            'total_count': len(features),
            'avg_height': round(sum(heights) / len(heights), 2) if heights else 0.0,
            'avg_area': round(sum(areas) / len(areas), 2) if areas else 0.0,
            'avg_growth_index': round(sum(gis) / len(gis), 4) if gis else 0.0,
            'light_count': _count_level(1),
            'medium_count': _count_level(2),
            'heavy_count': _count_level(3),
        }

    @classmethod
    def add_features(cls, features: list[dict]) -> int:
        settings = get_settings()
        token = cls._get_token()

        try:
            resp = httpx.post(
                f'{settings.geoscene_feature_server_url}/0/applyEdits',
                params={'f': 'json', 'token': token},
                json={'adds': features},
                timeout=120,
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get('addResults'):
                success = sum(1 for r in result['addResults'] if r.get('success'))
                print(f'[GeoScene] Published {success}/{len(features)} trees to FeatureServer')
                return success
            else:
                err = result.get('error', resp.text)
                raise GeoSceneError(f'addFeatures failed: {err}')
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer applyEdits failed: {e}')
