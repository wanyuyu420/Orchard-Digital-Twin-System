# 服务发布操作手册

---

## 脚本清单（本文档涉及的 2 个 Python 脚本）

| 脚本文件 | 处理对象 | 输入 | 输出 | 需要装什么 |
|---------|---------|------|------|-----------|
| `cut_dom_tiles.py` | DOM.tif 正射影像 | 从 OSS 自动下载 | `dom_tiles/` 瓦片文件夹 | OSGeo4W（含 GDAL） |
| `convert_gpkg_data.py` | tree.gpkg 树冠数据 | 从 OSS 自动下载 | `tree_data.geojson` 文件 | `pip install geopandas` |

> 两个脚本都在 `scripts/data-processing/` 目录下。脚本会**自动从 OSS 下载源文件**，你不需要手动下载。

---

## 当前状态：你有 2 个文件在 OSS 上，都不能直接用

| 文件 | 当前链接 | 现状 | 浏览器访问会怎样 | 前端能用吗 |
|------|---------|------|-----------------|-----------|
| `DOM.tif` | `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/DOM.tif` | 一张大图 | 触发下载 | ❌ 不能用 |
| `tree.gpkg` | `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree.gpkg` | GIS矢量数据 | 触发下载 | ❌ 不能用 |

**原因一句话：浏览器/Cesium 不认识 `.tif` 和 `.gpkg` 格式，就像你没法用记事本打开 .psd 一样。**

---

## 目标状态：加工后变成前端能用的链接

| 文件 | 加工后链接 | 前端怎么用 |
|------|-----------|-----------|
| `DOM.tif` | `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/dom_tiles/{z}/{x}/{y}.png` | 作为底图贴在地球上 |
| `tree.gpkg` | `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree_data.geojson` | 加载树冠轮廓，点击高亮 |

---

## 你需要做的事情（2 件事）

### 第一件事：把 DOM.tif 切成瓦片

**为什么要做：** Cesium 不能吃整张 TIFF，需要切成 256x256 的小方块 PNG。

**怎么做（二选一）：**

#### 方法 A：用 QGIS 桌面版（推荐，纯鼠标操作）

1. **下载安装 QGIS**（免费开源）：https://qgis.org/download/ → 选 Windows 版，一路下一步
2. 打开 QGIS
3. 从 OSS 下载 `DOM.tif` 到本地（比如放桌面）
4. 把 `DOM.tif` 文件拖进 QGIS 窗口
5. 点击顶部菜单：**处理(Processing) → 工具箱(Toolbox)**
6. 在右侧工具箱面板搜索框输入：**xyz**
7. 双击 **Generate XYZ Tiles (Directory)**
8. 填写参数：
   - **Extent**：点右侧 `...` → 选 "Use Layer Extent" → 选 DOM 图层
   - **Minimum zoom**：填 `10`
   - **Maximum zoom**：填 `20`
   - **Tile size**：填 `256`
   - **Output directory**：点 `...` 选一个空文件夹，比如桌面新建 `dom_tiles`
   - 其余默认不动
9. 点 **Run**，等待完成（可能 10-60 分钟）
10. 把生成的 `dom_tiles` 文件夹整个上传到 OSS 的 `dom_tiles/` 路径下

#### 方法 B：用 Python 脚本（更快，但需要装 GDAL）

> 本方案对应脚本文件：`scripts/data-processing/cut_dom_tiles.py`

**脚本做了什么（自动完成，你不需要手动操作）：**
1. 自动从 OSS 下载 `DOM.tif`（如果本地还没有的话）
2. 自动读取 TIFF 信息（尺寸、投影）
3. 自动切成 256x256 的 TMS 瓦片
4. 输出到脚本同目录下的 `dom_tiles/` 文件夹
5. 在屏幕上打印最终的上传说明

**操作步骤：**

##### 第一步：安装 OSGeo4W（只需做一次）

1. 打开 https://trac.osgeo.org/osgeo4w/
2. 下载 `osgeo4w-setup.exe`，运行
3. 选 **Express Desktop Install**
4. 一路点"下一步"直到完成
5. 安装完毕后，开始菜单里会出现 **OSGeo4W Shell** 快捷方式

##### 第二步：运行脚本

1. 打开文件资源管理器，把脚本目录复制下来：
   ```
   D:\para\projects-windows\water-digital-twin-platform\scripts\data-processing
   ```
   （如果项目在别的盘，换成你的实际路径）

2. 从开始菜单打开 **OSGeo4W Shell**（一个黑色命令行窗口）

3. 在命令行里输入 `cd `（cd 后面有个空格），然后 **右键粘贴** 上面复制的路径，回车：
   ```
   cd D:\para\projects-windows\water-digital-twin-platform\scripts\data-processing
   ```

4. 运行脚本：
   ```
   python cut_dom_tiles.py
   ```

##### 第三步：等待 & 看屏幕提示

运行后你会看到类似这样的输出：

