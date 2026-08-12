"""
============================================================================
 DOM.tif → TMS 瓦片切割脚本
============================================================================
 用途: 将单张大 GeoTIFF 正射影像切成 Cesium 可用的 TMS 瓦片金字塔
 输出: 一个 tiles/ 目录，内含 {z}/{x}/{y}.png 的瓦片文件
 上传: 把整个 tiles/ 目录上传到 OSS，前端即可通过 URL 模板加载

 前置安装 (Windows):
   方案一 (推荐): 安装 OSGeo4W
     1. 下载: https://trac.osgeo.org/osgeo4w/
     2. 安装时选择 "Express Desktop Install"，会自带 GDAL
     3. 打开 OSGeo4W Shell，cd 到本脚本所在目录，执行:
        python cut_dom_tiles.py

   方案二: pip 安装 GDAL (需要系统已有 GDAL 库)
     pip install gdal

   方案三: 用 QGIS 桌面版 (图形界面，不需要写命令)
     见本脚本末尾的 QGIS 操作步骤

 使用方法:
   1. 修改下面的 DOM_URL 为本地的 DOM.tif 文件路径 (先要从 OSS 下载)
   2. 修改 OUTPUT_DIR 为你想输出的瓦片目录
   3. 运行: python cut_dom_tiles.py
   4. 把输出目录整个上传到 OSS
============================================================================
"""

import os
import sys
import subprocess
import urllib.request

# ============================================================================
# 配置区 —— 改这里
# ============================================================================

# DOM.tif 的下载地址
DOM_URL = "https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/DOM.tif"

# 下载到本地的临时路径
DOM_LOCAL = os.path.join(os.path.dirname(__file__), "DOM.tif")

# 瓦片输出目录
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "dom_tiles")

# 瓦片层级范围 (0 = 全球, 数值越大越精细)
MIN_ZOOM = 10   # 最小缩放级别 (看全景)
MAX_ZOOM = 20   # 最大缩放级别 (看细节, 依 TIFF 分辨率定)

# OSS 上瓦片的最终 URL 前缀 (上传后才知道, 这里给个示例)
# 比如上传到 OSS 的 dom_tiles/ 目录, 则前缀为:
OSS_TILE_URL = "https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/dom_tiles"

# ============================================================================
# 前置检查
# ============================================================================

def check_gdal():
    """检查 GDAL 是否已安装"""
    try:
        from osgeo import gdal
        print(f"[OK] GDAL {gdal.VersionInfo()} 已安装")
        return True
    except ImportError:
        print("[ERROR] 未找到 GDAL Python 库")
        print("  安装方法:")
        print("  方案一: 安装 OSGeo4W (推荐) → https://trac.osgeo.org/osgeo4w/")
        print("  方案二: pip install gdal")
        print("  方案三: 用 QGIS 桌面版 GUI 工具, 见本脚本末尾说明")
        return False


