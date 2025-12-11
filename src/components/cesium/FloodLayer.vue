<template>
	<div class="flood-layer-status" v-if="isLoading || error">
		<span v-if="isLoading" class="loading">加载洪水数据...</span>
		<span v-if="error" class="error">{{ error }}</span>
	</div>
</template>

<script setup lang="ts">
/**
 * FloodLayer - Renders flood simulation polygons on Cesium map
 * 
 * Watches simulation store progress and renders interpolated flood extent
 * as dynamic polygons with water-like styling.
 * 
 * Key design decisions:
 * - Uses ColorMaterialProperty for stable polygon rendering
 * - Avoids frequent entity recreation by only updating on geometry changes
 * - No opacity animation to prevent flickering on ground-clamped polygons
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useCesiumStore } from '@/stores/cesium';
import { useSimulationStore } from '@/stores/simulation';
import {
	getFloodScenarios,
	getFloodScenarioDetail,
	type FloodScenarioDetail,
	type FloodFrame
} from '@/api/flood';

declare const Cesium: any;

// Props
const props = defineProps<{
	scenarioId?: number;
}>();

// Stores
const cesiumStore = useCesiumStore();
const simulationStore = useSimulationStore();
const { state: simState } = storeToRefs(simulationStore);

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const scenario = ref<FloodScenarioDetail | null>(null);
const currentFrame = ref<FloodFrame | null>(null);

// Cesium entities - single set, reused across updates when possible
let floodEntity: any = null;
let boundaryEntity: any = null;

// Track last geometry hash to avoid unnecessary updates
let lastGeometryHash = '';

/**
 * Get water color based on water level (static, no animation)
 */
const getWaterColor = (waterLevel: number): any => {
	// Water level 0-10m mapped to color intensity
	const intensity = Math.min(1, waterLevel / 10);
	const alpha = 0.45 + intensity * 0.15; // 0.45 to 0.60
	return Cesium.Color.fromCssColorString(`rgba(30, 144, 255, ${alpha})`);
};

/**
 * Get boundary glow color (neon cyan)
 */
const getBoundaryGlowColor = (): any => {
	return Cesium.Color.fromCssColorString('rgba(0, 255, 255, 0.9)');
};

/**
 * Create a simple hash of the polygon coordinates for change detection
 */
const getGeometryHash = (polygons: any): string => {
	if (!polygons || !polygons.coordinates) return '';
	// Use first few coordinates to create a hash
	const coords = polygons.coordinates.flat(2).slice(0, 10);
	return coords.join(',');
};

/**
 * Convert MultiPolygon coordinates to flat Cartesian3 array
 */
const multiPolygonToPositions = (multiPolygon: any): any[] => {
	const allRings: any[] = [];
	if (multiPolygon.type !== 'MultiPolygon') return allRings;

	// For each polygon in MultiPolygon
	multiPolygon.coordinates.forEach((polygon: number[][][]) => {
		const outerRing = polygon[0];
		const positions: number[] = [];
		outerRing.forEach((coord: number[]) => {
			positions.push(coord[0], coord[1]);
		});
		allRings.push(Cesium.Cartesian3.fromDegreesArray(positions));
	});

	return allRings;
};

/**
 * Convert MultiPolygon to boundary polyline positions
 */
const multiPolygonToBoundaryPositions = (multiPolygon: any): any => {
	if (multiPolygon.type !== 'MultiPolygon') return null;

	// Combine all outer rings into one polyline
	const allPositions: number[] = [];
	multiPolygon.coordinates.forEach((polygon: number[][][]) => {
		const outerRing = polygon[0];
		outerRing.forEach((coord: number[]) => {
			allPositions.push(coord[0], coord[1], 0);
		});
		// Close each ring
		if (outerRing.length > 0) {
			allPositions.push(outerRing[0][0], outerRing[0][1], 0);
		}
	});

	return Cesium.Cartesian3.fromDegreesArrayHeights(allPositions);
};

/**
 * Update or create the flood polygon entity
 */
const updateFloodVisualization = () => {
	const viewer = cesiumStore.viewer;
	if (!viewer || !currentFrame.value) return;

	const frame = currentFrame.value;
	if (!frame.polygons) {
		clearFloodEntities();
		return;
	}

	// Check if geometry actually changed
	const newHash = getGeometryHash(frame.polygons);
	if (newHash === lastGeometryHash && floodEntity) {
		// Only update the material color (water level may have changed)
		if (floodEntity.polygon) {
			floodEntity.polygon.material = new Cesium.ColorMaterialProperty(
				getWaterColor(frame.water_level)
			);
		}
		return;
	}
	lastGeometryHash = newHash;

	// Geometry changed - need to recreate entities
	clearFloodEntities();

	// Create flood polygon(s)
	const positions = multiPolygonToPositions(frame.polygons);
	if (positions.length > 0) {
		// For simplicity, use the first polygon (largest) as the main entity
		// In a more complex implementation, we'd create multiple entities
		floodEntity = viewer.entities.add({
			name: 'flood_area',
			polygon: {
				hierarchy: positions[0],
				material: new Cesium.ColorMaterialProperty(
					getWaterColor(frame.water_level)
				),
				height: 0,
				heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
				classificationType: Cesium.ClassificationType.BOTH,
				outline: false,
			},
		});
	}

	// Create boundary polyline
	const boundaryPositions = multiPolygonToBoundaryPositions(frame.polygons);
	if (boundaryPositions) {
		boundaryEntity = viewer.entities.add({
			name: 'flood_boundary',
			polyline: {
				positions: boundaryPositions,
				width: 3,
				material: new Cesium.PolylineGlowMaterialProperty({
					glowPower: 0.2,
					taperPower: 0.3,
					color: getBoundaryGlowColor()
				}),
				clampToGround: true
			}
		});
	}

	// Sync flood area to simulation result
	syncFloodAreaToStore(frame);
};

