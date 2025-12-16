import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

declare const Cesium: any

// 天地图 Key 请在 .env 中配置 VITE_TIANDITU_KEY
const TDT_KEY = import.meta.env.VITE_TIANDITU_KEY || 'YOUR_TIANDITU_KEY'

// 默认视角 (新疆区域)
const DEFAULT_CENTER = { lat: 43.82, lon: 87.57 }
const DEFAULT_HEIGHT = 80000

export const useMeteoMapStore = defineStore('meteoMap', () => {
  // 气象页独立的Cesium实例
  const viewer = shallowRef<any>(null)

  // 当前视角状态
  const center = ref({ lat: DEFAULT_CENTER.lat, lon: DEFAULT_CENTER.lon })
  const height = ref(DEFAULT_HEIGHT)

  // 降雨显示模式
  const rainfallMode = ref<'raster' | 'particle'>('raster')

  // 设置Cesium实例
  function setViewer(v: any) {
    viewer.value = v
  }

  // 从主页Cesium同步视角
  function syncFromMainCesium(mainViewer: any) {
    if (!mainViewer || !viewer.value) return

    try {
      const camera = mainViewer.camera
      const cartographic = camera.positionCartographic
      const lon = Cesium.Math.toDegrees(cartographic.longitude)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)
      const h = cartographic.height

      center.value = { lat, lon }
      height.value = h

      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, h),
        orientation: {
          heading: camera.heading,
          pitch: camera.pitch,
          roll: camera.roll,
        },
        duration: 1,
      })
    } catch (e) {
      console.warn('Failed to sync from main Cesium:', e)
    }
  }

  // 重置到默认视角
  function resetView() {
    if (!viewer.value) return

    center.value = { lat: DEFAULT_CENTER.lat, lon: DEFAULT_CENTER.lon }
    height.value = DEFAULT_HEIGHT

    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        DEFAULT_CENTER.lon,
        DEFAULT_CENTER.lat,
        DEFAULT_HEIGHT
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-60),
        roll: 0,
      },
      duration: 1,
    })
  }

  // 设置降雨显示模式
  function setRainfallMode(mode: 'raster' | 'particle') {
    rainfallMode.value = mode
  }

  // 销毁实例
  function destroy() {
    if (viewer.value) {
      viewer.value.destroy()
      viewer.value = null
    }
  }

  return {
    viewer,
    center,
    height,
    rainfallMode,
    setViewer,
    syncFromMainCesium,
    resetView,
    setRainfallMode,
    destroy,
    TDT_KEY,
    DEFAULT_CENTER,
    DEFAULT_HEIGHT,
  }
})
