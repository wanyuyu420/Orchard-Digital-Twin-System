<template>
	<slot></slot>
</template>

<script setup lang="ts">
/**
 * GenericImageryLayer - Data-driven imagery layer renderer
 * Handles DOM, WMS, TMS and other imagery datasets based on config
 */
import { watch, onUnmounted, shallowRef } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useLayerStore, type GISLayer } from '@/stores/layers'

declare const Cesium: any

const props = defineProps<{
	layer: GISLayer
}>()

const cesiumStore = useCesiumStore()
const layerStore = useLayerStore()

const imageryLayer = shallowRef<any>(null)

// Watch for layer activation
watch(
	() => layerStore.isLayerActive(props.layer.id),
	(active) => {
		if (active) {
			loadImagery()
		} else {
			removeImagery()
		}
	},
	{ immediate: true }
)

// Watch for viewer readiness
watch(
	() => cesiumStore.viewer,
	(viewer) => {
		if (viewer && layerStore.isLayerActive(props.layer.id) && !imageryLayer.value) {
			loadImagery()
		}
	}
)

function loadImagery() {
	const viewer = cesiumStore.viewer
	const config = props.layer.config || {}

	// Must have either URL or built-in provider
	const hasUrl = !!props.layer.url
	const hasBuiltinProvider = ['bing_aerial', 'openstreetmap', 'arcgis'].includes(config.provider)

	if (!viewer || (!hasUrl && !hasBuiltinProvider) || imageryLayer.value) return

	try {
		let provider: any

		// Built-in providers (no URL required)
		if (config.provider === 'bing_aerial') {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} using Bing Maps Aerial`)
			provider = new Cesium.BingMapsImageryProvider({
				url: 'https://dev.virtualearth.net',
				key: Cesium.BingMapsApi.defaultKey,
				mapStyle: Cesium.BingMapsStyle.AERIAL,
			})
		}
		else if (config.provider === 'openstreetmap') {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} using OpenStreetMap`)
			provider = new Cesium.OpenStreetMapImageryProvider({
				url: 'https://tile.openstreetmap.org/',
			})
		}
		else if (config.provider === 'arcgis') {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} using ArcGIS World Imagery`)
			provider = new Cesium.ArcGisMapServerImageryProvider({
				url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
			})
		}
		// TMS (DOM) style
		else if (config.provider === 'tms' || config.urlTemplate) {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} from ${props.layer.url}`)
			const bounds = config.bounds || {}
			provider = new Cesium.UrlTemplateImageryProvider({
				url: config.urlTemplate || props.layer.url,
				rectangle: bounds.west ? Cesium.Rectangle.fromDegrees(
					bounds.west, bounds.south, bounds.east, bounds.north
				) : undefined,
				minimumLevel: config.minimumLevel || 0,
				maximumLevel: config.maximumLevel || 18,
				credit: props.layer.name,
			})
		}
		// WMS style
		else if (config.provider === 'wms') {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} from ${props.layer.url}`)
			provider = new Cesium.WebMapServiceImageryProvider({
				url: props.layer.url,
				layers: config.layers || '',
				parameters: config.parameters || {},
			})
		}
		// Default: URL template
		else if (props.layer.url) {
			console.log(`[GenericImageryLayer] Loading ${props.layer.code} from ${props.layer.url}`)
			provider = new Cesium.UrlTemplateImageryProvider({
				url: props.layer.url,
				maximumLevel: config.maximumLevel || 18,
			})
		}
		else {
			console.warn(`[GenericImageryLayer] No valid provider for ${props.layer.code}`)
			return
		}

		// Add to viewer
		imageryLayer.value = viewer.imageryLayers.addImageryProvider(provider)

		// Apply transparency if configured
		if (config.alpha !== undefined) {
			imageryLayer.value.alpha = config.alpha
		}

		// Apply color-to-alpha (for white background)
		if (config.colorToAlpha) {
			imageryLayer.value.colorToAlpha = Cesium.Color.fromCssColorString(config.colorToAlpha)
			imageryLayer.value.colorToAlphaThreshold = config.colorToAlphaThreshold || 0.1
		}

		// Fly to bounds if configured
		if (config.autoFlyTo && config.bounds) {
			const { west, south, east, north } = config.bounds
			const centerLng = (west + east) / 2
			const centerLat = (south + north) / 2
			viewer.camera.flyTo({
				destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, config.flyToHeight || 2000),
				duration: 2,
			})
		}

		console.log(`[GenericImageryLayer] ${props.layer.code} loaded successfully`)
	} catch (e) {
		console.error(`[GenericImageryLayer] Failed to load ${props.layer.code}:`, e)
	}
}

function removeImagery() {
	const viewer = cesiumStore.viewer
	if (!viewer || !imageryLayer.value) return

	viewer.imageryLayers.remove(imageryLayer.value)
	imageryLayer.value = null
	console.log(`[GenericImageryLayer] ${props.layer.code} removed`)
}

onUnmounted(() => {
	removeImagery()
})
</script>
