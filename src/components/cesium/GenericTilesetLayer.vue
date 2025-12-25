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

// Watch for terrain changes to re-ground OSGB and point cloud
watch(
	() => cesiumStore.terrainEnabled,
	async (terrainEnabled) => {
		if (!tileset.value) return
		const config = props.layer.config || {}

		// Re-ground OSGB
		if (config.ellipsoidOffset !== undefined) {
			await applyOSGBGrounding()
		}
		// Re-align BIM based on terrain state
		else if (config.alignment || config.alignmentEllipsoid || config.alignmentTerrain) {
			applyBIMAlignment(terrainEnabled)
		}
		// Re-ground point cloud
		else if (config.pointCloud) {
			const viewer = cesiumStore.viewer
			if (viewer) {
				console.log(`[GenericTilesetLayer] Re-grounding point cloud after terrain change...`)
				await BIMAlignment.autoGroundSmart(tileset.value, viewer, 10)
			}
		}
	}
)

// Apply BIM alignment with terrain-aware height
function applyBIMAlignment(terrainEnabled: boolean) {
	const config = props.layer.config || {}
	if (!tileset.value) return

	// Prefer dual-params (recommended), fallback to legacy single alignment
	const chosen =
		(terrainEnabled ? config.alignmentTerrain : config.alignmentEllipsoid) ||
		config.alignment

	if (!chosen) return

	// Copy params to avoid mutating config
	const params = { ...chosen }

	console.log(`[GenericTilesetLayer] BIM alignment (terrain: ${terrainEnabled}):`, params)
	BIMAlignment.applyToTileset(tileset.value, params)
}

async function loadTileset() {
	const viewer = cesiumStore.viewer
	if (!viewer || !props.layer.url || tileset.value || isLoading.value) return

	const config = props.layer.config || {}

	try {
		isLoading.value = true
		console.log(`[GenericTilesetLayer] Loading ${props.layer.code} from ${props.layer.url}`)

		// Determine SSE based on config or defaults
		const sse = config.pointCloud?.maximumScreenSpaceError ?? 16
		// Point cloud needs more memory for dense display
		const memoryUsage = config.pointCloud ? 2048 : 512
		// Point cloud should NOT skip LOD for dense display (matches demo quality mode)
		const skipLOD = config.pointCloud ? false : true

		// Point cloud loading options (same as demo)
		const tilesetOptions: Record<string, unknown> = {
			maximumScreenSpaceError: sse,
			maximumMemoryUsage: memoryUsage,
			skipLevelOfDetail: skipLOD,
			baseScreenSpaceError: 1024,
			skipScreenSpaceErrorFactor: 16,
			skipLevels: 1,
		}

		// Add demo-specific options for point cloud only
		if (config.pointCloud) {
			tilesetOptions.immediatelyLoadDesiredLevelOfDetail = false
			tilesetOptions.loadSiblings = false
			tilesetOptions.cullWithChildrenBounds = true
		}

		// Load the tileset
		const loadedTileset = await Cesium.Cesium3DTileset.fromUrl(props.layer.url, tilesetOptions)

		// Apply alignment if specified (for BIM models)
		if (config.alignment || config.alignmentEllipsoid || config.alignmentTerrain) {
			// 先添加到 scene 并保存引用，再调用 applyBIMAlignment
			viewer.scene.primitives.add(loadedTileset)
			tileset.value = loadedTileset
			applyBIMAlignment(cesiumStore.terrainEnabled)
		} else {
			console.log(`[GenericTilesetLayer] No alignment config for ${props.layer.code}`)
			// Add to scene
			viewer.scene.primitives.add(loadedTileset)
			tileset.value = loadedTileset
		}

		// ============ Point Cloud Styling ============
		if (config.pointCloud) {
			const pc = config.pointCloud
			console.log(`[GenericTilesetLayer] Applying point cloud styling for ${props.layer.code}`)

			// Apply style (point size and color)
			const styleOptions: Record<string, unknown> = {}
			if (pc.pointSize) {
				styleOptions.pointSize = pc.pointSize
			}
			if (pc.color) {
				// Support both CSS color names and hex
				styleOptions.color = `color('${pc.color}')`
			}
			if (Object.keys(styleOptions).length > 0) {
				loadedTileset.style = new Cesium.Cesium3DTileStyle(styleOptions)
			}

			// Apply point cloud shading options
			if (pc.eyeDomeLighting !== undefined) {
				loadedTileset.pointCloudShading.eyeDomeLighting = pc.eyeDomeLighting
			}
			if (pc.attenuation !== undefined) {
				loadedTileset.pointCloudShading.attenuation = pc.attenuation
			}
			if (pc.maximumAttenuation !== undefined) {
				loadedTileset.pointCloudShading.maximumAttenuation = pc.maximumAttenuation
			}
		}

		// Apply grounding for OSGB (has ellipsoidOffset/terrainOffset)
		if (config.ellipsoidOffset !== undefined || config.terrainOffset !== undefined) {
			await applyOSGBGrounding()
		}
		// BIM 模型已通过 alignment 精确定位，不需要 autoGroundConservative（它会覆盖对齐）
		// Apply auto-grounding for point cloud (自动贴地)
		else if (config.pointCloud) {
			console.log(`[GenericTilesetLayer] Auto-grounding point cloud ${props.layer.code}...`)
			await BIMAlignment.autoGroundSmart(loadedTileset, viewer, 10)
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
