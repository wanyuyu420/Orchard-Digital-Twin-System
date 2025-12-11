import { defineStore } from 'pinia'
import { shallowRef, ref } from 'vue'
import { GController } from '@/utils/ctrlCesium/Controller'

declare const Cesium: any

// Default view for the project (Xinjiang area)
const DEFAULT_VIEW = {
  lon: 87.57,
  lat: 43.82,
  height: 80000
}

export const useCesiumStore = defineStore('cesium', () => {
  const viewer = shallowRef<any>(null)
  const is2D = ref(false)
  const terrainEnabled = ref(false)
  const terrainLoading = ref(false)

  // Store the last 3D camera position and orientation before switching to 2D
  const savedCameraState = ref<{
    lon: number
    lat: number
    height: number
    heading: number
    pitch: number
    roll: number
  } | null>(null)

  function setViewer(v: any) {
    viewer.value = v
  }

  function toggle2D3D(mode2D: boolean) {
    if (!viewer.value) return

    if (mode2D && !is2D.value) {
      // Switching to 2D - save current camera position and orientation
      try {
        const camera = viewer.value.camera
        const cartographic = camera.positionCartographic
        savedCameraState.value = {
          lon: Cesium.Math.toDegrees(cartographic.longitude),
          lat: Cesium.Math.toDegrees(cartographic.latitude),
          height: cartographic.height,
          heading: camera.heading,
          pitch: camera.pitch,
          roll: camera.roll
        }
      } catch (e) {
        console.warn('Failed to save camera state:', e)
      }
      viewer.value.scene.morphTo2D(1)
    } else if (!mode2D && is2D.value) {
      // Switching back to 3D - restore camera position
      viewer.value.scene.morphTo3D(1)

      // Wait for morph to complete, then restore position and orientation
      setTimeout(() => {
        if (savedCameraState.value && viewer.value) {
          const { lon, lat, height, heading, pitch, roll } = savedCameraState.value
          viewer.value.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
            orientation: { heading, pitch, roll },
            duration: 1
          })
        }
      }, 1200)
    }

    is2D.value = mode2D
  }

  function flyTo(lon: number, lat: number, height: number, duration = 2) {
    if (!viewer.value) return
    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration
    })
  }

  function flyToDefault(duration = 2) {
    if (!viewer.value) return
    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(DEFAULT_VIEW.lon, DEFAULT_VIEW.lat, DEFAULT_VIEW.height),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-60),
        roll: 0
      },
      duration
    })
  }

  function zoomIn() {
    if (!viewer.value) return
    const camera = viewer.value.camera
    camera.zoomIn(camera.positionCartographic.height * 0.3)
  }

  function zoomOut() {
    if (!viewer.value) return
    const camera = viewer.value.camera
    camera.zoomOut(camera.positionCartographic.height * 0.3)
  }

  /**
   * Enable 3D terrain
   * Returns a promise that resolves when terrain is loaded
   */
  async function enableTerrain(): Promise<void> {
    if (terrainEnabled.value || terrainLoading.value) return
    terrainLoading.value = true
    try {
      await GController.enableTerrain()
      terrainEnabled.value = GController.isTerrainEnabled()
    } finally {
      terrainLoading.value = false
    }
  }

  /**
   * Disable 3D terrain
   */
  function disableTerrain(): void {
    GController.disableTerrain()
    terrainEnabled.value = false
  }

  /**
   * Toggle terrain state
   */
  async function toggleTerrain(): Promise<void> {
    if (terrainEnabled.value) {
      disableTerrain()
    } else {
      await enableTerrain()
    }
  }

  return {
    viewer,
    is2D,
    terrainEnabled,
    terrainLoading,
    savedCameraState,
    setViewer,
    toggle2D3D,
    flyTo,
    flyToDefault,
    zoomIn,
    zoomOut,
    enableTerrain,
    disableTerrain,
    toggleTerrain,
    DEFAULT_VIEW
  }
})
