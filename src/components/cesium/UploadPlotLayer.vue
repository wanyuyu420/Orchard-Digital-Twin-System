<template>
  <!-- 树冠属性浮窗（复用 OrchardTilesetLayer 的非 scoped .oc-prop-card 全局样式） -->
  <div
    ref="propCardRef"
    class="oc-prop-card"
    v-show="cardVisible"
    @click="onCardClick"
  ></div>
</template>

<script setup lang="ts">
/**
 * UploadPlotLayer - 在地1 场景之上叠加加载上传地块（地2）。
 *
 * 点击侧边栏"已完成"任务卡片后触发（orchardStore.activePlotTaskId）：
 *  1. 只移除上一次地2 的资源（tileset + DOM2 + 树标记），保留地1 场景不动；
 *  2. 叠加加载地2：DOM2 瓦片 + 3D Tiles，高德底图已存在时不重复叠加；
 *  3. 用 GeoAI 分割结果（freshTrees，带经纬度+生长字段）画点标记，点击弹窗显示字段。
 *
 * 显隐控制："显示原地块"开关（orchardStore.plot1Visible）只控制地1 各图层显隐
 * （由 CesiumViewer / OrchardTilesetLayer 处理），地2 始终保留；
 * 地形跟随开关：显示地1 → DEM1，隐藏地1 → DEM2。
 */
import { ref, watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useOrchardStore } from '@/stores/orchard'
import {
  UPLOAD_PLOT_TILESETS,
  UPLOAD_PLOT_DOM,
  UPLOAD_PLOT_DEM,
  GAODE_IMAGERY_URL,
} from '@/config/uploadPlot'
import type { FreshTree, UploadPlotTask } from '@/types/orchard'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const orchardStore = useOrchardStore()

const isLoading = ref(false)

// 地2 资源引用（只管理地2 自己的，不碰地1）
let plotTreesTileset: any = null
let dom2Layer: any = null
let treeEntities: any[] = []
let clickHandler: any = null
/** 复用的地2 DEM Provider 实例（避免重复设置时瓦片重载闪烁） */
let cachedPlotDemProvider: any = null

// 属性浮窗
const propCardRef = ref<HTMLElement | null>(null)
const cardVisible = ref(false)
let propAnchor: any = null

const FIELD_UNIT: Record<string, string> = {
  树高: ' m',
  冠幅直径: ' m',
  冠幅面积: ' m²',
  冠层体积: ' m³',
  周长: ' m',
  坡度: '°',
  坡向: '°',
  长势指数: '',
  紧凑度: '',
  施肥量: ' kg',
}

// 监听激活的"已完成"地块任务 → 叠加加载地2；任务清空 → 只移除地2（保留地1）
let loadedPlot = false

watch(
  () => orchardStore.activePlotTask,
  (task) => {
    if (task && task.status === 'completed') {
      loadedPlot = true
      loadPlot(task)
    } else if (task === null && loadedPlot) {
      const viewer = cesiumStore.viewer
      if (viewer) disposePlot2(viewer)
      loadedPlot = false
    }
  },
  { immediate: true },
)

// 隐藏地1（开关 off）→ 切到地2 的 DEM 地形贴合地块高程；显示地1 时由 CesiumViewer 恢复 DEM1
watch(
  () => orchardStore.plot1Visible,
  (v) => {
    if (!v && loadedPlot && cesiumStore.viewer) {
      setupPlotDemTerrain(cesiumStore.viewer)
    }
  },
)

async function loadPlot(task: UploadPlotTask) {
  const viewer = cesiumStore.viewer
  if (!viewer || isLoading.value) return
  isLoading.value = true
  try {
    // 只清上一次地2，不碰地1 场景
    disposePlot2(viewer)
    addGaodeImagery(viewer)
    dom2Layer = addPlotDomImagery(viewer, task.domRect)
    // 地形跟随开关：地1 显示中保持 DEM1，地1 已隐藏才切 DEM2
    if (!orchardStore.plot1Visible) await setupPlotDemTerrain(viewer)
    await loadPlotTileset(viewer)
    renderTreeMarkers(viewer, task.freshTrees)
    flyToPlot(viewer, task)
  } catch (e) {
    console.error('[UploadPlotLayer] load plot failed:', e)
  } finally {
    isLoading.value = false
  }
}

