<template>
  <!-- 历史老树拾取点图层：无 DOM，纯 Cesium 实体 -->
  <div class="historical-tree-layer" style="display: none"></div>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useOrchardStore } from '@/stores/orchard'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const orchardStore = useOrchardStore()

const PREFIX = '_historical_tree_group_'

let treeEntities: any[] = []
let clickHandler: any = null
let loaded = false

function healthColor(status: string): any {
  switch (status) {
    case 'healthy': return Cesium.Color.LIME
    case 'warning': return Cesium.Color.YELLOW
    case 'critical': return Cesium.Color.RED
    default: return Cesium.Color.CYAN
  }
}

function clearPoints() {
  const viewer = cesiumStore.viewer
  if (viewer) {
    treeEntities.forEach((e) => viewer.entities.remove(e))
  }
  treeEntities = []
}

function destroyClickHandler() {
  if (clickHandler) {
    clickHandler.destroy()
    clickHandler = null
  }
}

function setupClickHandler() {
  destroyClickHandler()
  if (treeEntities.length === 0) return

  const viewer = cesiumStore.viewer
  if (!viewer) return

  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  clickHandler.setInputAction((click: any) => {
    const pickedObject = viewer.scene.pick(click.position)
    if (!pickedObject?.id?.id) return

    const entityId: string = pickedObject.id.id
    if (entityId.startsWith(PREFIX)) {
      const index = parseInt(entityId.replace(PREFIX, ''), 10)
      const pois = orchardStore.historicalTreePois
      const poi = pois?.[index]
      if (poi) {
        orchardStore.openDetailPanel(poi)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function renderPoints() {
  clearPoints()

  const viewer = cesiumStore.viewer
  const pois = orchardStore.historicalTreePois
  if (!viewer || !pois?.length || !orchardStore.historicalTreesVisible) {
    destroyClickHandler()
    return
  }

  pois.forEach((poi, index) => {
    const entity = viewer.entities.add({
      id: `${PREFIX}${index}`,
      // 地表是 DEM 地形(~185m),点必须吸附地表,否则会悬空在地底
      position: Cesium.Cartesian3.fromDegrees(poi.longitude, poi.latitude, 0),
      point: {
        pixelSize: 8,
        color: healthColor(poi.healthStatus),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    treeEntities.push(entity)
  })

  setupClickHandler()
}

// viewer 就绪后加载一次历史老树
watch(
  () => cesiumStore.viewer,
  (viewer) => {
    if (viewer && !loaded) {
      loaded = true
      orchardStore.fetchHistoricalTrees()
    }
  },
)

// 数据 / 显隐变化 → 重渲染
watch(
  () => [orchardStore.historicalTreePois, orchardStore.historicalTreesVisible] as const,
  () => renderPoints(),
  { deep: true },
)

onUnmounted(() => {
  clearPoints()
  destroyClickHandler()
})
</script>
