<template>
	<slot></slot>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import api from '@/api/client'

// Interfaces
interface Station {
	id: number
	station_code: string
	station_name: string
	lng?: number
	lat?: number
	latest_water_level?: number
	latest_flow_rate?: number
	is_simulated: boolean
}

const cesiumStore = useCesiumStore()
let stationEntities: any[] = []

declare const Cesium: any

// Watch for visibility changes
watch(
	() => cesiumStore.stationsEnabled,
	(enabled) => {
		if (enabled) {
			loadStations()
		} else {
			removeStations()
		}
	},
	{ immediate: true }
)

// Watch for viewer readiness
watch(
	() => cesiumStore.viewer,
	(viewer) => {
		if (viewer && cesiumStore.stationsEnabled) {
			loadStations()
		}
	}
)

async function loadStations() {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	// Prevent duplicate loading
	if (stationEntities.length > 0 || cesiumStore.stationsLoading) return

	try {
		cesiumStore.stationsLoading = true
		const response = await api.getHydrologicalStations()
		const stations = response.data as Station[]

		if (!stations) return

		stations.forEach((station: any) => {
			if (!station.lng || !station.lat) return

			const position = Cesium.Cartesian3.fromDegrees(station.lng, station.lat)

			const entity = viewer.entities.add({
				name: station.station_name,
				position,
				billboard: {
					image: '/images/icons/station_water.png', // Assuming icon exists or I'll use a placeholder or pin
					// Use generic pin if no image
					// image: new Cesium.PinBuilder().fromColor(Cesium.Color.ROYALBLUE, 48).toDataURL(),
					// For now, let's use a simple point since I don't know asset paths, or try a standard pin.
					// Actually, using a PointGraphics is safer if no assets.
					scale: 1.0,
					verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
				},
				point: {
					pixelSize: 10,
					color: Cesium.Color.fromCssColorString('#00BFFF'),
					outlineColor: Cesium.Color.WHITE,
					outlineWidth: 2,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
				},
				label: {
					text: station.station_name,
					font: '14px sans-serif',
					fillColor: Cesium.Color.WHITE,
					outlineColor: Cesium.Color.BLACK,
					outlineWidth: 2,
					style: Cesium.LabelStyle.FILL_AND_OUTLINE,
					pixelOffset: new Cesium.Cartesian2(0, -20), // Above point
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000)
				},
				properties: {
					type: 'station',
					...station
				}
			})
			stationEntities.push(entity)
		})

		// Fly to average position
		if (stations.length > 0) {
			let sumLng = 0
			let sumLat = 0
			let count = 0
			stations.forEach(s => {
				if (s.lng && s.lat) {
					sumLng += s.lng
					sumLat += s.lat
					count++
				}
			})
			if (count > 0) {
				const center = Cesium.Cartesian3.fromDegrees(sumLng / count, sumLat / count, 2000)
				viewer.camera.flyTo({
					destination: center,
					duration: 1.5
				})
			}
		}

		// TEMPORARY: I will wait to write this file until I fix the backend.
	} catch (e) {
		console.error('Failed to load stations:', e)
	} finally {
		cesiumStore.stationsLoading = false
	}
}

function removeStations() {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	stationEntities.forEach((entity) => {
		viewer.entities.remove(entity)
	})
	stationEntities = []
}

onUnmounted(() => {
	removeStations()
})
</script>
