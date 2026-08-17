<template>
  <!-- 弱树告警红点图层：无 DOM，纯 Cesium 实体 -->
  <div class="alerts-layer" style="display: none"></div>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useOrchardStore } from '@/stores/orchard'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const orchardStore = useOrchardStore()

const PREFIX = '_alert_tree_'

let alertEntities: any[] = []

function clearPoints() {
  const viewer = cesiumStore.viewer
  if (viewer) {
    alertEntities.forEach((e) => viewer.entities.remove(e))
  }
  alertEntities = []
}

function renderPoints() {
  clearPoints()

  const viewer = cesiumStore.viewer
  const alerts = orchardStore.alerts
  if (!viewer || !alerts?.length || !orchardStore.alertsVisible) return

  alerts.forEach((tree) => {
    // 过滤非法坐标（GeoScene 可能返回无几何 feature），Cesium.fromDegrees(null) 会崩
    if (!Number.isFinite(tree.lng) || !Number.isFinite(tree.lat)) return
    const entity = viewer.entities.add({
      id: `${PREFIX}${tree.id}`,
      // 地表是 DEM 地形(~185m)，点必须吸附地表，否则会悬空在地底
      position: Cesium.Cartesian3.fromDegrees(tree.lng, tree.lat, 0),
      point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    alertEntities.push(entity)
  })
}

// 数据 / 显隐变化 → 重渲染
watch(
  () => [orchardStore.alerts, orchardStore.alertsVisible] as const,
  () => renderPoints(),
  { deep: true },
)

onUnmounted(() => {
  clearPoints()
})
</script>
