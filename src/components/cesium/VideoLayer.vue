<template>
	<slot></slot>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import api from '@/api/client'

interface Facility {
	id: number
	code: string
	name: string
	facility_type: string
	lng?: number
	lat?: number
	is_simulated: boolean
}

const cesiumStore = useCesiumStore()
let videoEntities: any[] = []

declare const Cesium: any

watch(
	() => cesiumStore.videoEnabled,
	(enabled) => {
		if (enabled) {
			loadVideos()
		} else {
			removeVideos()
		}
	},
	{ immediate: true }
)

watch(
	() => cesiumStore.viewer,
	(viewer) => {
		if (viewer && cesiumStore.videoEnabled) {
			loadVideos()
		}
	}
)

async function loadVideos() {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	if (videoEntities.length > 0 || cesiumStore.videoLoading) return

	try {
		cesiumStore.videoLoading = true
		// Fetch all facilities. In future we can filter by type via API if we know the exact string.
		const response = await api.getFacilities({ page_size: 100 })
		const facilities = response.data?.items as Facility[]

		if (!facilities) return

		facilities.forEach((fac) => {
			// If no coords, skip
			if (!fac.lng || !fac.lat) return

			const position = Cesium.Cartesian3.fromDegrees(fac.lng, fac.lat)

			const entity = viewer.entities.add({
				name: fac.name,
				position,
				billboard: {
					image: '/images/icons/camera.png', // Needs asset
					scale: 0.8,
					verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
				},
				point: {
					pixelSize: 8,
					color: Cesium.Color.ORANGE,
					outlineColor: Cesium.Color.WHITE,
					outlineWidth: 2,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
				},
				label: {
					text: fac.name,
					font: '12px sans-serif',
					fillColor: Cesium.Color.YELLOW,
					outlineColor: Cesium.Color.BLACK,
					outlineWidth: 2,
					style: Cesium.LabelStyle.FILL_AND_OUTLINE,
					pixelOffset: new Cesium.Cartesian2(0, -20),
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 30000)
				},
				properties: {
					type: 'video',
					...fac
				}
			})
			videoEntities.push(entity)
		})

		// Fly to average position
		if (facilities.length > 0) {
			let sumLng = 0
			let sumLat = 0
			let count = 0
			facilities.forEach(f => {
				if (f.lng && f.lat) {
					sumLng += f.lng
					sumLat += f.lat
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

	} catch (e) {
		console.error('Failed to load video points:', e)
	} finally {
		cesiumStore.videoLoading = false
	}
}

function removeVideos() {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	videoEntities.forEach((entity) => {
		viewer.entities.remove(entity)
	})
	videoEntities = []
}

onUnmounted(() => {
	removeVideos()
})
</script>
