<template>
  <div id="cesiumContainer" class="cesium-container"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { GController } from '@/utils/ctrlCesium/Controller'
import { getBaseMapConfig, getBaseMapImageryList, getInitialView } from '@/mock/baseMapData'

declare const Cesium: any

const props = defineProps<{
  enableFlyTo?: boolean
}>()

const emit = defineEmits<{
  (e: 'ready', viewer: any): void
}>()

let viewer: any = null

onMounted(() => {
  // Get configurations
  const baseMapConfig = getBaseMapConfig()
  const imageryList = getBaseMapImageryList()

  // Initialize Cesium viewer
  viewer = GController.init(baseMapConfig, imageryList)

  // Store globally for debugging
  ;(window as any).Gviewer = viewer

  // Fly to initial view
  if (props.enableFlyTo !== false) {
    const view = getInitialView()
    if (view.flytoView) {
      setTimeout(() => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(view.lon, view.lat, view.height),
          orientation: {
            direction: new Cesium.Cartesian3(
              view.direction[0],
              view.direction[1],
              view.direction[2]
            ),
            up: new Cesium.Cartesian3(view.up[0], view.up[1], view.up[2]),
          },
          duration: view.duration,
        })
      }, 100)
    }
  }

  emit('ready', viewer)
})

onUnmounted(() => {
  GController.destroy()
  ;(window as any).Gviewer = null
})

defineExpose({
  viewer: () => viewer,
  flyTo: (lon: number, lat: number, height: number, duration?: number) => {
    GController.flyTo(lon, lat, height, duration)
  },
})
</script>

<style scoped lang="scss">
.cesium-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: auto;
}
</style>