```
============================================================
 DOM.tif → TMS 瓦片切割工具
============================================================
[OK] GDAL 已安装
[下载] 正在从 https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/DOM.tif 下载...
[OK] 下载完成 (XXX MB)
[INFO] DOM.tif 信息:
  尺寸: 20000 x 15000 像素
  波段: 3
  投影: WGS 84 / UTM zone 50N...
[执行] gdal2tiles.py --zoom 10-20 ...
  切瓦片可能需要 10-60 分钟...

[OK] 瓦片切割完成!
瓦片统计: XXXXX 个文件, 共 XXX MB
```

看到 `瓦片切割完成` 就说明成功了。

**此时脚本同级目录下会多出一个 `dom_tiles` 文件夹，里面有 `0/`、`1/`、`2/`... 等子文件夹。**

##### 第四步：上传

把整个 `dom_tiles` 文件夹上传到 OSS Bucket 的 `dom_tiles/` 路径下。

---

### 第二件事：把 tree.gpkg 转成 GeoJSON

**为什么要做：** GeoPackage 是 GIS 专业格式，Cesium 只认 GeoJSON。

**怎么做（二选一）：**

#### 方法 A：用 Python 脚本（最简单）

> 本方案对应脚本文件：`scripts/data-processing/convert_gpkg_data.py`

**脚本做了什么（自动完成，你不需要手动操作）：**
1. 自动从 OSS 下载 `tree.gpkg`（如果本地还没有的话）
2. 自动读取数据，检查坐标系
3. 自动重投影到 WGS84（EPSG:4326，Cesium 标准坐标）
4. 自动计算每个树冠的中心点经纬度
5. 输出 `tree_data.geojson` 到脚本同目录
6. 在屏幕上打印数据摘要和最终上传说明

**操作步骤：**

##### 第一步：安装 geopandas（只需做一次）

打开 CMD（Win+R → 输入 `cmd` → 回车），输入：

```
pip install geopandas
```

看到 `Successfully installed` 就说明装好了。

##### 第二步：运行脚本

在同一个 CMD 窗口里（或新打开一个）：

1. 切换目录：
   ```
   cd D:\para\projects-windows\water-digital-twin-platform\scripts\data-processing
   ```
   （路径换成你项目实际位置）

2. 运行：
   ```
   python convert_gpkg_data.py
   ```

##### 第三步：等待 & 看屏幕提示

运行后你会看到类似这样的输出：

```
============================================================
 tree.gpkg → GeoJSON 转换工具
============================================================
[下载] 正在从 https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree.gpkg 下载...
[OK] 下载完成 (XX MB)

[读取] tree.gpkg ...
  原始: 15000 个要素, CRS=EPSG:32650
  字段: ['geometry', 'Confidence', 'HEIGHT', 'CROWN', ...]
[重投影] EPSG:32650 → EPSG:4326
[处理] 计算树冠中心点...
[写入] tree_data.geojson ...
[OK] GeoJSON 生成完成 (XX MB)

============================================================
 数据摘要
============================================================
  总树木数: 15000
  输出文件: tree_data.geojson

============================================================
 后续步骤
============================================================
1. 上传 tree_data.geojson 到 OSS
2. 确认 OSS 已设置 CORS 跨域
3. 前端用法: Cesium.GeoJsonDataSource.load('...tree_data.geojson')
```

看到 `GeoJSON 生成完成` 就说明成功了。

**此时脚本同级目录下会多出一个 `tree_data.geojson` 文件。**

##### 第四步：上传

把 `tree_data.geojson` 上传到 OSS Bucket 的根目录（或任何你喜欢的路径）。

#### 方法 B：用 QGIS 桌面版（如果已安装 QGIS，顺带做了）

1. 从 OSS 下载 `tree.gpkg` 到本地
2. 拖进 QGIS
3. 右键图层 → **Export** → **Save Features As...**
4. Format 选 **GeoJSON**
5. File Name 选保存位置，比如 `tree_data.geojson`
6. CRS 选 **EPSG:4326 - WGS 84**（这步很重要！）
7. 点 OK
8. 把生成的 `tree_data.geojson` 上传到 OSS 根目录

---

### 别忘了：配置 OSS 跨域

两个文件上传完后，在 OSS 控制台做一次跨域设置（做一次就行，不需要每次做）：

1. OSS 控制台 → 找到 `gananqicheng-data` Bucket
2. 左侧菜单：**数据安全 → 跨域设置**
3. 点 **创建规则**，填写：
   - **来源**：`*`
   - **允许 Methods**：勾选 `GET`、`HEAD`
   - **允许 Headers**：`*`
4. 确定

**不配跨域的话浏览器会拦截请求，前端还是调不了。**

---

## 完成后检查清单

| 检查项 | 验证方法 |
|--------|---------|
| DOM 瓦片 | 浏览器打开 `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/dom_tiles/0/0/0.png` 能看到一张图片 |
| 树木数据 | 浏览器打开 `https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree_data.geojson` 能看到一堆文本（JSON格式） |
| CORS | 打开浏览器 F12 → Network，看请求头里没有 CORS 报错 |

---

## 最终交付给前端的链接

处理完毕后，告诉前端开发这两个地址即可：

```
底图:   https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/dom_tiles/{z}/{x}/{y}.png
树冠:   https://gananqicheng-data.oss-cn-beijing.aliyuncs.com/tree_data.geojson
```
