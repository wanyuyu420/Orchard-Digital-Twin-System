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
  longitude: 116.5,
  latitude: 27.13,
  height: 187,
  rotationX: 0,   // 模型内部变换已经处理了朝向，不需额外旋转
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

    viewer.flyTo(loadedTileset, { duration: 2 })
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
})
</script>
