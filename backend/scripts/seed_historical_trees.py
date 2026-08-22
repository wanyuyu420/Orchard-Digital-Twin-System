# 一键将 qc.shp 清洗入库到 PostgreSQL PostGIS
import os
import sys
import geopandas as gpd
from geoalchemy2.shape import from_shape
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.models.orange import OrangeTree

TARGET_SRID = 32650
PLOT_TYPE = "plot1"


def seed_shp_data():
    settings = get_settings()
    shp_path = os.path.join("data", "historical_trees", "qc.shp")

    if not os.path.exists(shp_path):
        print(f"错误：未找到 {shp_path}，请确认文件存在。")
        return

    print(f"正在读取 {shp_path} ...")
    gdf = gpd.read_file(shp_path)

    # CRS 检查与自适应重投影
    if gdf.crs is None:
        print(f"警告：shp 文件缺少 CRS 信息，假定为 EPSG:{TARGET_SRID}")
    elif gdf.crs.to_epsg() != TARGET_SRID:
        print(f"正在重投影: {gdf.crs} -> EPSG:{TARGET_SRID}")
        gdf = gdf.to_crs(epsg=TARGET_SRID)

    print(f"读取完成，共 {len(gdf)} 条要素。")

    # 同步引擎直连 PostgreSQL
    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        print("正在清空历史批次数据...")
        db.execute(delete(OrangeTree).where(OrangeTree.plot_type == PLOT_TYPE))
        db.flush()

        print("开始写入...")
        trees = []
        for i, (_, row) in enumerate(gdf.iterrows(), start=1):
            # shp 存的是树冠多边形，取其质心作为中心点入库
            point = row["geometry"].centroid
            geom = from_shape(point, srid=TARGET_SRID)

            trees.append(OrangeTree(
                tree_code=f"TREE_{i:04d}",
                plot_type=PLOT_TYPE,
                geom=geom,
                shape_length=_float(row, "Shape_Leng"),
                confidence=_float(row, "Confidence"),
                compactness=_float(row, "Compactnes"),
                shape_area=_float(row, "Shape_Area"),
                value_field=_float(row, "VALUE"),
                count_field=_float(row, "COUNT"),
                area_m2=_float(row, "Area_m2"),
                height_m=_float(row, "HEIGHT"),
                crown_diameter=_float(row, "CROWN"),
                volume_m3=_float(row, "VOLUME"),
                growth_index=_float(row, "GROWTH"),
                slope_degree=_float(row, "SLOPE"),
                aspect=_float(row, "ASPECT"),
                fertilizer_level=0,
            ))

        db.add_all(trees)
        db.commit()
        print(f"完成！{len(trees)} 棵脐橙树已入库到 PostgreSQL。")


def _float(row, col: str) -> float | None:
    """安全取 float，字段不存在或 NaN 时返回 None。"""
    try:
        val = row[col]
        if val is None or (isinstance(val, float) and val != val):
            return None
        return float(val)
    except KeyError:
        return None


if __name__ == "__main__":
    seed_shp_data()
