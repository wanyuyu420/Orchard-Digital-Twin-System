<template>
	<slot></slot>
</template>

<script setup lang="ts">
/**
 * GenericPointLayer - Data-driven point layer renderer
 * Replaces hardcoded StationLayer/VideoLayer with configuration-based rendering
 */
import { watch, onUnmounted, ref } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useLayerStore, type GISLayer } from '@/stores/layers'
import { apiClient } from '@/api/client'

declare const Cesium: any

const props = defineProps<{
	layer: GISLayer
}>()

const cesiumStore = useCesiumStore()
const layerStore = useLayerStore()

const entities = ref<any[]>([])
const isLoading = ref(false)

// Watch for layer activation
watch(
	() => layerStore.isLayerActive(props.layer.id),
	(active) => {
		if (active) {
			loadPoints()
		} else {
			removePoints()
		}
	},
	{ immediate: true }
)

// Watch for viewer readiness
watch(
	() => cesiumStore.viewer,
	(viewer) => {
		if (viewer && layerStore.isLayerActive(props.layer.id)) {
			loadPoints()
		}
	}
)

async function loadPoints() {
	const viewer = cesiumStore.viewer
	if (!viewer || !props.layer.url) return

	// Prevent duplicate loading
	if (entities.value.length > 0 || isLoading.value) return

	const config = props.layer.config || {}
	const mapping = config.mapping || { lng: 'lng', lat: 'lat', id: 'id', name: 'name' }
	const pointStyle = config.pointStyle || { color: '#00BFFF', pixelSize: 10 }

	try {
		isLoading.value = true

		// Build request params
		const params = config.requestParams || {}
		const response = await apiClient.get(props.layer.url, { params })

		// Extract data (support responseKey for paginated responses)
		let data = response.data
		if (config.responseKey && data[config.responseKey]) {
			data = data[config.responseKey]
		}

		if (!Array.isArray(data)) {
			console.warn(`[GenericPointLayer] Expected array, got:`, typeof data)
			return
		}

		// Track bounds for flyTo
		let sumLng = 0, sumLat = 0, count = 0

		data.forEach((item: any) => {
			const lng = item[mapping.lng]
			const lat = item[mapping.lat]
			if (lng == null || lat == null) return

			sumLng += lng
			sumLat += lat
			count++

			const position = Cesium.Cartesian3.fromDegrees(lng, lat)
			const labelText = config.labelField ? item[config.labelField] : item[mapping.name]

			const entity = viewer.entities.add({
				name: labelText || `Point ${item[mapping.id]}`,
				position,
				point: {
					pixelSize: pointStyle.pixelSize || 10,
					color: Cesium.Color.fromCssColorString(pointStyle.color || '#00BFFF'),
					outlineColor: Cesium.Color.WHITE,
					outlineWidth: 2,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				label: {
					text: labelText || '',
					font: '14px sans-serif',
					fillColor: Cesium.Color.WHITE,
					outlineColor: Cesium.Color.BLACK,
					outlineWidth: 2,
					style: Cesium.LabelStyle.FILL_AND_OUTLINE,
					pixelOffset: new Cesium.Cartesian2(0, -20),
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000),
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				properties: {
					layerCode: props.layer.code,
					...item
				}
			})

			entities.value.push(entity)
		})

		// Fly to center if configured
		if (config.autoFlyTo && count > 0) {
			const center = Cesium.Cartesian3.fromDegrees(sumLng / count, sumLat / count, 8000)
			viewer.camera.flyTo({
				destination: center,
				duration: 1.5
			})
		}

		console.log(`[GenericPointLayer] Loaded ${count} points for layer: ${props.layer.code}`)
	} catch (e) {
		console.error(`[GenericPointLayer] Failed to load ${props.layer.code}:`, e)
	} finally {
		isLoading.value = false
	}
}

function removePoints() {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	entities.value.forEach((entity) => {
		viewer.entities.remove(entity)
	})
	entities.value = []
}

onUnmounted(() => {
	removePoints()
})
</script>
