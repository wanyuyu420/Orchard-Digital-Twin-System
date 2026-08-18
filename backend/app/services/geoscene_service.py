
"""
GeoScene Server REST API client - all spatial data operations go through this service.
"""
import json
import time
from typing import Any

import httpx
import urllib3

# 内部 GeoScene Server 使用自签名证书，跳过 TLS 校验
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
                    # 服务端到服务端调用用 requestip（referer 型 token 要求浏览器携带 Referer 头）
                    "client": "requestip",
                    "expiration": settings.geoscene_token_duration,
                    "f": "json",
                },
                verify=False,
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
                verify=False,
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
                verify=False,
                timeout=15,
            )
            fs.raise_for_status()
            fs_data = fs.json()
            if 'error' in fs_data:
                raise GeoSceneError(f"FeatureServer unavailable: {fs_data['error']}")
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
        timeout: int = 30,
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
            # ArcGIS REST geometry 参数必须是合法 JSON 字符串（双引号），httpx 对 dict 值
            # 会序列化成 Python repr（单引号），GeoScene 解析失败 → 400
            params['geometry'] = json.dumps(geometry)
            params['geometryType'] = geometry_type
            params['spatialRel'] = spatial_rel
            params['inSR'] = 4326

        try:
            resp = httpx.get(
                f'{settings.geoscene_feature_server_url}/0/query',
                params=params,
                verify=False,
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            if 'error' in data:
                raise GeoSceneError(f"Query failed: {data['error']}")
            return data.get('features', [])
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer query failed: {e}')

    @classmethod
    def count_features(
        cls,
        *,
        geometry: dict | None = None,
        geometry_type: str | None = None,
        spatial_rel: str = 'esriSpatialRelIntersects',
        where: str = '1=1',
        timeout: int = 30,
    ) -> int:
        """只统计命中 FeatureServer 的特征数（returnCountOnly，不下载几何，轻量）。"""
        settings = get_settings()
        token = cls._get_token()

        params: dict[str, Any] = {
            'f': 'json',
            'token': token,
            'where': where,
            'returnCountOnly': 'true',
            'returnGeometry': 'false',
        }

        if geometry is not None:
            params['geometry'] = json.dumps(geometry)
            params['geometryType'] = geometry_type
            params['spatialRel'] = spatial_rel
            params['inSR'] = 4326

        try:
            resp = httpx.get(
                f'{settings.geoscene_feature_server_url}/0/query',
                params=params,
                verify=False,
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            if 'error' in data:
                raise GeoSceneError(f"Count failed: {data['error']}")
            return int(data.get('count', 0))
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer count failed: {e}')

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
        gis = [a.get('growth_index') for a in attrs if a.get('growth_index')]

        def _count_level(level: int) -> int:
            return sum(1 for a in attrs if a.get('fertilizer_level') == level)

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
                data={'adds': json.dumps(features)},
                verify=False,
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

    @classmethod
    def delete_features_by_batch(cls, batch_id: str) -> int:
        """删除指定 batch_id 的所有要素（重复上传时先清旧数据，避免 GeoScene 累积）。"""
        settings = get_settings()
        token = cls._get_token()

        # 1) 查询旧 batch 的 objectId
        try:
            features = cls.query_features(
                where=f"batch_id='{batch_id}'",
                return_geometry=False,
                limit=2000,
                timeout=60,
            )
        except GeoSceneError:
            return 0

        if not features:
            return 0

        object_ids = [
            f["attributes"].get(k)
            for f in features
            for k in ("objectid", "OBJECTID", "objectId", "FID", "fid")
            if f["attributes"].get(k) is not None
        ]
        object_ids = list(dict.fromkeys(object_ids))  # 去重保序
        if not object_ids:
            return 0

        # 2) applyEdits deletes（分批，避免一次删除太多超时）
        total_success = 0
        try:
            for i in range(0, len(object_ids), 200):
                chunk = object_ids[i:i + 200]
                resp = httpx.post(
                    f'{settings.geoscene_feature_server_url}/0/applyEdits',
                    params={'f': 'json', 'token': token},
                    data={'deletes': json.dumps(chunk)},
                    verify=False,
                    timeout=120,
                )
                resp.raise_for_status()
                result = resp.json()
                if result.get('deleteResults'):
                    total_success += sum(1 for r in result['deleteResults'] if r.get('success'))
                else:
                    err = result.get('error', resp.text)
                    raise GeoSceneError(f'deleteFeatures failed: {err}')
            print(f'[GeoScene] Deleted {total_success} old trees of batch {batch_id}')
            return total_success
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer delete failed: {e}')

    @classmethod
    def update_features(cls, updates: list[dict]) -> dict:
        """Batch-update features via applyEdits (the only write-back path, e.g. fertilizer levels).

        Returns the raw applyEdits result dict so callers can inspect ``updateResults``.
        """
        settings = get_settings()
        token = cls._get_token()

        try:
            resp = httpx.post(
                f'{settings.geoscene_feature_server_url}/0/applyEdits',
                params={'f': 'json', 'token': token},
                json={'updates': updates},
                verify=False,
                timeout=120,
            )
            resp.raise_for_status()
            result = resp.json()
            if 'error' in result:
                raise GeoSceneError(f"applyEdits updates failed: {result['error']}")
            return result
        except GeoSceneError:
            raise
        except Exception as e:
            raise GeoSceneError(f'GeoScene FeatureServer applyEdits failed: {e}')
