<template>
	<div class="bim-layer-status" v-if="isLoading || error">
		<span v-if="isLoading" class="loading">加载 BIM 模型...</span>
		<span v-if="error" class="error">{{ error }}</span>
	</div>
</template>

<script setup lang="ts">
/**
 * BIMLayer - Renders BIM 3D Tiles on Cesium map
 *
 * Features:
 * - Load 3D Tiles from backend /tiles/bim endpoint
 * - Show/hide toggle support
 * - FlyTo functionality to navigate to tileset location
 *
 * Data Info:
 * - Source: BIM model converted to 3D Tiles
 * - Size: ~1.1GB (project.b3dm 226MB)
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { BIMAlignment } from '@/cesium/gis/tools/BIMAlignment'

declare const Cesium: any

// Props
const props = withDefaults(defineProps<{
	visible?: boolean
	url: string
	alignment?: {
		longitude: number
		latitude: number
		height: number
		rotationX?: number
		rotationY?: number
		rotationZ?: number
		scale?: number
	}
}>(), {
	alignment: () => BIMAlignment.getDefaultParams() // Fallback if not provided
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
		console.warn('[BIMLayer] Viewer not ready')
		return
	}

	if (tileset) {
		console.log('[BIMLayer] Tileset already loaded')
		return
	}

	isLoading.value = true
	cesiumStore.bimLoading = true
	error.value = null

	try {
		console.log('[BIMLayer] Loading 3D Tiles from:', props.url)

		// Use Cesium3DTileset.fromUrl for async loading
		// Note: fromUrl returns a ready tileset, no need for readyPromise
		tileset = await Cesium.Cesium3DTileset.fromUrl(props.url, {
			// Performance options
			maximumScreenSpaceError: 16,
			maximumMemoryUsage: 512,
			skipLevelOfDetail: true,
			baseScreenSpaceError: 1024,
			skipScreenSpaceErrorFactor: 16,
			skipLevels: 1,
		})

		// Use BIMAlignment utility to apply correct position and rotation
		// Use props.alignment if provided, otherwise default
		const params = props.alignment || BIMAlignment.getDefaultParams()
		BIMAlignment.applyToTileset(tileset, params)

		// Add to scene
		viewer.scene.primitives.add(tileset)

		tilesetReady.value = true
		console.log('[BIMLayer] 3D Tileset loaded successfully')

		// Set initial visibility
		tileset.show = props.visible !== false

		// Auto fly to tileset location after loading
		console.log('[BIMLayer] Auto flying to tileset...')
		await viewer.flyTo(tileset, {
			duration: 2,
		})

		emit('ready')
	} catch (e: any) {
		console.error('[BIMLayer] Failed to load tileset:', e)
		error.value = `加载失败: ${e.message || '未知错误'}`
		emit('error', error.value)
	} finally {
		isLoading.value = false
		cesiumStore.bimLoading = false
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
			console.warn('[BIMLayer] Error removing tileset:', e)
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
		console.warn('[BIMLayer] Cannot flyTo: tileset or viewer not ready')
		return
	}

	try {
		await cesiumStore.viewer.flyTo(tileset, {
			duration,
		})
	} catch (e) {
		console.error('[BIMLayer] flyTo failed:', e)
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
		asset: tileset.asset,
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
	console.log('[BIMLayer] Component mounted, viewer ready:', !!cesiumStore.viewer)

	const handleLoad = async () => {
		await loadTileset()
		// 自动贴地（保守方式）
		if (tileset && cesiumStore.viewer) {
			await BIMAlignment.autoGroundConservative(tileset, cesiumStore.viewer)
		}
	}

	if (cesiumStore.viewer) {
		handleLoad()
	} else {
		console.log('[BIMLayer] Waiting for viewer...')
		const unwatch = watch(
			() => cesiumStore.viewer,
			(viewer) => {
				if (viewer) {
					console.log('[BIMLayer] Viewer now ready, loading tileset')
					handleLoad()
					unwatch()
				}
			}
		)
	}

	// 监听地形变化
	watch(
		() => cesiumStore.terrainEnabled,
		async (enabled) => {
			if (tileset && cesiumStore.viewer) {
				console.log(`[BIMLayer] Terrain changed (enabled: ${enabled}), re-grounding...`)
				await BIMAlignment.autoGroundConservative(tileset, cesiumStore.viewer)
			}
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
.bim-layer-status {
	position: absolute;
	top: 120px;
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
