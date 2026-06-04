<template>
	<div id="cesiumContainer" class="cesium-container"
		:class="{ 'is-blurred': viewMode === 'focus', 'is-hidden': isMeteoPage }"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useAppStore } from '@/stores/app'
import { GController } from '@/utils/ctrlCesium/Controller'
import { getBaseMapConfig, getBaseMapImageryList } from '@/mock/baseMapData'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const appStore = useAppStore()

const viewMode = computed(() => appStore.viewMode)
const isMeteoPage = computed(() => appStore.currentModule === 'meteo')

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

	// Enable lighting for 3D model appearance
	viewer.scene.globe.enableLighting = true

	// Set initial view directly (no fly animation for faster startup)
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

/* 气象页面时隐藏主Cesium，让MeteoSplitLayer的Cesium接收事件 */
.cesium-container.is-hidden {
	visibility: hidden;
	pointer-events: none;
}
</style>
