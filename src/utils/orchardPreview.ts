/**
 * 果园2.0 预览风格底图/地形
 *
 * 对齐 C:\Users\BAI\Desktop\果园2.0\tiles\viewer.html 的渲染配置:
 *  1) 高德卫星影像 —— 园外大范围背景(GCJ-02 与 WGS84 偏移约 599m,仅作外围参考)
 *  2) DOM 无人机 1.4cm 正射影像 —— 果园范围内,云服务器 8765 瓦片(17-23 级)
 *  3) DEM 起伏地形 —— 树根贴地(IDW 插值高程,数据来自 dem.js)
 *
 * 数据源全部来自本机 orchard 静态服务(http://100.69.181.81:8765),CORS 已开启。
 * 依赖: 需先运行 scripts/serve_orchard.py(与 OrchardTilesetLayer 同一数据源)。
 */
declare const Cesium: any

// DOM 无人机影像覆盖范围(与 geotiffBasemap.ts / view.ts 一致,果园真实范围)
export const DOM_RECT = {
  west: 116.4964871416,
  south: 27.1313509689,
  east: 116.4985926154,
  north: 27.133232838,
}

const DOM_BASE = 'http://100.69.181.81:8766'

/** 查找 URL 含 needle 的影像图层（幂等去重用） */
function findImageryByUrl(viewer: any, needle: string): any[] {
  const layers = viewer.imageryLayers
  const found: any[] = []
  for (let i = 0; i < layers.length; i++) {
    const l = layers.get(i)
    const url = l?._imageryProvider?.url || l?.imageryProvider?.url || ''
    if (typeof url === 'string' && url.includes(needle)) found.push(l)
  }
  return found
}

/** 高德卫星影像:园外大范围底图（幂等，重复调用只保留一层） */
function addGaodeImagery(viewer: any): void {
  findImageryByUrl(viewer, 'autonavi').forEach((l) => viewer.imageryLayers.remove(l))
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      subdomains: ['1', '2', '3', '4'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
    })
  )
}

/**
 * DOM 无人机 1.4cm 正射影像:果园范围内,优先于高德底图。
 * 幂等（重复调用先移除旧的），并把图层引用挂到 window.__dom1Layer。
 */
function addDomImagery(viewer: any): any {
  findImageryByUrl(viewer, '/dom/').forEach((l) => viewer.imageryLayers.remove(l))
  const layer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `${DOM_BASE}/dom/{z}/{x}/{y}.png`,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      rectangle: Cesium.Rectangle.fromDegrees(
        DOM_RECT.west,
        DOM_RECT.south,
        DOM_RECT.east,
        DOM_RECT.north
      ),
      minimumLevel: 17,
      maximumLevel: 23,
      credit: 'DOM 无人机影像',
    })
  )
  layer.show = true
  ;(window as any).__dom1Layer = layer
  return layer
}

/** 对单个 DEM 数据集(D 含 minLon/maxLon/minLat/maxLat/nx/ny/data)做双线性插值(与 viewer.html demHeight 一致) */
function interpolateDem(D: any, lonDeg: number, latDeg: number): number {
  const fx = ((lonDeg - D.minLon) / (D.maxLon - D.minLon)) * (D.nx - 1)
  const fy = ((latDeg - D.minLat) / (D.maxLat - D.minLat)) * (D.ny - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, D.nx - 1)
  const y1 = Math.min(y0 + 1, D.ny - 1)
  const tx = fx - x0
  const ty = fy - y0
  const d = D.data
  const nx = D.nx
  const z00 = d[y0 * nx + x0]
  const z10 = d[y0 * nx + x1]
  const z01 = d[y1 * nx + x0]
  const z11 = d[y1 * nx + x1]
  return (z00 * (1 - tx) + z10 * tx) * (1 - ty) + (z01 * (1 - tx) + z11 * tx) * ty
}

/**
 * 双线性插值高程：地2 区域优先 DEM2(上传地块高程)，其余走地1 DEM1。
 * 地1 与地2 恒共存后 Cesium 只有一个 terrainProvider，合并地形按经纬度分派两个 DEM。
 */
function demHeight(lonDeg: number, latDeg: number): number {
  const D2 = (window as any).DEM2
  if (
    D2 &&
    lonDeg >= D2.minLon &&
    lonDeg <= D2.maxLon &&
    latDeg >= D2.minLat &&
    latDeg <= D2.maxLat
  ) {
    return interpolateDem(D2, lonDeg, latDeg)
  }
  const D = (window as any).DEM
  if (!D || lonDeg < D.minLon || lonDeg > D.maxLon || latDeg < D.minLat || latDeg > D.maxLat) {
    return D ? D.zMin - 2 : 0 // 范围外略低,避免边缘翘起穿模
  }
  return interpolateDem(D, lonDeg, latDeg)
}

/** 自定义 TerrainProvider(移植自 viewer.html) */
class DemTerrainProvider {
  errorEvent: any
  credit: any
  hasWaterMask = false
  hasVertexNormals = false
  private _tilingScheme = new Cesium.GeographicTilingScheme()
  private _w = 65
  private _h = 65
  private _levelZeroGeometricError: number
  /** heightmap 瓦片缓存：地形 Provider 互换时 Cesium 会整盘重建可见瓦片，按瓦片坐标缓存可复用插值结果 */
  private _tileCache = new Map<string, any>()