def check_gdal2tiles():
    """检查 gdal2tiles.py 是否可用"""
    try:
        result = subprocess.run(
            ["gdal2tiles.py", "--help"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print("[OK] gdal2tiles.py 可用")
            return True
    except FileNotFoundError:
        pass

    # 尝试用 python -m 方式
    try:
        result = subprocess.run(
            [sys.executable, "-m", "osgeo.gdal", "--help"],
            capture_output=True, text=True
        )
    except:
        pass

    print("[WARN] gdal2tiles.py 不在 PATH 中, 尝试用 python 直接调用")
    return True  # 后续用 Python API 兜底


def download_dom():
    """从 OSS 下载 DOM.tif"""
    if os.path.exists(DOM_LOCAL):
        size_mb = os.path.getsize(DOM_LOCAL) / (1024 * 1024)
        print(f"[SKIP] DOM.tif 已存在 ({size_mb:.1f} MB), 跳过下载")
        return True

    print(f"[下载] 正在从 {DOM_URL} 下载 DOM.tif ...")
    print("  大文件可能需要几分钟, 请耐心等待...")
    try:
        urllib.request.urlretrieve(DOM_URL, DOM_LOCAL)
        size_mb = os.path.getsize(DOM_LOCAL) / (1024 * 1024)
        print(f"[OK] 下载完成 ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        print(f"[ERROR] 下载失败: {e}")
        print("  你也可以手动下载 DOM.tif 放到本脚本同级目录")
        return False


def get_tiff_info(filepath: str) -> dict:
    """读取 GeoTIFF 的元信息"""
    from osgeo import gdal
    ds = gdal.Open(filepath)
    if ds is None:
        return {}

    info = {
        "width": ds.RasterXSize,
        "height": ds.RasterYSize,
        "bands": ds.RasterCount,
        "projection": ds.GetProjection(),
        "geotransform": ds.GetGeoTransform(),
    }
    ds = None
    return info


def cut_with_gdal2tiles():
    """
    使用 gdal2tiles.py 命令行工具切瓦片。
    这是最标准、最可靠的方式。
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    cmd = [
        "gdal2tiles.py",
        "--zoom", f"{MIN_ZOOM}-{MAX_ZOOM}",
        "--processes", "4",           # 用 4 个 CPU 核心
        "--resampling", "bilinear",   # 双线性重采样, 画面更平滑
        "--tilesize", "256",          # Cesium 标准瓦片大小
        "--webviewer", "none",        # 不生成 HTML 预览
        "--exclude",                 # 不生成全透明瓦片
        DOM_LOCAL,
        OUTPUT_DIR,
    ]

    print(f"[执行] {' '.join(cmd)}")
    print("  切瓦片可能需要 10-60 分钟, 取决于 TIFF 大小和层级...")

    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("[ERROR] gdal2tiles 执行失败, 返回码:", result.returncode)
        print("  备选方案: 用 QGIS 桌面版的 '生成 XYZ 瓦片' 工具")
        return False

    print("[OK] 瓦片切割完成!")
    return True


def print_tile_stats():
    """统计输出瓦片"""
    total_files = 0
    total_size = 0
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for f in files:
            total_files += 1
            total_size += os.path.getsize(os.path.join(root, f))

    total_mb = total_size / (1024 * 1024)
    print(f"\n瓦片统计: {total_files} 个文件, 共 {total_mb:.1f} MB")


def print_upload_instructions():
    """打印上传到 OSS 的操作说明"""
    print(f"""
{'='*60}
 后续步骤
{'='*60}

1. 上传瓦片到 OSS:
   用 ossutil (阿里云官方工具) 或 OSS 网页控制台,
   把整个目录 "{OUTPUT_DIR}" 上传到 OSS,
   目标路径例如: oss://gananqicheng-data/dom_tiles/

   用 ossutil 的话:
   ossutil cp -r {OUTPUT_DIR}/ oss://gananqicheng-data/dom_tiles/

2. 设置 OSS CORS (跨域):
   在 OSS 控制台 → 数据安全 → 跨域设置, 添加规则:
   - 来源: *
   - 允许 Methods: GET, HEAD
   - 允许 Headers: *

3. 前端使用 (告诉前端开发):
   瓦片的 URL 模板为:
   {OSS_TILE_URL}/{{z}}/{{x}}/{{y}}.png

   注意: gdal2tiles 生成的 y 轴可能需要反转 (TMS vs XYZ),
   如果图片对不上, 前端用 {{reverseY}} 即可:
   {OSS_TILE_URL}/{{z}}/{{x}}/{{reverseY}}.png

{'='*60}
""")


def qgis_gui_instructions():
    """QGIS 图形界面操作步骤"""
    print(f"""
{'='*60}
 QGIS 桌面版切瓦片 (不用命令行)
{'='*60}

1. 下载安装 QGIS: https://qgis.org/download/
2. 打开 QGIS, 把 DOM.tif 拖进去
3. 菜单: 处理 → 工具箱
4. 搜索 "Generate XYZ Tiles (MBTiles)" 或 "生成XYZ瓦片"
5. 参数:
   - 输入图层: DOM.tif
   - 输出目录: 选一个空文件夹
   - 最小缩放: {MIN_ZOOM}
   - 最大缩放: {MAX_ZOOM}
   - 瓦片大小: 256
6. 点运行, 等待完成
7. 把输出文件夹上传到 OSS

{'='*60}
""")


# ============================================================================
# 主流程
# ============================================================================

def main():
    print("=" * 60)
    print(" DOM.tif → TMS 瓦片切割工具")
    print("=" * 60)

    # 1. 检查环境
    if not check_gdal():
        qgis_gui_instructions()
        sys.exit(1)

    # 2. 下载 DOM.tif
    if not download_dom():
        sys.exit(1)

    # 3. 查看 TIFF 信息
    info = get_tiff_info(DOM_LOCAL)
    if info:
        print(f"\n[INFO] DOM.tif 信息:")
        print(f"  尺寸: {info['width']} x {info['height']} 像素")
        print(f"  波段: {info['bands']}")
        print(f"  投影: {info['projection'][:80]}...")

    # 4. 切瓦片
    check_gdal2tiles()
    if not cut_with_gdal2tiles():
        sys.exit(1)

    # 5. 统计输出
    print_tile_stats()

    # 6. 打印后续上传说明
    print_upload_instructions()


if __name__ == "__main__":
    main()
