<template>
  <slot></slot>
  <!-- 点击树/果园精模的属性浮窗(移植自果园2.0 viewer.html) -->
  <div
    ref="propCardRef"
    class="oc-prop-card"
    v-show="cardVisible"
    @click="onCardClick"
  ></div>
</template>

<script setup lang="ts">
/**
 * OrchardTilesetLayer - Loads the Orchard 2.0 real 3D Tiles into the current map.
 *
 * Data source: 云服务器部署的果园 tiles(http://100.101.73.76:8765, CORS-enabled,
 * 内容与原 果园2.0 一致:dem.js/tileset.json md5 相同,树模型 batch table 字段一致)。
 * Both tilesets carry ECEF world transforms, so they land at the correct geographic
 * position (116.4973°E, 27.1322°N) automatically — no BIMAlignment placement needed.
 *
 *  - trees/tileset.json   253 per-tree detailed b3dm
 *  - orchard/tileset.json 246 orchard refined-model b3dm
 *
 * Also ports the 果园2.0 preview's click-to-inspect: drillPick the clicked
 * feature (tree first, then orchard model) and show a property card floating
 * above the crown, updated every frame to follow the camera.
 */
import { ref, watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'

declare const Cesium: any

const cesiumStore = useCesiumStore()

const DATA_BASE = 'http://100.101.73.76:8765'

const isLoading = ref(false)
let viewer: any = null
let treesTileset: any = null
let orchardTileset: any = null

// ==================== 点击属性浮窗(移植自果园2.0 viewer.html) ====================
const FIELD_UNIT: Record<string, string> = {
  树高: ' m',
  东西宽度: ' m',
  南北宽度: ' m',
  冠幅直径: ' m',
  冠幅面积: ' m²',
  冠层高度: ' m',
  冠层体积: ' m³',
  坡度: '°',
  坡向: '°',
}

const propCardRef = ref<HTMLElement | null>(null)
const cardVisible = ref(false)
let clickHandler: any = null
let propAnchor: any = null

function closePropCard(): void {
  cardVisible.value = false
  propAnchor = null
}

/** 浮窗右上角 × 关闭 */
function onCardClick(e: MouseEvent): void {
  if ((e.target as HTMLElement).classList.contains('oc-close')) closePropCard()
}

/** 每帧把锚点投影为屏幕坐标,浮窗浮在树的上方并跟随相机 */
function updatePropCardPos(): void {
  if (!propAnchor || !cardVisible.value) return
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
  // 钳制在画布内:上方放不下时翻转到锚点下方
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

/** 注册左键点击拾取(仅一次) */
function setupClickHandler(): void {
  if (clickHandler || !viewer) return
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  clickHandler.setInputAction(
    (movement: any) => {
      // drillPick 取命中列表,优先带"树木编号"的树,其次果园精模
      const picks = viewer.scene.drillPick(movement.position, 10, 5, 5)
      let picked: any = null
      for (const p of picks) {
        if (p instanceof Cesium.Cesium3DTileFeature) {
          const ids = p.getPropertyIds ? p.getPropertyIds() : p.getPropertyNames()
          if (ids.indexOf('树木编号') >= 0) {
            picked = p
            break
          }
        }
      }
      if (!picked) {
        for (const p of picks) {
          if (p instanceof Cesium.Cesium3DTileFeature) {
            picked = p
            break
          }
        }
      }
      if (!picked) {
        closePropCard()
        return
      }

      const names = picked.getPropertyIds ? picked.getPropertyIds() : picked.getPropertyNames()
      const isTree = names.indexOf('树木编号') >= 0
      const idVal = isTree ? picked.getProperty('树木编号') : picked.getProperty('featureId')

      let html =
        '<div class="oc-inner"><div class="oc-title"><span>' +
        (isTree ? '树木参数' : '果园精模') +
        ' #' +
        idVal +
        '</span><span class="oc-close">×</span></div>'
      for (let i = 0; i < names.length; i++) {
        if (names[i] === 'featureId' || names[i] === 'nodeId' || names[i] === 'isLeaf') continue
        let v: any = picked.getProperty(names[i])
        if (v === null || v === undefined) v = '—'
        if (typeof v === 'number') v = +v.toFixed(3)
        if (v === true) v = '是'
        if (v === false) v = '否'
        const unit = FIELD_UNIT[names[i]] || ''
        html +=
          '<div class="oc-row" style="animation-delay:' +
          (0.05 + i * 0.04).toFixed(2) +
          's">' +
          '<span class="oc-k">' +
          names[i] +
          '</span><span class="oc-v">' +
          v +
          unit +
          '</span></div>'
      }
      html += '</div>'
      if (propCardRef.value) propCardRef.value.innerHTML = html

      // 锚点:点击处的几何位置,沿地表法线上抬到树冠上方
      let wp = viewer.scene.pickPositionSupported
        ? viewer.scene.pickPosition(movement.position)
        : undefined
      if (!wp) {
        const ray = viewer.camera.getPickRay(movement.position)
        wp = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined
      }
      if (wp) {
        const up = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(wp, new Cesium.Cartesian3())
        const lift = isTree ? 2 : 6
        propAnchor = Cesium.Cartesian3.add(
          wp,
          Cesium.Cartesian3.multiplyByScalar(up, lift, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        )
        cardVisible.value = true
        updatePropCardPos()
      } else {
        propAnchor = null
        cardVisible.value = true
        if (propCardRef.value) {
          propCardRef.value.style.left = movement.position.x + 'px'
          propCardRef.value.style.top = movement.position.y + 'px'
        }
      }
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  )

  viewer.scene.postRender.addEventListener(updatePropCardPos)
}

// ==================== 瓦片加载 ====================
// 树(trees)启动即加载;果园精模(orchard)懒加载,点击控制条才真正加载(1.8GB 数据)
watch(
  () => cesiumStore.viewer,
  (v) => {
    if (v && !treesTileset && !isLoading.value) {
      loadTrees()
    }
  },
  { immediate: true }
)

async function loadTrees() {
  viewer = cesiumStore.viewer
  if (!viewer || isLoading.value) return

  isLoading.value = true
  console.log(`[OrchardTilesetLayer] Loading orchard 3D Tiles from ${DATA_BASE}...`)

  // 1) Per-tree detailed tileset
  try {
    const treeTiles = await Cesium.Cesium3DTileset.fromUrl(`${DATA_BASE}/trees/tileset.json`, {
      maximumScreenSpaceError: 4,
      cacheBytes: 2 * 1024 * 1024 * 1024,
      maximumCacheOverflowBytes: 512 * 1024 * 1024,
    })
    viewer.scene.primitives.add(treeTiles)
    treesTileset = treeTiles
    ;(window as any).__orchardTreesTileset = treeTiles
    console.log('[OrchardTilesetLayer] trees tileset loaded (253 trees)')

    // Fly to the orchard once the tree layer is in
    viewer.flyTo(treeTiles, { duration: 2 }).then(() => {
      setTimeout(() => {
        try {
          const camera = viewer.camera
          const cartographic = Cesium.Cartographic.fromCartesian(camera.position)
          cesiumStore.setHomeView({
            lon: Cesium.Math.toDegrees(cartographic.longitude),
            lat: Cesium.Math.toDegrees(cartographic.latitude),
            height: cartographic.height,
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll,
          })
          console.log('[OrchardTilesetLayer] Home view saved')
        } catch (e) {
          console.warn('[OrchardTilesetLayer] Failed to save home view:', e)
        }
      }, 500)
    })

    // Click-to-inspect works for trees immediately
    setupClickHandler()
  } catch (e) {
    console.error('[OrchardTilesetLayer] Failed to load trees tileset:', e)
  }
}

/** 果园精模懒加载(独立于树)。仅当用户点"显示果园精模"才调用。 */
async function loadOrchard() {
  if (orchardTileset || !viewer) return

  try {
    const orchardTiles = await Cesium.Cesium3DTileset.fromUrl(`${DATA_BASE}/orchard/tileset.json`, {
      maximumScreenSpaceError: 4,
      cacheBytes: 4 * 1024 * 1024 * 1024,
      maximumCacheOverflowBytes: 1024 * 1024 * 1024,
    })
    viewer.scene.primitives.add(orchardTiles)
    orchardTileset = orchardTiles
    ;(window as any).__orchardOrchardTileset = orchardTiles
    orchardTiles.show = cesiumStore.orchardModelsVisible
    cesiumStore.orchardModelsLoaded = true
    console.log('[OrchardTilesetLayer] orchard tileset loaded (246 models)')
  } catch (e) {
    // 加载失败:回退显隐状态,让控制条按钮回到"显示果园精模"而非卡在"加载中…"
    cesiumStore.orchardModelsVisible = false
    console.error('[OrchardTilesetLayer] Failed to load orchard tileset:', e)
  }
}

// ==================== 响应控制条状态(移植自 viewer.html 工具栏) ====================
// 树透明度:通过 style color alpha 控制(与 viewer.html: color('white', alpha) 一致)
watch(
  () => cesiumStore.orchardTreeOpacity,
  (a) => {
    if (treesTileset) {
      treesTileset.style = new Cesium.Cesium3DTileStyle({ color: `color('white', ${a})` })
    }
  }
)

// 树显隐
watch(
  () => cesiumStore.orchardTreesVisible,
  (v) => {
    if (treesTileset) treesTileset.show = v
  }
)

// 果园精模显隐:首次显示触发懒加载
watch(
  () => cesiumStore.orchardModelsVisible,
  (v) => {
    if (v) {
      if (!orchardTileset) loadOrchard()
      else orchardTileset.show = true
    } else if (orchardTileset) {
      orchardTileset.show = false
    }
  }
)

onUnmounted(() => {
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
  for (const t of [treesTileset, orchardTileset]) {
    if (t && viewer) {
      try {
        viewer.scene.primitives.remove(t)
        t.destroy()
      } catch (e) {
        /* ignore */
      }
    }
  }
  treesTileset = null
  orchardTileset = null
  delete (window as any).__orchardTreesTileset
  delete (window as any).__orchardOrchardTileset
})
</script>

<style>
/* ========== 属性浮窗样式(移植自果园2.0 viewer.html,非 scoped 以作用于 v-html) ========== */
.oc-prop-card {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 9999;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 16px));
}
.oc-prop-card.oc-below {
  transform: translate(-50%, 16px);
}
.oc-inner {
  position: relative;
  min-width: 230px;
  max-width: 300px;
  background: rgba(18, 24, 30, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-left: 4px solid #4caf50;
  border-radius: 10px;
  color: #eceff1;
  font: 13px/1.5 sans-serif;
  padding: 0 0 8px;
  pointer-events: auto;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  animation: ocCardIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.oc-inner::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -8px;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-top-color: rgba(18, 24, 30, 0.88);
  border-bottom: none;
}
.oc-below .oc-inner::after {
  bottom: auto;
  top: -8px;
  border-top: none;
  border-bottom: 8px solid rgba(18, 24, 30, 0.88);
}
.oc-title {
  padding: 10px 14px 6px;
  font-size: 14px;
  font-weight: 600;
  color: #a5d6a7;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.oc-close {
  cursor: pointer;
  color: #78909c;
  font-size: 16px;
  padding: 0 2px;
}
.oc-close:hover {
  color: #fff;
}
.oc-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 14px;
  opacity: 0;
  transform: translateY(8px);
  animation: ocRowIn 0.3s ease forwards;
}
.oc-row:hover {
  background: rgba(255, 255, 255, 0.06);
}
.oc-k {
  color: #90a4ae;
}
.oc-v {
  color: #fff;
  font-weight: 500;
}
@keyframes ocCardIn {
  from {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ocRowIn {
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
