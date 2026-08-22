"""
用已做好的 shapefile 直接入库到 GeoScene FeatureServer。

读取 treetree.shp（EPSG:32650，822 棵树），把字段映射为后端 Growth 字段，
分批发布到 GeoScene。之后上传推理不再入库，拉框查询直接查这里入库的数据。

运行：在 backend 目录下，用 geoai 环境：
  python scripts/seed_plot2_trees.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import fiona  # noqa: E402

from app.services.geoscene_service import GeoSceneService  # noqa: E402

SHP_PATH = r"D:\Esri_data_4people\地2入库数据\treetree.shp"
PLOT_TYPE = "plot2"
CHUNK_SIZE = 50


def _fertilizer_level(growth_index):
    if growth_index >= 0.7:
        return 1
    if growth_index >= 0.4:
        return 2
    return 3


def _growth_status(growth_index):
    if growth_index >= 0.7:
        return "优良"
    if growth_index >= 0.4:
        return "一般"
    return "较差"


def _to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    rows = []
    with fiona.open(SHP_PATH) as src:
        for i, feat in enumerate(src, start=1):
            props = feat["properties"]
            # geometry 是 Polygon（树冠轮廓），取外环顶点平均作为树的中心点
            ring = feat["geometry"]["coordinates"][0]
            xs = [pt[0] for pt in ring]
            ys = [pt[1] for pt in ring]
            utm_x = sum(xs) / len(xs)
            utm_y = sum(ys) / len(ys)

            growth_index = _to_float(props.get("GROWTH")) or 0.0
            level = _fertilizer_level(growth_index)
            area_m2 = _to_float(props.get("Area_m2")) or 0.0

            rows.append({
                "attributes": {
                    "id": str(props.get("OBJECTID_1") or props.get("OBJECTID_2") or ""),
                    "tree_code": f"TREE_{i:04d}",
                    "plot_type": PLOT_TYPE,
                    "confidence": _to_float(props.get("Confidence")),
                    "compactness": _to_float(props.get("Compactnes")),
                    "shape_length": _to_float(props.get("Shape_Leng")),
                    "shape_area": area_m2,
                    "count": _to_float(props.get("COUNT")),
                    "area_m2": area_m2,
                    "height_m": _to_float(props.get("HEIGHT")),
                    "crown_diameter": _to_float(props.get("CROWN")),
                    "volume_m3": _to_float(props.get("VOLUME")),
                    "growth_index": growth_index,
                    "slope_degree": _to_float(props.get("SLOPE")),
                    "aspect": _to_float(props.get("ASPECT")),
                    "fertilizer_level": level,
                    "fertilizer_kg": {0: 0.0, 1: 0.5, 2: 1.2, 3: 2.0}.get(level, 0.0),
                    "growth_status": _growth_status(growth_index),
                },
                "geometry": {"x": utm_x, "y": utm_y, "spatialReference": {"wkid": 32650}},
            })

    print(f"[Seed] 读取 shp 共 {len(rows)} 棵树")

    # 先清掉「字段改名前入库、plot_type 还是空」的旧 orange_tree 数据，再清掉本 plot2 旧数据
    deleted_old = GeoSceneService.delete_features_where("tree_code='orange_tree'")
    print(f"[Seed] 删除旧 orange_tree 数据 {deleted_old} 条")
    deleted = GeoSceneService.delete_features_by_plot(PLOT_TYPE)
    print(f"[Seed] 删除旧 plot2 数据 {deleted} 条")

    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        n = GeoSceneService.add_features(chunk)
        total += n
        print(f"[Seed] 已发布 {min(i + CHUNK_SIZE, len(rows))}/{len(rows)} 棵")

    print(f"[Seed] 入库完成，共 {total} 棵树发布到 GeoScene")


if __name__ == "__main__":
    main()
