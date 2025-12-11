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
 * Uses CallbackProperty pattern for efficient dynamic updates:
 * - Entity created once on mount, never recreated
 * - Polygon hierarchy and material color read from module state via callbacks
 * - Frame changes update state variables, Cesium reads on each render cycle
 * 
 * This approach eliminates flickering caused by entity recreation.
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

// State (Vue reactive)
const isLoading = ref(false);
const error = ref<string | null>(null);
const scenario = ref<FloodScenarioDetail | null>(null);
const currentFrame = ref<FloodFrame | null>(null);

// Module-level state for CallbackProperty (not Vue reactive - used by Cesium callbacks)
// These are updated by Vue watchers and read by Cesium on each frame
let currentHierarchy: any = null;  // Cesium.PolygonHierarchy
let currentColor: any = null;      // Cesium.Color
let currentBoundaryPositions: any = null; // Cesium.Cartesian3[]

// Persistent entities (created once, never recreated)
let floodEntity: any = null;
let boundaryEntity: any = null;
let entitiesInitialized = false;

/**
 * Compute water color based on water level
 */
const computeWaterColor = (waterLevel: number): any => {
	const intensity = Math.min(1, waterLevel / 10);
	const alpha = 0.5 + intensity * 0.1; // 0.5 to 0.6
	return Cesium.Color.fromBytes(30, 144, 255, Math.floor(alpha * 255));
};

/**
 * Compute boundary color (neon cyan)
 */
const computeBoundaryColor = (): any => {
	return Cesium.Color.fromBytes(0, 255, 255, 230);
};

/**
 * Build Cartesian3 positions from MultiPolygon GeoJSON
 * Returns the exact same positions to be used by both polygon and boundary
 */
const buildPositionsFromMultiPolygon = (multiPolygon: any): any => {
	if (!multiPolygon || multiPolygon.type !== 'MultiPolygon') {
		return null;
	}

	// Get the first polygon
	const firstPolygon = multiPolygon.coordinates[0];
	if (!firstPolygon || !firstPolygon[0]) {
		return null;
	}

	const outerRing = firstPolygon[0];
	const positions: number[] = [];

	outerRing.forEach((coord: number[]) => {
		positions.push(coord[0], coord[1]);
	});

	// Return Cartesian3 array - used by both polygon hierarchy and boundary
	return Cesium.Cartesian3.fromDegreesArray(positions);
};

/**
 * Build closed boundary positions from shared base positions
 * Closes the ring by adding first point at the end
 */
const buildClosedBoundaryPositions = (positions: any): any => {
	if (!positions || positions.length === 0) return null;
	// Clone positions and close the ring
	const closed = [...positions];
	if (positions.length > 0) {
		closed.push(positions[0].clone());
	}
	return closed;
};

/**
 * Initialize persistent Cesium entities with CallbackProperty
 * Called once when viewer is ready and we have initial data
 */
const initializeEntities = () => {
	const viewer = cesiumStore.viewer;
	if (!viewer || entitiesInitialized) return;

	// Initialize default values
	currentColor = computeWaterColor(5);

	// Create flood polygon entity with CallbackProperty
	floodEntity = viewer.entities.add({
		name: 'flood_polygon',
		polygon: {
			// CallbackProperty reads currentHierarchy on every frame
			hierarchy: new Cesium.CallbackProperty(() => {
				return currentHierarchy;
			}, false), // false = not constant, will be called each frame
			// ColorMaterialProperty with CallbackProperty for dynamic color
			material: new Cesium.ColorMaterialProperty(
				new Cesium.CallbackProperty(() => {
					return currentColor || Cesium.Color.TRANSPARENT;
				}, false)
			),
			height: 0,
			heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
			classificationType: Cesium.ClassificationType.BOTH,
		},
		show: true,
	});

	// Create boundary polyline entity with CallbackProperty
	boundaryEntity = viewer.entities.add({
		name: 'flood_boundary',
		polyline: {
			positions: new Cesium.CallbackProperty(() => {
				return currentBoundaryPositions;
			}, false),
			width: 3,
			material: new Cesium.PolylineGlowMaterialProperty({
				glowPower: 0.15,
				taperPower: 0.2,
				color: computeBoundaryColor()
			}),
			clampToGround: true,
		},
		show: true,
	});

	entitiesInitialized = true;
	console.log('[FloodLayer] Entities initialized with CallbackProperty');
};

