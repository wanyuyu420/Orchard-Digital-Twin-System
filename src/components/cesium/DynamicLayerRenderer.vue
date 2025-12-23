<template>
	<!-- Dynamic Layer Renderer - Factory component for layer types -->
	<template v-for="layer in renderedLayers" :key="layer.id">
		<!-- Point data from API -->
		<GenericPointLayer v-if="layer.layer_type === 'api_point'" :layer="layer" />
		<!-- 3D Tiles (OSGB, BIM) -->
		<GenericTilesetLayer v-else-if="layer.layer_type === '3dtiles'" :layer="layer" />
		<!-- Imagery (DOM, WMS) -->
		<GenericImageryLayer v-else-if="layer.layer_type === 'imagery'" :layer="layer" />
	</template>
</template>

<script setup lang="ts">
/**
 * DynamicLayerRenderer - Factory component that renders layers based on their type
 * This component replaces hardcoded layer mounting in MainLayout
 */
import { computed, onMounted } from 'vue'
import { useLayerStore } from '@/stores/layers'
import GenericPointLayer from './GenericPointLayer.vue'
import GenericTilesetLayer from './GenericTilesetLayer.vue'
import GenericImageryLayer from './GenericImageryLayer.vue'

const layerStore = useLayerStore()

// Fetch layers on mount
onMounted(async () => {
	await layerStore.fetchLayers()
})

// Render api_point, 3dtiles, and imagery layers (terrain handled separately)
const renderedLayers = computed(() =>
	layerStore.layers.filter(l =>
		l.is_enabled && ['api_point', '3dtiles', 'imagery'].includes(l.layer_type)
	)
)
</script>
