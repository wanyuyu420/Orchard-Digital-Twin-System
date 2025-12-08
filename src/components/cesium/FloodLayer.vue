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

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const scenario = ref<FloodScenarioDetail | null>(null);
const currentFrame = ref<FloodFrame | null>(null);

// Cesium entities
let floodEntities: any[] = [];
let boundaryEntity: any = null;

// Water color based on depth (shallow → deep blue)
const getWaterColor = (waterLevel: number): any => {
  // Water level 0-10m mapped to color intensity
  const intensity = Math.min(1, waterLevel / 10);
  return Cesium.Color.fromCssColorString(
    `rgba(30, 144, 255, ${0.4 + intensity * 0.3})`  // DodgerBlue with varying alpha
  );
};

// Get outline color (neon cyan)
const getOutlineColor = (): any => {
  return Cesium.Color.fromCssColorString('rgba(0, 255, 255, 0.8)');
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
      height: 0,
      extrudedHeight: waterLevel * 10, // Extrude for 3D effect (scaled)
      perPositionHeight: false,
    },
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
      const entity = createFloodPolygon(polygon, frame.water_level, index);
      if (entity) {
        floodEntities.push(entity);
      }
    });
  }

  // Update simulation result with current flood area
  // Note: This could be connected to simulationStore.result if needed
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

  if (boundaryEntity) {
    try {
      viewer.entities.remove(boundaryEntity);
    } catch (e) {
      // Entity might already be removed
    }
    boundaryEntity = null;
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
    const progress = simulationStore.state.progress;
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

// Watch for progress changes
watch(
  () => simulationStore.state.progress,
  (progress) => {
    if (!scenario.value) return;
    currentFrame.value = findFrameForProgress(progress);
    updateFloodVisualization();
  }
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