/**
 * Update module-level state from current frame
 * This triggers Cesium to render new polygon on next frame
 */
const updateStateFromFrame = (frame: FloodFrame | null) => {
	if (!frame || !frame.polygons) {
		currentHierarchy = null;
		currentBoundaryPositions = null;
		return;
	}

	// Build shared positions from MultiPolygon
	const sharedPositions = buildPositionsFromMultiPolygon(frame.polygons);
	if (!sharedPositions) {
		currentHierarchy = null;
		currentBoundaryPositions = null;
		return;
	}

	// Update polygon hierarchy using shared positions
	currentHierarchy = new Cesium.PolygonHierarchy(sharedPositions);

	// Update color based on water level
	currentColor = computeWaterColor(frame.water_level);

	// Update boundary positions - use closed version of shared positions
	currentBoundaryPositions = buildClosedBoundaryPositions(sharedPositions);

	// Sync flood area to simulation store
	if (frame.area_km2 !== undefined && frame.area_km2 !== null) {
		simulationStore.setFloodArea(frame.area_km2);
	}
};

/**
 * Clear entities from viewer
 */
const clearEntities = () => {
	const viewer = cesiumStore.viewer;
	if (!viewer) return;

	if (floodEntity) {
		try { viewer.entities.remove(floodEntity); } catch (e) { /* ignore */ }
		floodEntity = null;
	}
	if (boundaryEntity) {
		try { viewer.entities.remove(boundaryEntity); } catch (e) { /* ignore */ }
		boundaryEntity = null;
	}

	entitiesInitialized = false;
	currentHierarchy = null;
	currentColor = null;
	currentBoundaryPositions = null;
};

/**
 * Load scenario data
 */
const loadScenario = async (id: number) => {
	isLoading.value = true;
	error.value = null;

	try {
		scenario.value = await getFloodScenarioDetail(id);

		// Initialize entities if not done yet
		initializeEntities();

		// Set initial frame based on current progress
		const progress = simState.value.progress;
		currentFrame.value = findFrameForProgress(progress);
		updateStateFromFrame(currentFrame.value);

		// Fly to scenario center if available
		if (scenario.value.region_center_lng && scenario.value.region_center_lat) {
			cesiumStore.flyTo(
				scenario.value.region_center_lng,
				scenario.value.region_center_lat,
				30000,
				2
			);
		}
	} catch (e) {
		console.error('[FloodLayer] Failed to load scenario:', e);
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
		console.error('[FloodLayer] Failed to load scenarios:', e);
		error.value = '加载洪水场景列表失败';
	}
};

/**
 * Find appropriate frame for current progress
 */
const findFrameForProgress = (progress: number): FloodFrame | null => {
	if (!scenario.value || !scenario.value.frames.length) return null;

	const frames = scenario.value.frames;
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

// Throttling for API calls
let lastFetchTime = 0;
const FETCH_THROTTLE = 300; // 300ms minimum between API calls
let pendingFetch = false;

/**
 * Fetch interpolated frame from API
 */
const fetchInterpolatedFrame = async (progress: number) => {
	if (!scenario.value) return;

	try {
		const { getFloodFrame } = await import('@/api/flood');
		const frame = await getFloodFrame(scenario.value.id, Math.round(progress));
		currentFrame.value = frame;
		updateStateFromFrame(frame);
	} catch (e) {
		console.error('[FloodLayer] Failed to fetch frame:', e);
	}
};

// Watch for progress changes with throttling
watch(
	() => simState.value.progress,
	(progress) => {
		if (!scenario.value) return;

		const now = Date.now();
		if (now - lastFetchTime < FETCH_THROTTLE) {
			if (!pendingFetch) {
				pendingFetch = true;
				setTimeout(() => {
					pendingFetch = false;
					lastFetchTime = Date.now();
					fetchInterpolatedFrame(simState.value.progress);
				}, FETCH_THROTTLE - (now - lastFetchTime));
			}
			return;
		}
		lastFetchTime = now;
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
	clearEntities();
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
