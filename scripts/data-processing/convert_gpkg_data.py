"""
============================================================================
 tree.gpkg → GeoJSON 转换脚本 (适配前端 Cesium 直接加载)
============================================================================
 用途: 将脐橙树冠 GeoPackage 数据转换为 GeoJSON，上传到 OSS 供 Cesium 加载
 输出: tree_data.geojson (可直接放 OSS 上, Cesium GeoJsonDataSource 加载)

 前置安装:
   pip install geopandas

 使用方法:
   1. python convert_gpkg_data.py
   2. 把输出的 tree_data.geojson 上传到 OSS
   3. 前端用 Cesium.GeoJsonDataSource.load(url) 加载

 备选方案 (入库 PostGIS, 走 /spatial-diagnose API):
   见本脚本末尾的 import_to_postgis() 函数
============================================================================
"""

import os
import sys
import json
import urllib.request

# ============================================================================
# 配置区
# ============================================================================

# tree.gpkg 的下载地址
GPKG_URL = "https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree.gpkg"

# 下载到本地的临时路径
GPKG_LOCAL = os.path.join(os.path.dirname(__file__), "tree.gpkg")

# GeoJSON 输出路径
GEOJSON_OUTPUT = os.path.join(os.path.dirname(__file__), "tree_data.geojson")

# 目标坐标系 (WGS84, Cesium 标准)
TARGET_CRS = "EPSG:4326"

# 是否简化几何 (减少文件大小, None=不简化, 例如 0.0001 = 约 10 米精度)
SIMPLIFY_TOLERANCE = None

# OSS 上传后的 URL
OSS_GEOJSON_URL = "https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree_data.geojson"


# ============================================================================
# 处理流程
# ============================================================================

