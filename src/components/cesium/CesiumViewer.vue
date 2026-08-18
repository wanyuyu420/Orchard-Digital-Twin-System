<template>
	<div id="cesiumContainer" class="cesium-container"
		:class="{ 'is-blurred': viewMode === 'focus' }"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, watch } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useAppStore } from '@/stores/app'
import { useOrchardStore } from '@/stores/orchard'
import { GController } from '@/utils/ctrlCesium/Controller'
import { getBaseMapConfig, getBaseMapImageryList } from '@/mock/baseMapData'
import { setupOrchardPreviewBasemap, applyDemTerrain } from '@/utils/orchardPreview'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const appStore = useAppStore()
const orchardStore = useOrchardStore()

const viewMode = computed(() => appStore.viewMode)

onMounted(async () => {
	// Get configurations
	const baseMapConfig = getBaseMapConfig()
	const imageryList = getBaseMapImageryList()

	// Initialize Cesium viewer
	const viewer = GController.init(baseMapConfig, imageryList)

	// Store viewer in store and globally
	cesiumStore.setViewer(viewer)
		; (window as any).Gviewer = viewer

	// Terrain is NOT loaded — the orchard GLB model provides its own terrain mesh
	// Cesium World Terrain would conflict with the model's built-in terrain

	// 对齐果园预览:关闭太阳光照,顶点色全亮(预览默认 enableLighting=false)
	viewer.scene.globe.enableLighting = false

	// Set initial view directly (no fly animation for faster startup)
	const { lon, lat, height, heading, pitch, roll } = cesiumStore.defaultView
	viewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(pitch),
			roll: Cesium.Math.toRadians(roll),
		},
	})

	// 对齐果园预览:高德卫星 + DOM 无人机影像 + DEM 地形(async, non-blocking)
	setupOrchardPreviewBasemap(viewer)

	// 监听"回到地1"信号，重新加载 DOM + DEM（切地2 后回来）
	watch(
		() => cesiumStore.plot1ReloadSignal,
		() => {
			if (cesiumStore.viewer && cesiumStore.plot1ReloadSignal > 0) {
				// 用 setTimeout(0) 确保在 UploadPlotLayer 的 dispose（移除底图）之后执行
				setTimeout(() => {
					setupOrchardPreviewBasemap(cesiumStore.viewer)
				}, 0)
			}
		}
	)

	// 监听"显示原地块"开关（plot1Visible）：
	//  on → 恢复地1 DOM 影像显隐 + 恢复地1 DEM 地形（地2 叠加仍在，只是地形切回地1 基准）
	//  off → 由 UploadPlotLayer 切到地2 的 DEM 地形，这里只隐藏 DOM1
	watch(
		() => orchardStore.plot1Visible,
		(v) => {
			const dom1 = (window as any).__dom1Layer
			if (dom1) dom1.show = !!v
			if (v && cesiumStore.viewer) {
				applyDemTerrain(cesiumStore.viewer)
			}
		}
	)
})

onUnmounted(() => {
	GController.destroy()
		; (window as any).Gviewer = null
})
</script>

<style scoped>
.cesium-container {
	width: 100%;
	height: 100%;
	position: absolute;
	top: 0;
	left: 0;
	z-index: 0;
	background: radial-gradient(circle at center, #1e293b 0%, #020617 100%);
	pointer-events: auto;
}

.cesium-container.is-blurred {
	filter: blur(2px);
}
</style>
