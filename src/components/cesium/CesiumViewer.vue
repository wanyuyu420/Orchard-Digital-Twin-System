<template>
	<div id="cesiumContainer" class="cesium-container"
		:class="{ 'is-blurred': viewMode === 'focus' }"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useAppStore } from '@/stores/app'
import { GController } from '@/utils/ctrlCesium/Controller'
import { getBaseMapConfig, getBaseMapImageryList } from '@/mock/baseMapData'
import { setupOrchardPreviewBasemap } from '@/utils/orchardPreview'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const appStore = useAppStore()

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
