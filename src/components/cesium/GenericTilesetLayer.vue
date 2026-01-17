<template>
	<slot></slot>
</template>

<script setup lang="ts">
/**
 * GenericTilesetLayer - Data-driven 3D Tiles layer renderer
 * Handles OSGB, BIM, and other 3D Tiles datasets based on config
 */
import { watch, onUnmounted, ref, shallowRef } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useLayerStore, type GISLayer } from '@/stores/layers'
import { BIMAlignment } from '@/cesium/gis/tools/BIMAlignment'

declare const Cesium: any

const props = defineProps<{
	layer: GISLayer
}>()

const cesiumStore = useCesiumStore()
const layerStore = useLayerStore()

const tileset = shallowRef<any>(null)
const isLoading = ref(false)

// Watch for layer activation
watch(
	() => layerStore.isLayerActive(props.layer.id),
	(active) => {
		if (active) {
			loadTileset()
		} else {
			removeTileset()
		}
	},
	{ immediate: true }
)

// Watch for viewer readiness
watch(
	() => cesiumStore.viewer,
	(viewer) => {
		if (viewer && layerStore.isLayerActive(props.layer.id) && !tileset.value) {
			loadTileset()
		}
	}
)

// Watch for terrain changes to re-ground OSGB
watch(
	() => cesiumStore.terrainEnabled,
	async () => {
		if (tileset.value && props.layer.config?.ellipsoidOffset !== undefined) {
			await applyOSGBGrounding()
		}
	}
)

async function loadTileset() {
	const viewer = cesiumStore.viewer
	const config = props.layer.config || {}

	// Must have either URL or Ion assetId
	const hasUrl = !!props.layer.url
	const hasIonAsset = config.provider === 'ion' && config.assetId

	if (!viewer || (!hasUrl && !hasIonAsset) || tileset.value || isLoading.value) return

	try {
		isLoading.value = true

		let loadedTileset: any

		if (hasIonAsset) {
			// Load from Cesium Ion asset
			console.log(`[GenericTilesetLayer] Loading ${props.layer.code} from Ion asset ${config.assetId}`)
			loadedTileset = await Cesium.Cesium3DTileset.fromIonAssetId(config.assetId, {
				maximumScreenSpaceError: 16,
			})
		} else {
			// Load from URL
			console.log(`[GenericTilesetLayer] Loading ${props.layer.code} from ${props.layer.url}`)
			loadedTileset = await Cesium.Cesium3DTileset.fromUrl(props.layer.url, {
				maximumScreenSpaceError: 16,
				maximumMemoryUsage: 512,
				skipLevelOfDetail: true,
				baseScreenSpaceError: 1024,
				skipScreenSpaceErrorFactor: 16,
				skipLevels: 1,
			})
		}

		// Apply alignment if specified (for BIM models)
		if (config.alignment) {
			BIMAlignment.applyToTileset(loadedTileset, config.alignment)
		}

		// Add to scene
		viewer.scene.primitives.add(loadedTileset)
		tileset.value = loadedTileset

		// Apply grounding for OSGB (has ellipsoidOffset/terrainOffset)
		if (config.ellipsoidOffset !== undefined || config.terrainOffset !== undefined) {
			await applyOSGBGrounding()
		}
		// Apply conservative grounding for BIM
		else if (config.alignment) {
			await BIMAlignment.autoGroundConservative(loadedTileset, viewer)
		}

		// Fly to tileset
		console.log(`[GenericTilesetLayer] Flying to ${props.layer.code}...`)
		await viewer.flyTo(loadedTileset, { duration: 2 })

		console.log(`[GenericTilesetLayer] ${props.layer.code} loaded successfully`)
	} catch (e) {
		console.error(`[GenericTilesetLayer] Failed to load ${props.layer.code}:`, e)
	} finally {
		isLoading.value = false
	}
}

async function applyOSGBGrounding() {
	const viewer = cesiumStore.viewer
	if (!viewer || !tileset.value) return

	const config = props.layer.config || {}
	const offset = cesiumStore.terrainEnabled
		? (config.terrainOffset || 0)
		: (config.ellipsoidOffset || 0)

	console.log(`[GenericTilesetLayer] Smart Grounding with offset ${offset}m (Terrain: ${cesiumStore.terrainEnabled})`)
	await BIMAlignment.autoGroundSmart(tileset.value, viewer, offset)
}

function removeTileset() {
	const viewer = cesiumStore.viewer
	if (!viewer || !tileset.value) return

	try {
		viewer.scene.primitives.remove(tileset.value)
		tileset.value.destroy()
	} catch (e) {
		console.warn(`[GenericTilesetLayer] Error removing ${props.layer.code}:`, e)
	}
	tileset.value = null
	console.log(`[GenericTilesetLayer] ${props.layer.code} removed`)
}

onUnmounted(() => {
	removeTileset()
})
</script>
