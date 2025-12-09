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

// Animation constants
const ANIMATION_INTERVAL = 50; // ms
const OPACITY_MIN = 0.35;
const OPACITY_MAX = 0.55;
const OPACITY_STEP = 0.01;

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

// Cesium entities
let floodEntities: any[] = [];
let boundaryEntities: any[] = [];

// Animation state
let animationTimer: ReturnType<typeof setInterval> | null = null;
let currentOpacity = OPACITY_MIN;
let opacityDirection = 1; // 1 = increasing, -1 = decreasing

// Water color based on depth (shallow → deep blue) with dynamic opacity
const getWaterColor = (waterLevel: number, opacity: number = currentOpacity): any => {
	// Water level 0-10m mapped to color intensity
	const intensity = Math.min(1, waterLevel / 10);
	const baseOpacity = opacity + intensity * 0.15;
	return Cesium.Color.fromCssColorString(
		`rgba(30, 144, 255, ${baseOpacity})`  // DodgerBlue with varying alpha
	);
};

// Get outline color (neon cyan glow)
const getOutlineColor = (): any => {
	return Cesium.Color.fromCssColorString('rgba(0, 255, 255, 0.9)');
};

// Get boundary glow color (brighter neon cyan)
const getBoundaryGlowColor = (): any => {
	return Cesium.Color.fromCssColorString('rgba(0, 255, 255, 1.0)');
};

/**
 * Create Cesium polygon entity from GeoJSON coordinates
 */
const createFloodPolygon = (
	coordinates: number[][][],
	waterLevel: number,
	index: number
): any => {
	const viewer = cesiumStore.viewer;
	if (!viewer) return null;

	// Flatten coordinates for Cesium (expects [lon, lat, lon, lat, ...])
	const positions: number[] = [];
	coordinates[0].forEach((coord: number[]) => {
		positions.push(coord[0], coord[1]);
	});

	const entity = viewer.entities.add({
		name: `flood_polygon_${index}`,
		polygon: {
			hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
			material: getWaterColor(waterLevel),
			outline: true,
			outlineColor: getOutlineColor(),
			outlineWidth: 2,
			// Clamp to ground - renders ON terrain surface
			heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
			// Classification type renders on 3D Tiles and terrain
			classificationType: Cesium.ClassificationType.BOTH,
		},
	});

	return entity;
};

/**
 * Create boundary polyline for neon glow effect
 */
const createBoundaryPolyline = (
	coordinates: number[][][],
	index: number
): any => {
	const viewer = cesiumStore.viewer;
	if (!viewer) return null;

	// Get outer ring coordinates
	const outerRing = coordinates[0];
	const positions: number[] = [];
	outerRing.forEach((coord: number[]) => {
		positions.push(coord[0], coord[1]);
	});
	// Close the ring
	if (outerRing.length > 0) {
		positions.push(outerRing[0][0], outerRing[0][1]);
	}

	const entity = viewer.entities.add({
		name: `flood_boundary_${index}`,
		polyline: {
			positions: Cesium.Cartesian3.fromDegreesArray(positions),
			width: 4,
			material: new Cesium.PolylineGlowMaterialProperty({
				glowPower: 0.3,
				taperPower: 0.5,
				color: getBoundaryGlowColor()
			}),
			clampToGround: true
		}
	});

	return entity;
};

/**
 * Update flood visualization based on current frame
 */
const updateFloodVisualization = () => {
	const viewer = cesiumStore.viewer;
	if (!viewer || !currentFrame.value) return;

	// Clear existing entities
	clearFloodEntities();

	const frame = currentFrame.value;
	if (!frame.polygons) return;

	// Handle MultiPolygon GeoJSON
	if (frame.polygons.type === 'MultiPolygon') {
		frame.polygons.coordinates.forEach((polygon: number[][][], index: number) => {
			// Create filled polygon
			const entity = createFloodPolygon(polygon, frame.water_level, index);
			if (entity) {
				floodEntities.push(entity);
			}
			// Create glowing boundary polyline
			const boundary = createBoundaryPolyline(polygon, index);
			if (boundary) {
				boundaryEntities.push(boundary);
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
	// Update simulation store with the actual flood area from the frame
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

	floodEntities.forEach((entity) => {
		try {
			viewer.entities.remove(entity);
		} catch (e) {
			// Entity might already be removed
		}
	});
	floodEntities = [];

	boundaryEntities.forEach((entity) => {
		try {
			viewer.entities.remove(entity);
		} catch (e) {
			// Entity might already be removed
		}
	});
	boundaryEntities = [];
};

/**
 * Start water surface animation (opacity pulsing)
 */
const startAnimation = () => {
	if (animationTimer) return;

	animationTimer = setInterval(() => {
		// Update opacity with sine-wave-like pulsing
		currentOpacity += OPACITY_STEP * opacityDirection;

		if (currentOpacity >= OPACITY_MAX) {
			currentOpacity = OPACITY_MAX;
			opacityDirection = -1;
		} else if (currentOpacity <= OPACITY_MIN) {
			currentOpacity = OPACITY_MIN;
			opacityDirection = 1;
		}

		// Update polygon materials with new opacity
		floodEntities.forEach((entity) => {
			if (entity.polygon && currentFrame.value) {
				entity.polygon.material = getWaterColor(currentFrame.value.water_level, currentOpacity);
			}
		});
	}, ANIMATION_INTERVAL);
};

/**
 * Stop water surface animation
 */
const stopAnimation = () => {
	if (animationTimer) {
		clearInterval(animationTimer);
		animationTimer = null;
	}
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

	// For now, just return the previous frame (no client-side geometric interpolation)
	// The API endpoint /frame?progress=X handles numeric interpolation
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
const UPDATE_INTERVAL = 100; // API calls need some throttling
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

// Watch for progress changes with immediate flush
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
	// Start animation after a short delay to ensure entities are created
	setTimeout(startAnimation, 500);
});

onUnmounted(() => {
	stopAnimation();
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
