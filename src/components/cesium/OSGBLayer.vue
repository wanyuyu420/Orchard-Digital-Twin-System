<template>
	<div class="osgb-layer-status" v-if="isLoading || error">
		<span v-if="isLoading" class="loading">加载倾斜摄影...</span>
		<span v-if="error" class="error">{{ error }}</span>
	</div>
</template>

<script setup lang="ts">
/**
 * OSGBLayer - Renders OSGB 3D Tiles (倾斜摄影) on Cesium map
 *
 * Features:
 * - Load 3D Tiles from backend /tiles/osgb endpoint
 * - Show/hide toggle support
 * - FlyTo functionality to navigate to tileset location
 *
 * Data Info:
 * - Source: GISBox generated 3D Tiles 1.1 from OSGB
 * - Location: ~78.42°E, 39.78°N (Hetian, Xinjiang)
 * - Size: 1.4GB (94 tile directories)
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { BIMAlignment } from '@/cesium/gis/tools/BIMAlignment'

declare const Cesium: any

// Props
const props = withDefaults(defineProps<{
	visible?: boolean
	url: string
	ellipsoidOffset?: number
	terrainOffset?: number
}>(), {
	ellipsoidOffset: 12,
	terrainOffset: 8
})

// Emits
const emit = defineEmits<{
	(e: 'ready'): void
	(e: 'error', message: string): void
}>()

// Store
const cesiumStore = useCesiumStore()

// State
const isLoading = ref(false)
const error = ref<string | null>(null)
const tilesetReady = ref(false)

// Tileset reference
let tileset: any = null

/**
 * Load the 3D Tileset
 */
const loadTileset = async () => {
	const viewer = cesiumStore.viewer
	if (!viewer) {
		console.warn('[OSGBLayer] Viewer not ready')
		return
	}

	if (tileset) {
		console.log('[OSGBLayer] Tileset already loaded')
		return
	}

	isLoading.value = true
	cesiumStore.osgbLoading = true
	error.value = null

	try {
		console.log('[OSGBLayer] Loading 3D Tiles from:', props.url)

		// Use Cesium3DTileset.fromUrl for async loading
		// Note: fromUrl returns a ready tileset, no need for readyPromise
		tileset = await Cesium.Cesium3DTileset.fromUrl(props.url, {
			// Performance options
			maximumScreenSpaceError: 16, // Higher = faster loading, lower quality
			maximumMemoryUsage: 512, // MB - limit memory usage
			// Skip LOD levels for faster initial load
			skipLevelOfDetail: true,
			baseScreenSpaceError: 1024,
			skipScreenSpaceErrorFactor: 16,
			skipLevels: 1,
		})

		// Add to scene
		viewer.scene.primitives.add(tileset)

		tilesetReady.value = true
		console.log('[OSGBLayer] 3D Tileset loaded successfully')

		// Set initial visibility
		tileset.show = props.visible !== false

		// Auto fly to tileset location after loading
		console.log('[OSGBLayer] Auto flying to tileset...')
		await viewer.flyTo(tileset, {
			duration: 2,
		})

		emit('ready')
	} catch (e: any) {
		console.error('[OSGBLayer] Failed to load tileset:', e)
		error.value = `加载失败: ${e.message || '未知错误'}`
		emit('error', error.value)
	} finally {
		isLoading.value = false
		cesiumStore.osgbLoading = false
	}
}

/**
 * Remove tileset from scene
 */
const removeTileset = () => {
	if (tileset && cesiumStore.viewer) {
		try {
			cesiumStore.viewer.scene.primitives.remove(tileset)
			tileset.destroy()
		} catch (e) {
			console.warn('[OSGBLayer] Error removing tileset:', e)
		}
		tileset = null
		tilesetReady.value = false
	}
}

/**
 * Toggle tileset visibility
 */
const setVisible = (visible: boolean) => {
	if (tileset) {
		tileset.show = visible
	}
}

/**
 * Fly to tileset location
 */
const flyTo = async (duration = 2) => {
	if (!tileset || !cesiumStore.viewer) {
		console.warn('[OSGBLayer] Cannot flyTo: tileset or viewer not ready')
		return
	}

	try {
		// Use the tileset's bounding sphere for accurate positioning
		await cesiumStore.viewer.flyTo(tileset, {
			duration,
			offset: new Cesium.HeadingPitchRange(
				Cesium.Math.toRadians(0), // heading
				Cesium.Math.toRadians(-45), // pitch (look down at 45 degrees)
				0 // range (auto-calculate based on bounding sphere)
			),
		})
	} catch (e) {
		console.error('[OSGBLayer] flyTo failed:', e)
	}
}

/**
 * Get tileset info
 */
const getInfo = () => {
	if (!tileset || !tilesetReady.value) return null

	return {
		ready: tilesetReady.value,
		show: tileset.show,
		// Root tile info
		asset: tileset.asset,
		// Memory usage
		totalMemoryUsageInBytes: tileset.totalMemoryUsageInBytes,
	}
}

// Watch visibility prop
watch(
	() => props.visible,
	(visible) => {
		if (visible !== undefined) {
			setVisible(visible)
		}
	}
)

// Lifecycle
onMounted(() => {
	console.log('[OSGBLayer] Component mounted, viewer ready:', !!cesiumStore.viewer)

	const applyGrounding = async () => {
		if (tileset && cesiumStore.viewer) {
			// 智能贴地策略：
			// 无地形(椭球)：使用配置的 ellipsoidOffset
			// 有地形(Smart)：使用配置的 terrainOffset
			const offset = cesiumStore.terrainEnabled ? props.terrainOffset : props.ellipsoidOffset

			console.log(`[OSGBLayer] Smart Grounding with base offset ${offset}m (Terrain: ${cesiumStore.terrainEnabled})`)

			// 使用新的智能多点采样方法
			await BIMAlignment.autoGroundSmart(tileset, cesiumStore.viewer, offset)
		}
	}

	const handleLoad = async () => {
		await loadTileset()
		await applyGrounding()
	}

	// Wait for viewer to be ready
	if (cesiumStore.viewer) {
		handleLoad()
	} else {
		// Watch for viewer initialization
		console.log('[OSGBLayer] Waiting for viewer...')
		const unwatch = watch(
			() => cesiumStore.viewer,
			(viewer) => {
				if (viewer) {
					console.log('[OSGBLayer] Viewer now ready, loading tileset')
					handleLoad()
					unwatch()
				}
			}
		)
	}

	// 监听地形变化
	watch(
		() => cesiumStore.terrainEnabled,
		async () => {
			await applyGrounding()
		}
	)
})

onUnmounted(() => {
	removeTileset()
})

// Expose for parent components
defineExpose({
	loadTileset,
	removeTileset,
	setVisible,
	flyTo,
	getInfo,
	isLoading,
	tilesetReady,
})
</script>

<style scoped lang="scss">
.osgb-layer-status {
	position: absolute;
	top: 80px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 100;
	padding: 8px 16px;
	border-radius: 4px;
	font-size: 14px;
	pointer-events: none;

	.loading {
		color: var(--color-primary);
		background: rgba(0, 0, 0, 0.7);
		padding: 8px 16px;
		border-radius: 4px;
	}

	.error {
		color: var(--color-danger);
		background: rgba(0, 0, 0, 0.7);
		padding: 8px 16px;
		border-radius: 4px;
	}
}
</style>