def download_gpkg():
    """从 OSS 下载 GPKG 文件"""
    if os.path.exists(GPKG_LOCAL):
        size_mb = os.path.getsize(GPKG_LOCAL) / (1024 * 1024)
        print(f"[SKIP] tree.gpkg 已存在 ({size_mb:.1f} MB)")
        return True

    print(f"[下载] 正在从 {GPKG_URL} 下载 ...")
    try:
        urllib.request.urlretrieve(GPKG_URL, GPKG_LOCAL)
        size_mb = os.path.getsize(GPKG_LOCAL) / (1024 * 1024)
        print(f"[OK] 下载完成 ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        print(f"[ERROR] 下载失败: {e}")
        print("  请手动下载 tree.gpkg 放到本脚本同级目录")
        return False


def convert_to_geojson():
    """GPKG → GeoJSON 转换"""
    import geopandas as gpd

    print(f"\n[读取] {GPKG_LOCAL} ...")
    gdf = gpd.read_file(GPKG_LOCAL)
    print(f"  原始: {len(gdf)} 个要素, CRS={gdf.crs}")

    # 查看字段
    print(f"  字段: {list(gdf.columns)}")

    # 重投影到 WGS84 (Cesium 标准坐标系)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"[重投影] {gdf.crs} → EPSG:4326")
        gdf = gdf.to_crs(TARGET_CRS)
    elif gdf.crs is None:
        print("[警告] GPKG 缺少 CRS 信息! Cesium 可能无法正确定位。")
        print("  请在 QGIS 中确认数据坐标系后重试。")

    # 计算树冠中心点 (Cesium 用点来高亮选中)
    print("[处理] 计算树冠中心点...")
    gdf["longitude"] = gdf.geometry.centroid.x
    gdf["latitude"] = gdf.geometry.centroid.y

    # 可选: 简化几何以减少文件大小
    if SIMPLIFY_TOLERANCE:
        gdf["geometry"] = gdf["geometry"].simplify(SIMPLIFY_TOLERANCE)

    # 写入 GeoJSON
    print(f"[写入] {GEOJSON_OUTPUT} ...")
    gdf.to_file(GEOJSON_OUTPUT, driver="GeoJSON")
    size_mb = os.path.getsize(GEOJSON_OUTPUT) / (1024 * 1024)
    print(f"[OK] GeoJSON 生成完成 ({size_mb:.1f} MB)")

    return gdf


def print_summary(gdf):
    """打印数据摘要 & 后续操作"""
    print(f"""
{'='*60}
 数据摘要
{'='*60}
  总树木数: {len(gdf)}
  字段列表: {list(gdf.columns)}
  坐标系:   EPSG:4326 (WGS84)
  输出文件: {GEOJSON_OUTPUT}

{'='*60}
 后续步骤 (方案一: OSS 直连, 推荐)
{'='*60}

1. 上传 GeoJSON 到 OSS:
   用 OSS 网页控制台或 ossutil 上传,
   目标 URL: {OSS_GEOJSON_URL}

2. 确认 OSS 已设置 CORS 跨域规则 (如已设置则跳过):
   - 来源: *
   - Methods: GET, HEAD
   - Headers: *

3. 前端用法 (把下面代码给前端开发):

   // 加载树木数据到 Cesium
   const dataSource = await Cesium.GeoJsonDataSource.load(
     '{OSS_GEOJSON_URL}',
     {{
       stroke: Cesium.Color.GREEN,
       fill: Cesium.Color.GREEN.withAlpha(0.3),
       strokeWidth: 2,
     }}
   );
   viewer.dataSources.add(dataSource);

   // 点击高亮
   viewer.screenSpaceEventHandler.setInputAction((click) => {{
     const picked = viewer.scene.pick(click.position);
     if (Cesium.defined(picked) && picked.id) {{
       // 高亮选中的树冠
       picked.id.polygon.material = Cesium.Color.YELLOW.withAlpha(0.6);
     }}
   }}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

{'='*60}
 后续步骤 (方案二: 入库 PostGIS, 已有 API)
{'='*60}

  如果希望走后端 /spatial-diagnose 接口 (支持框选查询等高级功能):
  python convert_gpkg_data.py --to-postgis

  这会直接把数据写入 orange_trees 表。
""")


# ============================================================================
# 可选: 导入 PostGIS (使用现有 orange_trees 模型)
# ============================================================================

def import_to_postgis():
    """
    将 GPKG 数据导入 PostGIS 的 orange_trees 表。
    与 seed_historical_trees.py 逻辑一致，只是源文件换成了 GPKG。
    """
    import geopandas as gpd
    from geoalchemy2.shape import from_shape
    from sqlalchemy import create_engine, delete
    from sqlalchemy.orm import sessionmaker

    # 需要项目在 Python path 中
    backend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
    sys.path.insert(0, backend_dir)

    from app.config import get_settings
    from app.models.orange import OrangeTree

    TARGET_SRID = 32650
    BATCH_ID = "oss_import"

    settings = get_settings()

    print(f"\n[读取] {GPKG_LOCAL} ...")
    gdf = gpd.read_file(GPKG_LOCAL)
    print(f"  共 {len(gdf)} 个要素, CRS={gdf.crs}")

    # CRS 检查与重投影
    if gdf.crs is None:
        print(f"  警告: GPKG 缺少 CRS，假定为 EPSG:{TARGET_SRID}")
        gdf.set_crs(epsg=TARGET_SRID, inplace=True)
    elif gdf.crs.to_epsg() != TARGET_SRID:
        print(f"  重投影: {gdf.crs} → EPSG:{TARGET_SRID}")
        gdf = gdf.to_crs(epsg=TARGET_SRID)

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        print(f"  清空批次 '{BATCH_ID}' ...")
        db.execute(delete(OrangeTree).where(OrangeTree.batch_id == BATCH_ID))

        print("  写入中...")
        trees = []
        for _, row in gdf.iterrows():
            point = row["geometry"].centroid
            geom = from_shape(point, srid=TARGET_SRID)

            trees.append(OrangeTree(
                batch_id=BATCH_ID,
                geom=geom,
                confidence=_float(row, "Confidence"),
                compactness=_float(row, "Compactnes"),
                shape_length=_float(row, "Shape_Leng"),
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
        print(f"  [OK] {len(trees)} 棵树已入库 (batch_id={BATCH_ID})")


def _float(row, col: str) -> float | None:
    """安全取 float，字段不存在或 NaN 时返回 None"""
    try:
        val = row[col]
        if val is None or (isinstance(val, float) and val != val):
            return None
        return float(val)
    except KeyError:
        return None


# ============================================================================
# 主入口
# ============================================================================

def main():
    print("=" * 60)
    print(" tree.gpkg → GeoJSON 转换工具")
    print("=" * 60)

    if "--to-postgis" in sys.argv:
        if not os.path.exists(GPKG_LOCAL):
            print("[下载] 请先下载 GPKG 文件...")
            download_gpkg()
        import_to_postgis()
    else:
        if not download_gpkg():
            sys.exit(1)

        try:
            gdf = convert_to_geojson()
            print_summary(gdf)
        except ImportError:
            print("[ERROR] 需要安装 geopandas: pip install geopandas")
            sys.exit(1)


if __name__ == "__main__":
    main()
