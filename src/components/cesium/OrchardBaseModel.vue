<template>
  <slot></slot>
</template>

<script setup lang="ts">
/**
 * OrchardBaseModel - Loads the orchard GLB as a 3D Tileset.
 *
 * Uses Cesium3DTileset so the model renders in the 3D Tiles render pass,
 * which is BEFORE entities (draw tools, measure tools) and ground entities.
 * This ensures drawing/measurement overlays appear on top of the model.
 */
import { watch, onUnmounted, ref } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { BIMAlignment } from '@/cesium/gis/tools/BIMAlignment'

declare const Cesium: any

const cesiumStore = useCesiumStore()

const isLoading = ref(false)
let tileset: any = null

const ORCHARD_POSITION = {
  longitude: 116.497314,
  latitude: 27.132186,
  height: 187,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
}

watch(
  () => cesiumStore.viewer,
  (viewer) => {
    if (viewer && !tileset && !isLoading.value) {
      loadModel()
    }
  },
  { immediate: true }
)

async function loadModel() {
  const viewer = cesiumStore.viewer
  if (!viewer || isLoading.value) return

  isLoading.value = true
  console.log('[OrchardBaseModel] Loading orchard 3D Tileset...')

  try {
    const loadedTileset = await Cesium.Cesium3DTileset.fromUrl(
      '/models/orchard/tileset.json',
      {
        maximumScreenSpaceError: 16,
        maximumMemoryUsage: 512,
      }
    )

    viewer.scene.primitives.add(loadedTileset)
    tileset = loadedTileset

    // Position at WGS84 coordinates via BIMAlignment
    BIMAlignment.applyToTileset(loadedTileset, ORCHARD_POSITION)

    // Expose for console calibration
    ;(window as any).__orchardTileset = loadedTileset
    ;(window as any).__BIMAlignment = BIMAlignment
    ;(window as any).__orchardPos = { ...ORCHARD_POSITION }

    console.log('[OrchardBaseModel] Tileset loaded.')
    console.log('[OrchardBaseModel] Adjust position/rotation in console:')
    console.log('  window.__orchardPos.longitude = XXX')
    console.log('  window.__orchardPos.latitude = XXX')
    console.log('  window.__orchardPos.rotationX = XXX')
    console.log('  window.__orchardTileset.modelMatrix = BIMAlignment.createModelMatrix(window.__orchardPos)')

    viewer.flyTo(loadedTileset, { duration: 2 }).then(() => {
      // 飞行完成后保存相机位置，作为"回到初始视角"的目标
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
          console.log('[OrchardBaseModel] Home view saved')
        } catch (e) {
          console.warn('[OrchardBaseModel] Failed to save home view:', e)
        }
      }, 500) // 等飞行完全结束再保存
    })
  } catch (e) {
    console.error('[OrchardBaseModel] Failed:', e)
  } finally {
    isLoading.value = false
  }
}

onUnmounted(() => {
  if (tileset) {
    const viewer = cesiumStore.viewer
    if (viewer) {
      try {
        viewer.scene.primitives.remove(tileset)
        tileset.destroy()
      } catch (e) { /* ignore */ }
    }
    tileset = null
  }
  delete (window as any).__orchardTileset
  delete (window as any).__BIMAlignment
  delete (window as any).__orchardPos
})
</script>
