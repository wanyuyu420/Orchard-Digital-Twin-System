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
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useCesiumStore } from '@/stores/cesium';

declare const Cesium: any;

// Props
const props = defineProps<{
	visible?: boolean;
	heightOffset?: number; // Height adjustment in meters (negative = lower)
}>();

// Default height offset
const DEFAULT_HEIGHT_OFFSET = -50;

// Emits
const emit = defineEmits<{
	(e: 'ready'): void;
	(e: 'error', message: string): void;
}>();

// Store
const cesiumStore = useCesiumStore();

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const tilesetReady = ref(false);

// Tileset reference
let tileset: any = null;

// API endpoint for OSGB 3D Tiles
const TILESET_URL = 'http://localhost:8000/tiles/osgb/tileset.json';

/**
 * Load the 3D Tileset
 */
const loadTileset = async () => {
	const viewer = cesiumStore.viewer;
	if (!viewer) {
		console.warn('[OSGBLayer] Viewer not ready');
		return;
	}

	if (tileset) {
		console.log('[OSGBLayer] Tileset already loaded');
		return;
	}

	isLoading.value = true;
	cesiumStore.osgbLoading = true;
	error.value = null;

	try {
		console.log('[OSGBLayer] Loading 3D Tiles from:', TILESET_URL);

		// Use Cesium3DTileset.fromUrl for async loading
		// Note: fromUrl returns a ready tileset, no need for readyPromise
		tileset = await Cesium.Cesium3DTileset.fromUrl(TILESET_URL, {
			// === Performance Optimization ===
			// Higher = faster loading, less tiles loaded (default 16)
			maximumScreenSpaceError: 64,
			// Limit memory usage (MB)
			maximumMemoryUsage: 256,
			// Limit simultaneous tile requests
			maximumSimultaneousTileLoads: 6,
			// Dynamic screen space error - reduces detail for distant tiles
			dynamicScreenSpaceError: true,
			dynamicScreenSpaceErrorDensity: 0.00278,
			dynamicScreenSpaceErrorFactor: 4.0,
			dynamicScreenSpaceErrorHeightFalloff: 0.25,
			// Skip LOD levels for faster initial load
			skipLevelOfDetail: true,
			baseScreenSpaceError: 1024,
			skipScreenSpaceErrorFactor: 16,
			skipLevels: 1,
		});

		// Add to scene
		viewer.scene.primitives.add(tileset);

		// === Fix floating: Apply height offset ===
		// Get the bounding sphere center and create a height adjustment
		const boundingSphere = tileset.boundingSphere;
		const cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);

		// Apply height offset (negative to bring it down)
		const heightOffset = props.heightOffset ?? DEFAULT_HEIGHT_OFFSET;
		const surface = Cesium.Cartesian3.fromRadians(
			cartographic.longitude,
			cartographic.latitude,
			cartographic.height + heightOffset
		);
		const offset = Cesium.Cartesian3.subtract(surface, boundingSphere.center, new Cesium.Cartesian3());
		tileset.modelMatrix = Cesium.Matrix4.fromTranslation(offset);
		console.log('[OSGBLayer] Applied height offset:', heightOffset, 'meters');

		tilesetReady.value = true;
		console.log('[OSGBLayer] 3D Tileset loaded successfully');

		// Set initial visibility
		tileset.show = props.visible !== false;

		// Auto fly to tileset location after loading
		console.log('[OSGBLayer] Auto flying to tileset...');
		await viewer.flyTo(tileset, {
			duration: 2,
		});

		emit('ready');
	} catch (e: any) {
		console.error('[OSGBLayer] Failed to load tileset:', e);
		error.value = `加载失败: ${e.message || '未知错误'}`;
		emit('error', error.value);
	} finally {
		isLoading.value = false;
		cesiumStore.osgbLoading = false;
	}
};

/**
 * Remove tileset from scene
 */
const removeTileset = () => {
	if (tileset && cesiumStore.viewer) {
		try {
			cesiumStore.viewer.scene.primitives.remove(tileset);
			tileset.destroy();
		} catch (e) {
			console.warn('[OSGBLayer] Error removing tileset:', e);
		}
		tileset = null;
		tilesetReady.value = false;
	}
};

/**
 * Toggle tileset visibility
 */
const setVisible = (visible: boolean) => {
	if (tileset) {
		tileset.show = visible;
	}
};

/**
 * Fly to tileset location
 */
const flyTo = async (duration = 2) => {
	if (!tileset || !cesiumStore.viewer) {
		console.warn('[OSGBLayer] Cannot flyTo: tileset or viewer not ready');
		return;
	}

	try {
		// Use the tileset's bounding sphere for accurate positioning
		await cesiumStore.viewer.flyTo(tileset, {
			duration,
			offset: new Cesium.HeadingPitchRange(
				Cesium.Math.toRadians(0),    // heading
				Cesium.Math.toRadians(-45),  // pitch (look down at 45 degrees)
				0  // range (auto-calculate based on bounding sphere)
			)
		});
	} catch (e) {
		console.error('[OSGBLayer] flyTo failed:', e);
	}
};

/**
 * Get tileset info
 */
const getInfo = () => {
	if (!tileset || !tilesetReady.value) return null;

	return {
		ready: tilesetReady.value,
		show: tileset.show,
		// Root tile info
		asset: tileset.asset,
		// Memory usage
		totalMemoryUsageInBytes: tileset.totalMemoryUsageInBytes,
	};
};

// Watch visibility prop
watch(
	() => props.visible,
	(visible) => {
		if (visible !== undefined) {
			setVisible(visible);
		}
	}
);

// Lifecycle
onMounted(() => {
	console.log('[OSGBLayer] Component mounted, viewer ready:', !!cesiumStore.viewer);
	// Wait for viewer to be ready
	if (cesiumStore.viewer) {
		loadTileset();
	} else {
		// Watch for viewer initialization
		console.log('[OSGBLayer] Waiting for viewer...');
		const unwatch = watch(
			() => cesiumStore.viewer,
			(viewer) => {
				if (viewer) {
					console.log('[OSGBLayer] Viewer now ready, loading tileset');
					loadTileset();
					unwatch();
				}
			}
		);
	}
});

onUnmounted(() => {
	removeTileset();
});

// Expose for parent components
defineExpose({
	loadTileset,
	removeTileset,
	setVisible,
	flyTo,
	getInfo,
	isLoading,
	tilesetReady,
});
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