/** 仅移除上一次地2 的资源（tileset + DOM2 + 树标记 + handler），保留地1 场景 */
function disposePlot2(viewer: any): void {
  if (plotTreesTileset) {
    try {
      viewer.scene.primitives.remove(plotTreesTileset)
      plotTreesTileset.destroy?.()
    } catch (e) {
      /* ignore */
    }
    plotTreesTileset = null
  }
  if (dom2Layer) {
    try {
      viewer.imageryLayers.remove(dom2Layer)
    } catch (e) {
      /* ignore */
    }
    dom2Layer = null
  }
  clearTreeMarkers(viewer)
  closePropCard()
  destroyClickHandler()
}

// ==================== 底图 / 地形 ====================

function addGaodeImagery(viewer: any): void {
  // 幂等：地1 已加过高德底图时（共存场景）不重复叠加
  for (let i = 0; i < viewer.imageryLayers.length; i++) {
    const l = viewer.imageryLayers.get(i)
    const url = l?._imageryProvider?.url || l?.imageryProvider?.url || ''
    if (typeof url === 'string' && url.includes('autonavi')) return
  }
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: GAODE_IMAGERY_URL,
      subdomains: ['1', '2', '3', '4'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
    }),
  )
}

function addPlotDomImagery(
  viewer: any,
  domRect: [number, number, number, number] | null,
): any | null {
  if (!domRect) return null
  const [west, south, east, north] = domRect
  return viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      // gdal2tiles --xyz 生成 XYZ 约定（y 从上往下），Cesium WebMercatorTilingScheme 的 {y} 即 XYZ
      url: `${UPLOAD_PLOT_DOM.base}/{z}/{x}/{y}.png`,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      rectangle: Cesium.Rectangle.fromDegrees(west, south, east, north),
      minimumLevel: UPLOAD_PLOT_DOM.minLevel,
      maximumLevel: UPLOAD_PLOT_DOM.maxLevel,
      credit: '地2 DOM 无人机影像',
    }),
  )
}

