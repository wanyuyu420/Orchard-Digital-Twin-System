<template>
  <div class="main-layout">
    <!-- Layer 4: Top Menu Bar -->
    <TopMenuBar />

    <!-- Layer 5: Left Sidebar (Google Maps style) -->
    <LeftSidebar />

    <!-- GIS Layer (handles drawing tools) -->
    <GISLayer />

    <!-- Dynamic Layers -->
    <DynamicLayerRenderer />

    <!-- 历史老树拾取点图层 -->
    <HistoricalTreeLayer />

    <!-- 弱树告警红点图层 -->
    <AlertsLayer />

    <!-- Layer 2: UI Layer (Router View) -->
    <div class="ui-layer">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <!-- 右上角功能面板容器:纵向排开,多开时不再叠加 -->
    <div class="right-dock">
      <!-- 图层管理面板（顶栏按钮开关） -->
      <div v-if="layerStore.showManager" class="layer-manager">
        <LayerControl />
      </div>
      <QueryPanel />
      <QueryResultPanel />
      <OrchardChartDialog />
    </div>

    <!-- 居中窗口 -->
    <DetailPanel />
    <AnalysisResultWindow />
    <FertilizationWindow />
    <AlertsWindow />

    <!-- 图层详细信息面板(右下角) -->
    <LayerDetailPanel />

    <!-- 巡园漫游控制条(底部居中，巡航时显示) -->
    <CruiseControlBar />
  </div>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useOrchardStore } from '@/stores/orchard'
import TopMenuBar from '@/layout/TopMenuBar.vue'
import LeftSidebar from '@/layout/LeftSidebar.vue'
import GISLayer from '@/components/cesium/GISLayer.vue'
import DynamicLayerRenderer from '@/components/cesium/DynamicLayerRenderer.vue'
import HistoricalTreeLayer from '@/components/cesium/HistoricalTreeLayer.vue'
import AlertsLayer from '@/components/cesium/AlertsLayer.vue'
import LayerControl from '@/components/business/LayerControl.vue'
import { useLayerStore } from '@/stores/layers'
import { useCruiseStore } from '@/stores/cruise'
import QueryPanel from '@/components/orchard/QueryPanel.vue'
import QueryResultPanel from '@/components/orchard/QueryResultPanel.vue'
import DetailPanel from '@/components/orchard/DetailPanel.vue'
import AnalysisResultWindow from '@/components/orchard/AnalysisResultWindow.vue'
import FertilizationWindow from '@/components/orchard/FertilizationWindow.vue'
import AlertsWindow from '@/components/orchard/AlertsWindow.vue'
import LayerDetailPanel from '@/components/orchard/LayerDetailPanel.vue'
import OrchardChartDialog from '@/components/charts/OrchardChartDialog.vue'
import CruiseControlBar from '@/components/cesium/CruiseControlBar.vue'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const orchardStore = useOrchardStore()
const layerStore = useLayerStore()
const cruiseStore = useCruiseStore()

// ── 右上角功能面板互斥:打开一个关闭上一个 ──
// 三个"功能"槽:图层管理 / 查询(查询条件+查询结果同属一个功能) / 冠层图表。
// 任一功能打开时,自动关闭其余两个,避免右上角多开叠加。
watch(
  [
    () => layerStore.showManager,
    () => orchardStore.showQueryPanel || orchardStore.showResultPanel,
    () => orchardStore.showChartDialog,
  ],
  ([lm, query, chart], [prevLm, prevQuery, prevChart]) => {
    // 图层管理打开 → 关闭查询与图表
    if (lm && !prevLm) {
      orchardStore.closeAllPanels()
      orchardStore.showChartDialog = false
      return
    }
    // 查询(条件或结果)打开 → 关闭图层管理与图表
    if (query && !prevQuery) {
      layerStore.showManager = false
      orchardStore.showChartDialog = false
      return
    }
    // 冠层图表打开 → 关闭图层管理与查询
    if (chart && !prevChart) {
      layerStore.showManager = false
      orchardStore.closeAllPanels()
    }
  }
)