  constructor() {
    this._levelZeroGeometricError =
      Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
        this._tilingScheme.ellipsoid,
        this._w,
        this._tilingScheme.getNumberOfXTilesAtLevel(0)
      )
  }

  get tilingScheme(): any {
    return this._tilingScheme
  }

  requestTileGeometry(x: number, y: number, level: number): any {
    const key = `${level}/${x}/${y}`
    const hit = this._tileCache.get(key)
    if (hit) return hit
    const rect = this._tilingScheme.tileXYToRectangle(x, y, level)
    const w = this._w
    const h = this._h
    const buf = new Float32Array(w * h)
    for (let j = 0; j < h; j++) {
      const lat = Cesium.Math.toDegrees(rect.north - ((rect.north - rect.south) * j) / (h - 1))
      for (let i = 0; i < w; i++) {
        const lon = Cesium.Math.toDegrees(rect.west + ((rect.east - rect.west) * i) / (w - 1))
        buf[j * w + i] = demHeight(lon, lat)
      }
    }
    const data = new Cesium.HeightmapTerrainData({ buffer: buf, width: w, height: h })
    // 有界缓存，超限整体清空（实际可见瓦片仅几十~几百，2000 足够；每次互换都重写同一批 key）
    if (this._tileCache.size >= 2000) this._tileCache.clear()
    this._tileCache.set(key, data)
    return data
  }

  getLevelMaximumGeometricError(level: number): number {
    return this._levelZeroGeometricError / (1 << level)
  }

  getTileDataAvailable(): boolean {
    return true
  }
}

/** 复用的 DEM Provider 实例(避免重复设置时瓦片重载闪烁) */
let cachedDemProvider: any = null

/** 确保 dem.js 已加载到 window.DEM; 已加载则直接返回 true */
async function ensureDemData(): Promise<boolean> {
  if ((window as any).DEM) return true
  try {
    const res = await fetch(`${DOM_BASE}/dem.js`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const code = await res.text()
    new Function(code)()
    if (!(window as any).DEM) throw new Error('dem.js 未定义 window.DEM')
    return true
  } catch (e) {
    console.warn('[DEM] 加载 dem.js 失败,保持平椭球地形:', e)
    return false
  }
}

/**
 * 应用 DEM 起伏地形(幂等,可复用)。
 *
 * 果园的树/精模 3D Tiles 按 dem.js 的真实地面高程(约 180~195m)定位,
 * 场景地表必须也是 DEM 地形,树才能贴地。若被替换为扁平椭球(0m),树会悬浮在空中。
 * 底图/地形图层关闭或加载失败时,应调用本函数恢复 DEM 基准,而不是回退到椭球。
 *
 * @returns 是否成功启用 DEM 地形
 */
export async function applyDemTerrain(viewer: any): Promise<boolean> {
  if (!viewer) return false
  if (!(await ensureDemData())) return false
  try {
    if (!cachedDemProvider) cachedDemProvider = new DemTerrainProvider()
    // 已是 DEM1 地形时不再赋值，避免 Cesium 整盘重建地形瓦片
    if (viewer.scene.terrainProvider !== cachedDemProvider) {
      viewer.scene.terrainProvider = cachedDemProvider
    }
    console.log('[DEM] 已启用 DEM 起伏地形(树根贴地)')
    return true
  } catch (e) {
    console.warn('[DEM] 设置地形失败:', e)
    return false
  }
}

/**
 * 加载地2 dem2.js 到 window.DEM2，并把地形重建为「地1 区域 DEM1 + 地2 区域 DEM2」的合并地形。
 *
 * 地1 与地2 恒共存后 Cesium 只有一个 terrainProvider，不能再"切换"地形。demHeight 已按
 * 经纬度分派（地2 范围读 window.DEM2，其余走 window.DEM），因此加载 DEM2 后只需重建一个
 * provider 实例，两区域即各有正确地表起伏（地2 3D Tiles 只有树模型、无地表 mesh，地表全靠
 * 此 DEM 提供，若缺失则地2 区域会平铺成地1 的外围高度）。
 *
 * @returns 合并地形是否成功启用
 */
export async function applyPlotDem2Terrain(viewer: any): Promise<boolean> {
  if (!viewer) return false
  if (!(window as any).DEM2) {
    try {
      const res = await fetch(`${DOM_BASE}/dem2.js`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const code = await res.text()
      // dem2.js 内容是 window.DEM=...，替换成 window.DEM2，避免覆盖地1 的 window.DEM
      const code2 = code.replace(/window\.DEM\s*=/g, 'window.DEM2 =')
      new Function(code2)()
      if (!(window as any).DEM2) throw new Error('dem2.js 未定义 window.DEM2')
    } catch (e) {
      console.warn('[DEM] 加载地2 dem2.js 失败，地2 区域保持地1 高程:', e)
      return false
    }
  }
  try {
    // 强制重建 provider 实例：Cesium 的 terrainProvider setter 有引用相等检查，
    // 赋同一个实例不会触发瓦片重建，必须换新实例让瓦片用合并后的 demHeight 重新生成。
    cachedDemProvider = new DemTerrainProvider()
    viewer.scene.terrainProvider = cachedDemProvider
    console.log('[DEM] 已重建合并地形（地1 DEM1 + 地2 DEM2 共存）')
    return true
  } catch (e) {
    console.warn('[DEM] 设置合并地形失败:', e)
    return false
  }
}

/**
 * 一次性配齐"预览风格"底图 + 地形(异步,不阻塞首帧渲染)。
 * 底图、dem.js 任一失败都只告警,不影响 3D Tiles 本身。
 *
 * @returns DEM 地形是否成功启用
 */
export async function setupOrchardPreviewBasemap(viewer: any): Promise<boolean> {
  addGaodeImagery(viewer)
  addDomImagery(viewer)
  return applyDemTerrain(viewer)
}