/**
 * Sync flood area from current frame to simulation store
 */
const syncFloodAreaToStore = (frame: FloodFrame) => {
	if (frame.area_km2 !== undefined && frame.area_km2 !== null) {
		simulationStore.setFloodArea(frame.area_km2);
	}
};

/**
 * Clear all flood entities from the map
 */
const clearFloodEntities = () => {
	const viewer = cesiumStore.viewer;
	if (!viewer) return;

	if (floodEntity) {
		try {
			viewer.entities.remove(floodEntity);
		} catch (e) {
			// Entity might already be removed
		}
		floodEntity = null;
	}

	if (boundaryEntity) {
		try {
			viewer.entities.remove(boundaryEntity);
		} catch (e) {
			// Entity might already be removed
		}
		boundaryEntity = null;
	}

	lastGeometryHash = '';
};

/**
 * Find appropriate frame for current progress using interpolation logic
 */
const findFrameForProgress = (progress: number): FloodFrame | null => {
	if (!scenario.value || !scenario.value.frames.length) return null;

	const frames = scenario.value.frames;

	// Find the two frames to interpolate between
	let prevFrame = frames[0];

	for (let i = 0; i < frames.length; i++) {
		if (frames[i].time_step <= progress) {
			prevFrame = frames[i];
		} else {
			break;
		}
	}

	return prevFrame;
};

/**
 * Load scenario data
 */
const loadScenario = async (id: number) => {
	isLoading.value = true;
	error.value = null;

	try {
		scenario.value = await getFloodScenarioDetail(id);

		// Set initial frame based on current progress
		const progress = simState.value.progress;
		currentFrame.value = findFrameForProgress(progress);
		updateFloodVisualization();

		// Fly to scenario center if available
		if (scenario.value.region_center_lng && scenario.value.region_center_lat) {
			cesiumStore.flyTo(
				scenario.value.region_center_lng,
				scenario.value.region_center_lat,
				30000, // 30km height
				2 // 2 second duration
			);
		}
	} catch (e) {
		console.error('Failed to load flood scenario:', e);
		error.value = '加载洪水场景失败';
	} finally {
		isLoading.value = false;
	}
};

/**
 * Load default scenario (first available)
 */
const loadDefaultScenario = async () => {
	try {
		const scenarios = await getFloodScenarios();
		if (scenarios.length > 0) {
			await loadScenario(scenarios[0].id);
		}
	} catch (e) {
		console.error('Failed to load flood scenarios:', e);
		error.value = '加载洪水场景列表失败';
	}
};

// Track last update time for throttling
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 200; // Increase throttle to reduce flickering
let pendingUpdate = false;

// Fetch interpolated frame from API
const fetchInterpolatedFrame = async (progress: number) => {
	if (!scenario.value) return;

	try {
		const { getFloodFrame } = await import('@/api/flood');
		const frame = await getFloodFrame(scenario.value.id, Math.round(progress));
		currentFrame.value = frame;
		updateFloodVisualization();
	} catch (e) {
		console.error('[FloodLayer] Failed to fetch interpolated frame:', e);
	}
};

// Watch for progress changes with throttling
watch(
	() => simState.value.progress,
	(progress) => {
		if (!scenario.value) return;

		// Throttle API calls
		const now = Date.now();
		if (now - lastUpdateTime < UPDATE_INTERVAL) {
			// Schedule an update for when throttle expires
			if (!pendingUpdate) {
				pendingUpdate = true;
				setTimeout(() => {
					pendingUpdate = false;
					lastUpdateTime = Date.now();
					fetchInterpolatedFrame(simState.value.progress);
				}, UPDATE_INTERVAL - (now - lastUpdateTime));
			}
			return;
		}
		lastUpdateTime = now;

		fetchInterpolatedFrame(progress);
	},
	{ flush: 'sync' }
);

// Watch for scenarioId prop changes
watch(
	() => props.scenarioId,
	(id) => {
		if (id) {
			loadScenario(id);
		}
	}
);

// Lifecycle
onMounted(() => {
	if (props.scenarioId) {
		loadScenario(props.scenarioId);
	} else {
		loadDefaultScenario();
	}
});

onUnmounted(() => {
	clearFloodEntities();
});

// Expose for parent components
defineExpose({
	loadScenario,
	currentFrame,
	scenario,
});
</script>

<style scoped lang="scss">
.flood-layer-status {
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