// ── 果树 POI 地图标记 ──
let treeEntities: any[] = []
let treeClickHandler: any = null
const TREE_ENTITY_ID = '_orchard_tree_group'

function clearTreeMarkers() {
  const viewer = cesiumStore.viewer
  if (!viewer) return
  treeEntities.forEach((e) => viewer.entities.remove(e))
  treeEntities = []
}

function destroyTreeClickHandler() {
  if (treeClickHandler) {
    treeClickHandler.destroy()
    treeClickHandler = null
  }
}

function setupTreeClickHandler() {
  destroyTreeClickHandler()
  if (treeEntities.length === 0) return

  const viewer = cesiumStore.viewer
  if (!viewer) return

  treeClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  treeClickHandler.setInputAction((click: any) => {
    const pickedObject = viewer.scene.pick(click.position)
    if (!pickedObject?.id?.id) return

    const entityId: string = pickedObject.id.id
    if (entityId.startsWith(TREE_ENTITY_ID)) {
      const index = parseInt(entityId.replace(TREE_ENTITY_ID + '_', ''), 10)
      const pois = orchardStore.tsomQueryResult?.pois
      const poi = pois?.[index]
      if (poi) {
        orchardStore.openDetailPanel(poi)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function renderTreeMarkers() {
  clearTreeMarkers()

  const viewer = cesiumStore.viewer
  const result = orchardStore.tsomQueryResult
  if (!viewer || !result?.pois?.length) {
    destroyTreeClickHandler()
    return
  }

  const pois = result.pois
  pois.forEach((poi, index) => {
    let color: any
    switch (poi.healthStatus) {
      case 'healthy':  color = Cesium.Color.LIME; break
      case 'warning':  color = Cesium.Color.YELLOW; break
      case 'critical': color = Cesium.Color.RED; break
      default:         color = Cesium.Color.CYAN
    }

    const entity = viewer.entities.add({
      id: `${TREE_ENTITY_ID}_${index}`,
      // 地表是 DEM 地形(~185m),点必须吸附地表,否则会悬空在地底
      position: Cesium.Cartesian3.fromDegrees(poi.longitude, poi.latitude, 0),
      point: {
        pixelSize: 10,
        color: color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    treeEntities.push(entity)
  })

  setupTreeClickHandler()
}

// 监听查询结果变化 → 渲染地图标记
watch(
  () => orchardStore.tsomQueryResult,
  (result) => {
    if (result?.pois?.length) {
      renderTreeMarkers()
    } else {
      clearTreeMarkers()
      destroyTreeClickHandler()
    }
  },
  { deep: true },
)

onUnmounted(() => {
  clearTreeMarkers()
  destroyTreeClickHandler()
  // 布局销毁时结束巡航，防止 onTick 监听泄漏
  cruiseStore.exit()
})
</script>

<style scoped lang="scss">
.main-layout {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.ui-layer {
  position: absolute;
  top: 50px;
  left: 0;
  width: 100%;
  height: calc(100% - 50px);
  z-index: $z-layer-2;
  pointer-events: none;
}

.layer-manager {
  position: relative;
  width: 340px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  z-index: $z-layer-4;
  pointer-events: auto;
}

/* 右上角功能面板容器:三个面板纵向排开,不再叠在同一点 */
.right-dock {
  position: absolute;
  top: 80px;
  right: 24px;
  z-index: $z-layer-6;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  pointer-events: none;

  /* 面板根节点在容器内保持自身宽度,超高时滚动而不是被压缩 */
  > :deep(*) {
    flex-shrink: 0;
  }

  /* 互斥切换时:退出的面板脱离 flex 流(原位绝对定位淡出),避免把新进入的面板
     往下挤,造成"先出现在下面、动画结束后又跳到上面"的跳动 */
  :deep(.slide-right-leave-active) {
    position: absolute;
    top: 0;
    right: 0;
  }
}
</style>
