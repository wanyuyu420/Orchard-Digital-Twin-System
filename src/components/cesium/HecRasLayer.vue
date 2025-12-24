<template>
	<div class="hec-ras-layer-status" v-if="isLoading || error">
		<span v-if="isLoading" class="loading">
			<i class="fa-solid fa-spinner fa-spin"></i> 加载HEC-RAS数据...
		</span>
		<span v-if="error" class="error">{{ error }}</span>
	</div>
</template>

<script setup lang="ts">
/**
 * HecRasLayer - Renders HEC-RAS simulation frames on Cesium map
 *
 * Uses preloaded WebP image frames with ImageMaterialProperty.
 * Syncs with simulation store progress (0-100) to select current frame.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCesiumStore } from '@/stores/cesium'
import { useSimulationStore } from '@/stores/simulation'

declare const Cesium: any

// Props
const props = defineProps<{
	scenarioId?: number
}>()

// Stores
const cesiumStore = useCesiumStore()
const simulationStore = useSimulationStore()
const { state: simState } = storeToRefs(simulationStore)

// State
const isLoading = ref(false)
const error = ref<string | null>(null)
const scenario = ref<any>(null)
const frameUrls = ref<string[]>([])

// Module-level state for CallbackProperty
let currentImageUrl: string | null = null
let rectangleEntity: any = null
let entitiesInitialized = false

// Computed: current frame index based on progress
const currentFrameIndex = computed(() => {
	if (frameUrls.value.length === 0) return 0
	const progress = simState.value.progress
	const index = Math.floor((progress / 100) * (frameUrls.value.length - 1))
	return Math.max(0, Math.min(index, frameUrls.value.length - 1))
})

/**
 * Initialize Cesium entity with CallbackProperty for smooth frame updates
 */
const initializeEntity = async () => {
	const viewer = cesiumStore.viewer
	if (!viewer || entitiesInitialized || !scenario.value) return

	// Enable terrain for proper rendering
	if (!cesiumStore.terrainEnabled) {
		console.log('[HecRasLayer] Enabling terrain...')
		await cesiumStore.enableTerrain()
	}

	const extent = scenario.value.extent
	const rectangle = Cesium.Rectangle.fromDegrees(
		extent.west,
		extent.south,
		extent.east,
		extent.north
	)

	// Set initial image - only if we have frames
	currentImageUrl = frameUrls.value[0] || null

	// Don't create entity if no valid image URL
	if (!currentImageUrl) {
		console.warn('[HecRasLayer] No valid frame URLs, skipping entity creation')
		return
	}

	// Create entity with CallbackProperty for dynamic image updates
	rectangleEntity = viewer.entities.add({
		name: 'hec_ras_frame',
		rectangle: {
			coordinates: rectangle,
			material: new Cesium.ImageMaterialProperty({
				image: new Cesium.CallbackProperty(() => currentImageUrl, false),
				transparent: true,
			}),
			classificationType: Cesium.ClassificationType.TERRAIN,
		},
		// Only show when we have a valid image
		show: !!currentImageUrl,
	})

	entitiesInitialized = true
	console.log('[HecRasLayer] Entity initialized with', frameUrls.value.length, 'frames')
}

/**
 * Build frame URLs from manifest (actual filenames)
 */
const buildFrameUrlsFromManifest = (framesPath: string, filenames: string[]): string[] => {
	return filenames.map(name => `${framesPath}/${name}`)
}

/**
 * Load scenario from API
 */