/** 地2 DEM 高程插值（仿地1 demHeight，读取 window.DEM2，范围外略低避免穿模） */
function plotDemHeight(lonDeg: number, latDeg: number): number {
  const D = (window as any).DEM2
  if (!D || lonDeg < D.minLon || lonDeg > D.maxLon || latDeg < D.minLat || latDeg > D.maxLat) {
    return D ? D.zMin - 2 : 0
  }
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

/** 地2 DEM 地形 Provider（模块级复用，避免重复设置时瓦片重载闪烁） */
class PlotDemTerrainProvider {
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
        this._tilingScheme.getNumberOfXTilesAtLevel(0),
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
        buf[j * w + i] = plotDemHeight(lon, lat)
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

/**
 * 应用地2 DEM 地形（幂等，可复用）：确保 dem2.js 已加载到 window.DEM2 后，
 * 用缓存的 PlotDemTerrainProvider 覆盖地形（保持 DEM 基准，绝不回退到扁平椭球，地2 树根贴地）。
 */
async function setupPlotDemTerrain(viewer: any): Promise<void> {
  if (!(window as any).DEM2) {
    try {
      const res = await fetch(UPLOAD_PLOT_DEM)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const code = await res.text()
      // dem2.js 内容是 window.DEM=...，替换成 window.DEM2，避免覆盖地1 的 window.DEM
      const code2 = code.replace(/window\.DEM\s*=/g, 'window.DEM2 =')
      new Function(code2)()
      if (!(window as any).DEM2) throw new Error('dem2.js 未定义 window.DEM2')
    } catch (e) {
      console.warn('[UploadPlotLayer] 加载地2 dem2.js 失败，保持当前地形:', e)
      return
    }
  }
  if (!cachedPlotDemProvider) cachedPlotDemProvider = new PlotDemTerrainProvider()
  try {
    // 已是地2 DEM 地形时不再赋值，避免 Cesium 整盘重建地形瓦片
    if (viewer.scene.terrainProvider !== cachedPlotDemProvider) {
      viewer.scene.terrainProvider = cachedPlotDemProvider
    }
  } catch (e) {
    console.warn('[UploadPlotLayer] 设置地2 地形失败:', e)
  }
}

// ==================== 3D Tiles ====================

async function loadPlotTileset(viewer: any): Promise<void> {
  try {
    const treeTiles = await Cesium.Cesium3DTileset.fromUrl(UPLOAD_PLOT_TILESETS.trees, {
      maximumScreenSpaceError: 4,
      cacheBytes: 2 * 1024 * 1024 * 1024,
      maximumCacheOverflowBytes: 512 * 1024 * 1024,
    })
    viewer.scene.primitives.add(treeTiles)
    plotTreesTileset = treeTiles
    ;(window as any).__uploadPlotTreesTileset = treeTiles
    console.log('[UploadPlotLayer] 地2 树 tileset 加载成功')
    // 监听 tile 加载失败，打印具体原因
    treeTiles.tileFailed.addEventListener((error: any) => {
      console.error('[UploadPlotLayer] tile 加载失败:', error)
    })
  } catch (e) {
    console.warn('[UploadPlotLayer] 加载地2 树 tileset 失败:', e)
  }
}

// ==================== 树标记 + 点击弹窗 ====================

function clearTreeMarkers(viewer: any): void {
  treeEntities.forEach((e) => viewer.entities.remove(e))
  treeEntities = []
}

function renderTreeMarkers(viewer: any, trees: FreshTree[]): void {
  clearTreeMarkers(viewer)
  if (!trees?.length) return

  trees.forEach((tree, index) => {
    const height = (tree.height_m ?? 0) + 1
    const entity = viewer.entities.add({
      id: `_upload_plot_tree_${index}`,
      position: Cesium.Cartesian3.fromDegrees(tree.lng, tree.lat, height),
      point: {
        pixelSize: 9,
        color: Cesium.Color.fromCssColorString('#4ade80').withAlpha(0.01),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.01),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    treeEntities.push(entity)
  })

  setupClickHandler(viewer, trees)
}

function setupClickHandler(viewer: any, trees: FreshTree[]): void {
  destroyClickHandler()
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  clickHandler.setInputAction((movement: any) => {
    // 1) 先试拾取树冠点（透明点）
    const picked = viewer.scene.pick(movement.position)
    if (picked?.id?.id && String(picked.id.id).startsWith('_upload_plot_tree_')) {
      const index = parseInt(String(picked.id.id).replace('_upload_plot_tree_', ''), 10)
      const tree = trees[index]
      if (tree) {
        showTreeCard(viewer, tree, index, movement.position)
        return
      }
    }

    // 2) 否则 drillPick 拾取地2 树模型，按经纬度匹配最近的 GeoAI 树
    const picks = viewer.scene.drillPick(movement.position, 10, 5, 5)
    const feature = picks.find(
      (p: any) => p instanceof Cesium.Cesium3DTileFeature && p.tileset === plotTreesTileset,
    )
    if (!feature) {
      closePropCard()
      return
    }
    const cartesian = viewer.scene.pickPosition(movement.position)
    if (!cartesian) {
      closePropCard()
      return
    }
    const carto = Cesium.Cartographic.fromCartesian(cartesian)
    const lng = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    let bestIndex = -1
    let bestDist = Infinity
    trees.forEach((tree, i) => {
      const d = (tree.lng - lng) ** 2 + (tree.lat - lat) ** 2
      if (d < bestDist) {
        bestDist = d
        bestIndex = i
      }
    })
    if (bestIndex >= 0) {
      showTreeCard(viewer, trees[bestIndex], bestIndex, movement.position)
    } else {
      closePropCard()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  viewer.scene.postRender.addEventListener(updatePropCardPos)
}

function showTreeCard(viewer: any, tree: FreshTree, index: number, screenPos: any): void {
  const rows: [string, any][] = [
    ['树高', tree.height_m],
    ['冠幅直径', tree.crown_diameter],
    ['冠幅面积', tree.area_m2],
    ['冠层体积', tree.volume_m3],
    ['周长', tree.shape_length],
    ['坡度', tree.slope_degree],
    ['坡向', tree.aspect],
    ['长势指数', tree.growth_index],
    ['紧凑度', tree.compactness],
    ['长势', tree.growth_status],
    ['施肥等级', ['', '轻度', '中度', '重度'][tree.fertilizer_level ?? 0] || '—'],
    ['施肥量', tree.fertilizer_kg],
  ]

  let html =
    '<div class="oc-inner"><div class="oc-title"><span>树冠参数 #' +
    (index + 1) +
    '</span><span class="oc-close">×</span></div>'
  rows.forEach(([label, val], i) => {
    let v: any = val
    if (v === null || v === undefined) v = '—'
    if (typeof v === 'number') v = +v.toFixed(3)
    html +=
      '<div class="oc-row" style="animation-delay:' +
      (0.05 + i * 0.04).toFixed(2) +
      's"><span class="oc-k">' +
      label +
      '</span><span class="oc-v">' +
      v +
      (FIELD_UNIT[label] || '') +
      '</span></div>'
  })
  html += '</div>'
  if (propCardRef.value) propCardRef.value.innerHTML = html

  let wp = viewer.scene.pickPositionSupported
    ? viewer.scene.pickPosition(screenPos)
    : undefined
  if (!wp) {
    const ray = viewer.camera.getPickRay(screenPos)
    wp = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined
  }
  if (wp) {
    const up = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(wp, new Cesium.Cartesian3())
    propAnchor = Cesium.Cartesian3.add(
      wp,
      Cesium.Cartesian3.multiplyByScalar(up, 2, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    cardVisible.value = true
    updatePropCardPos()
  } else {
    propAnchor = null
    cardVisible.value = true
    if (propCardRef.value) {
      propCardRef.value.style.left = screenPos.x + 'px'
      propCardRef.value.style.top = screenPos.y + 'px'
    }
  }
}

function updatePropCardPos(): void {
  const viewer = cesiumStore.viewer
  if (!propAnchor || !cardVisible.value || !viewer) return
  const card = propCardRef.value
  if (!card) return
  const st = Cesium.SceneTransforms
  const fn = st.worldToWindowCoordinates || st.wgs84ToWindowCoordinates
  const p = fn.call(st, viewer.scene, propAnchor)
  if (!p) {
    card.style.visibility = 'hidden'
    return
  }
  card.style.visibility = 'visible'
  const w = card.offsetWidth
  const h = card.offsetHeight
  const cw = viewer.scene.canvas.clientWidth
  const ch = viewer.scene.canvas.clientHeight
  const x = Math.max(w / 2 + 6, Math.min(p.x, cw - w / 2 - 6))
  const below = p.y - h - 20 < 4 && p.y + 20 + h < ch - 4
  card.classList.toggle('oc-below', below)
  const y = below ? p.y : Math.max(h + 24, Math.min(p.y, ch - 8))
  card.style.left = `${x}px`
  card.style.top = `${y}px`
}

function closePropCard(): void {
  cardVisible.value = false
  propAnchor = null
}

function onCardClick(e: MouseEvent): void {
  if ((e.target as HTMLElement).classList.contains('oc-close')) closePropCard()
}

function destroyClickHandler(): void {
  const viewer = cesiumStore.viewer
  if (viewer) {
    viewer.scene.postRender.removeEventListener(updatePropCardPos)
  }
  if (clickHandler) {
    try {
      clickHandler.destroy()
    } catch (e) {
      /* ignore */
    }
    clickHandler = null
  }
}

function flyToPlot(viewer: any, task: UploadPlotTask): void {
  if (task.domRect) {
    const [west, south, east, north] = task.domRect
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
      duration: 2,
    })
  } else if (task.freshTrees?.length) {
    const t = task.freshTrees[0]
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(t.lng, t.lat, 800),
      duration: 2,
    })
  } else if (plotTreesTileset) {
    viewer.flyTo(plotTreesTileset, { duration: 2 })
  }
}

onUnmounted(() => {
  destroyClickHandler()
  if (cesiumStore.viewer) {
    clearTreeMarkers(cesiumStore.viewer)
  }
})
</script>
