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
 * UploadPlotLayer - 加载上传地块（地2）的三维场景。
 *
 * 点击侧边栏"已完成"任务卡片后触发（orchardStore.activePlotTaskId）：
 *  1. 销毁地1 场景（tileset + imagery + terrain + 树标记），显存只保留当前地块；
 *  2. 仿地1 加载地2：高德底图 + DOM 瓦片 + DEM 地形 + 3D Tiles；
 *  3. 用 GeoAI 分割结果（freshTrees，带经纬度+生长字段）画点标记，点击弹窗显示字段。
 *
 * 切换为单向：地1 被卸载后，回地1 需刷新页面。
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

// 地2 资源引用
let plotTreesTileset: any = null
let treeEntities: any[] = []
let clickHandler: any = null

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

// 监听激活的"已完成"地块任务 → 触发加载；任务清空（回到地1）→ dispose 地2
let loadedPlot = false

watch(
  () => orchardStore.activePlotTask,
  (task) => {
    if (task && task.status === 'completed') {
      loadedPlot = true
      loadPlot(task)
    } else if (task === null && loadedPlot) {
      const viewer = cesiumStore.viewer
      if (viewer) disposeCurrentScene(viewer)
      loadedPlot = false
    }
  },
  { immediate: true },
)

async function loadPlot(task: UploadPlotTask) {
  const viewer = cesiumStore.viewer
  if (!viewer || isLoading.value) return
  isLoading.value = true
  try {
    disposeCurrentScene(viewer)
    addGaodeImagery(viewer)
    addPlotDomImagery(viewer, task.domRect)
    await setupPlotDemTerrain(viewer)
    await loadPlotTileset(viewer)
    renderTreeMarkers(viewer, task.freshTrees)
    flyToPlot(viewer, task)
  } catch (e) {
    console.error('[UploadPlotLayer] load plot failed:', e)
  } finally {
    isLoading.value = false
  }
}

/** 销毁当前场景（地1 或上一次地2）：tileset + 底图 + 地形 + 树标记 */
function disposeCurrentScene(viewer: any): void {
  // 1) 移除所有 3D Tiles
  const primitives = viewer.scene.primitives
  const toRemove: any[] = []
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives.get(i)
    if (p instanceof Cesium.Cesium3DTileset) toRemove.push(p)
  }
  for (const p of toRemove) {
    try {
      primitives.remove(p)
      p.destroy?.()
    } catch (e) {
      /* ignore */
    }
  }
  plotTreesTileset = null

  // 2) 移除所有影像底图（高德 + DOM）
  viewer.imageryLayers.removeAll()

  // 3) 重置地形为椭球（等待地2 DEM 覆盖）
  try {
    viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider()
  } catch (e) {
    /* ignore */
  }

  // 4) 清除地1 树标记与地2 旧标记
  clearTreeMarkers(viewer)
  const orphanIds: string[] = []
  for (let i = 0; i < viewer.entities.values.length; i++) {
    const e = viewer.entities.values[i]
    if (e.id && String(e.id).startsWith('_orchard_tree_group')) orphanIds.push(e.id)
  }
  orphanIds.forEach((id) => viewer.entities.removeById(id))

  // 5) 清除属性浮窗与点击 handler
  closePropCard()
  destroyClickHandler()
}

// ==================== 底图 / 地形 ====================

function addGaodeImagery(viewer: any): void {
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
): void {
  if (!domRect) return
  const [west, south, east, north] = domRect
  viewer.imageryLayers.addImageryProvider(
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

/** 仿地1 dem.js 地形（参数化为地2 的 dem.js URL，失败降级为椭球） */
async function setupPlotDemTerrain(viewer: any): Promise<void> {
  try {
    const res = await fetch(UPLOAD_PLOT_DEM)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const code = await res.text()
    // dem2.js 内容是 window.DEM=...，替换成 window.DEM2，避免覆盖地1 的 window.DEM
    const code2 = code.replace(/window\.DEM\s*=/g, 'window.DEM2 =')
    new Function(code2)()
    if (!(window as any).DEM2) throw new Error('dem2.js 未定义 window.DEM2')
  } catch (e) {
    console.warn('[UploadPlotLayer] 加载地2 dem2.js 失败，保持平椭球地形:', e)
    return
  }

  const D = (window as any).DEM2
  const demHeight = (lonDeg: number, latDeg: number): number => {
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

  class DemTerrainProvider {
    errorEvent: any
    credit: any
    hasWaterMask = false
    hasVertexNormals = false
    private _tilingScheme = new Cesium.GeographicTilingScheme()
    private _w = 65
    private _h = 65
    private _levelZeroGeometricError: number

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
      return new Cesium.HeightmapTerrainData({ buffer: buf, width: w, height: h })
    }

    getLevelMaximumGeometricError(level: number): number {
      return this._levelZeroGeometricError / (1 << level)
    }

    getTileDataAvailable(): boolean {
      return true
    }
  }

  try {
    viewer.scene.terrainProvider = new DemTerrainProvider()
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