const loadScenario = async (id: number) => {
	isLoading.value = true
	error.value = null

	try {
		const response = await fetch(`/api/v1/hec-ras/scenarios/${id}`)
		if (!response.ok) throw new Error('Failed to fetch scenario')

		scenario.value = await response.json()

		// Load manifest to get actual frame filenames
		const manifestPath = scenario.value.frames_path.replace('/frames', '/manifest.json')
		const manifestResponse = await fetch(manifestPath)

		if (manifestResponse.ok) {
			const manifest = await manifestResponse.json()
			frameUrls.value = buildFrameUrlsFromManifest(
				scenario.value.frames_path,
				manifest.frames
			)
			console.log('[HecRasLayer] Loaded', manifest.frames.length, 'frames from manifest')
		} else {
			console.warn('[HecRasLayer] Manifest not found, falling back to numbered pattern')
			// Fallback to numbered pattern (won't work with date-named files)
			const urls: string[] = []
			for (let i = 0; i < scenario.value.total_frames; i++) {
				urls.push(`${scenario.value.frames_path}/frame_${String(i).padStart(4, '0')}.${scenario.value.frame_extension}`)
			}
			frameUrls.value = urls
		}

		// Initialize Cesium entity
		await initializeEntity()

		// Fly to scenario location
		const camera = scenario.value.camera
		const extent = scenario.value.extent
		let centerLon = (extent.west + extent.east) / 2
		let centerLat = (extent.south + extent.north) / 2

		// Flow scenario: shift camera North-East for better view
		if (scenario.value.code === 'flow') {
			centerLon += 2.2 // Shift further east
			centerLat += 0.1 // Shift north
		}

		cesiumStore.flyTo(centerLon, centerLat, camera.height, 2)

	} catch (e) {
		console.error('[HecRasLayer] Failed to load scenario:', e)
		error.value = '加载HEC-RAS场景失败'
	} finally {
		isLoading.value = false
	}
}

/**
 * Load default scenario (first enabled)
 */
const loadDefaultScenario = async () => {
	try {
		const response = await fetch('/api/v1/hec-ras/scenarios')
		if (!response.ok) throw new Error('Failed to fetch scenarios')

		const scenarios = await response.json()
		if (scenarios.length > 0) {
			await loadScenario(scenarios[0].id)
		}
	} catch (e) {
		console.error('[HecRasLayer] Failed to load scenarios:', e)
		error.value = '加载HEC-RAS场景列表失败'
	}
}

/**
 * Clear entity from viewer
 */
const clearEntity = () => {
	const viewer = cesiumStore.viewer

	// Remove by reference if we have it
	if (rectangleEntity) {
		try {
			if (viewer && viewer.entities) {
				viewer.entities.remove(rectangleEntity)
			}
		} catch (e) {
			console.warn('[HecRasLayer] Error removing entity by reference:', e)
		}
		rectangleEntity = null
	}

	// Also try to remove any lingering entities by name (fallback)
	if (viewer && viewer.entities) {
		try {
			const hecRasEntities = viewer.entities.values.filter(
				(e: any) => e.name === 'hec_ras_frame'
			)
			hecRasEntities.forEach((e: any) => {
				viewer.entities.remove(e)
			})
		} catch (e) {
			console.warn('[HecRasLayer] Error removing entities by name:', e)
		}
	}

	entitiesInitialized = false
	currentImageUrl = null
	// Reset frame URLs to prevent stale references
	frameUrls.value = []
}

// Watch frame index changes and update image
watch(currentFrameIndex, (newIndex) => {
	const url = frameUrls.value[newIndex]
	if (url) {
		currentImageUrl = url
		// Show entity when we have a valid URL
		if (rectangleEntity) {
			rectangleEntity.show = true
		}
	} else if (rectangleEntity) {
		// Hide entity when no valid URL
		rectangleEntity.show = false
	}
})

// Watch for scenarioId prop changes
watch(
	() => props.scenarioId,
	(id) => {
		if (id) {
			clearEntity()
			loadScenario(id)
		}
	}
)

// Watch selected HEC-RAS scenario from store
watch(
	() => simulationStore.selectedHecRasId,
	(id) => {
		if (id) {
			clearEntity()
			loadScenario(id)
		}
	}
)

// Lifecycle
onMounted(() => {
	if (props.scenarioId) {
		loadScenario(props.scenarioId)
	} else if (simulationStore.selectedHecRasId) {
		loadScenario(simulationStore.selectedHecRasId)
	} else {
		loadDefaultScenario()
	}
})

onUnmounted(() => {
	console.log('[HecRasLayer] Unmounting, cleaning up...')
	clearEntity()

	if (cesiumStore.terrainEnabled) {
		cesiumStore.disableTerrain()
	}
})

// Expose for parent components
defineExpose({
	loadScenario,
	scenario,
	currentFrameIndex,
})
</script>

<style scoped lang="scss">
.hec-ras-layer-status {
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
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.error {
		color: var(--color-danger);
		background: rgba(0, 0, 0, 0.7);
		padding: 8px 16px;
		border-radius: 4px;
	}
}
</style>
