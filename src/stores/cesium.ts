import { defineStore } from 'pinia'
import { shallowRef, ref } from 'vue'
import { GController } from '@/utils/ctrlCesium/Controller'

declare const Cesium: any

import { defaultView } from '@/config/view'

export const useCesiumStore = defineStore('cesium', () => {
  // ... (state definitions remain same)
  const viewer = shallowRef<any>(null)
  /* Layer Visibility State */
  const is2D = ref(false)
  const terrainEnabled = ref(false)
  const terrainLoading = ref(false)
  // OSGB 3D Tiles state
  const osgbEnabled = ref(false)
  const osgbLoading = ref(false)
  // BIM 3D Tiles state
  const bimEnabled = ref(false)
  const bimLoading = ref(false)
  const stationsEnabled = ref(false)
  const stationsLoading = ref(false)
  const videoEnabled = ref(false)
  const videoLoading = ref(false)

  // Store the last 3D camera position and orientation before switching to 2D
  const savedCameraState = ref<{
    lon: number
    lat: number
    height: number
    heading: number
    pitch: number
    roll: number
  } | null>(null)

  // Saved "home" view after model loads (for "回到初始视角")
  const homeView = ref<{
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

  function setHomeView(view: typeof homeView.value) {
    homeView.value = view
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
          roll: camera.roll,
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
            duration: 1,
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
      duration,
    })
  }

  function flyToDefault(duration = 2) {
    if (!viewer.value) {
      console.warn('[cesiumStore] viewer not ready, cannot fly to default')
      return
    }
    try {
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          defaultView.lon,
          defaultView.lat,
          defaultView.height,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(defaultView.heading),
          pitch: Cesium.Math.toRadians(defaultView.pitch),
          roll: Cesium.Math.toRadians(defaultView.roll),
        },
        duration,
      })
    } catch (e) {
      console.warn('[cesiumStore] flyToDefault failed, fallback to setView:', e)
      // fallback: instant jump if flyTo fails
      try {
        viewer.value.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            defaultView.lon,
            defaultView.lat,
            defaultView.height,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(defaultView.heading),
            pitch: Cesium.Math.toRadians(defaultView.pitch),
            roll: Cesium.Math.toRadians(defaultView.roll),
          },
        })
      } catch (e2) {
        console.error('[cesiumStore] setView fallback also failed:', e2)
      }
    }
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
   * Zoom to the home/default view
   * Uses the saved home view (from model initial flyTo) if available,
   * otherwise falls back to defaultView config.
   */
  function zoomToHome(duration = 1.5) {
    if (!viewer.value) return
    if (homeView.value) {
      try {
        viewer.value.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            homeView.value.lon,
            homeView.value.lat,
            homeView.value.height,
          ),
          orientation: {
            heading: homeView.value.heading,
            pitch: homeView.value.pitch,
            roll: homeView.value.roll,
          },
          duration,
        })
        return
      } catch (e) {
        console.warn('[cesiumStore] zoomToHome (homeView) failed, fallback to defaultView:', e)
      }
    }
    flyToDefault(duration)
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
    // State
    viewer,
    is2D,
    terrainEnabled,
    terrainLoading,
    osgbEnabled,
    osgbLoading,
    bimEnabled,
    bimLoading,
    stationsEnabled,
    stationsLoading,
    videoEnabled,
    videoLoading,
    savedCameraState,
    homeView,
    setViewer,
    setHomeView,
    toggle2D3D,
    flyTo,
    flyToDefault,
    zoomIn,
    zoomOut,
    zoomToHome,
    enableTerrain,
    disableTerrain,
    toggleTerrain,
    defaultView,
  }
})
