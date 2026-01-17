<template>
	<div class="main-layout">
		<!-- Layer 4: Top Ribbon -->
		<TopRibbon />

		<!-- GIS Layer (handles all drawing and analysis tools) -->
		<GISLayer />

		<!-- Profile analysis chart (2D result) -->
		<ProfileChart v-if="gisStore.analysisResultType === 'profile' && !!gisStore.analysisResultData"
			:result="(gisStore.analysisResultData as ProfileAnalysisResult) || null" @close="gisStore.clearAnalysisResult()"
			@export-csv="exportProfileCsv" />

		<!-- Flood analysis control panel (water level + stats) -->
		<FloodControlPanel v-if="gisStore.analysisResultType === 'flood' && !!gisStore.analysisResultData"
			:model-value="(gisStore.analysisResultData as any)?.waterLevel ?? 0" :data="gisStore.analysisResultData"
			@close="gisStore.clearAnalysisResult()" />

		<!-- Volume diff chart (two-phase development fixture) -->
		<VolumeDiffChart v-if="gisStore.analysisResultType === 'volume' && !!gisStore.analysisResultData"
			:data="gisStore.analysisResultData" @close="gisStore.clearAnalysisResult()" />

		<!-- Dynamic Layers (data-driven: 3D Tiles, Point Data, etc.) -->
		<DynamicLayerRenderer />

		<!-- Layer 2: UI Layer (Router View) -->
		<div class="ui-layer">
			<router-view v-slot="{ Component }">
				<transition name="fade" mode="out-in">
					<component :is="Component" />
				</transition>
			</router-view>
		</div>

		<!-- Layer 6: Bottom Dock -->
		<BottomDock />
	</div>
</template>

<script setup lang="ts">
import TopRibbon from '@/components/common/TopRibbon.vue'
import GISLayer from '@/components/cesium/GISLayer.vue'
import DynamicLayerRenderer from '@/components/cesium/DynamicLayerRenderer.vue'
import BottomDock from '@/layout/BottomDock.vue'
import ProfileChart from '@/components/cesium/ProfileChart.vue'
import FloodControlPanel from '@/components/cesium/FloodControlPanel.vue'
import VolumeDiffChart from '@/components/cesium/VolumeDiffChart.vue'
import { useGISStore } from '@/stores/gis'
import type { ProfileAnalysisResult } from '@/cesium/gis/tools/ProfileTool'

const gisStore = useGISStore()

function exportProfileCsv() {
	const result = gisStore.analysisResultData as ProfileAnalysisResult | null
	if (!result?.samples?.length) return

	const header = ['distance_m', 'elevation_m', 'longitude', 'latitude'].join(',')
	const rows = result.samples.map((s) => {
		// Avoid locale formatting; keep CSV machine-readable
		return [s.distance, s.elevation, s.longitude, s.latitude].join(',')
	})
	const csv = [header, ...rows].join('\n')

	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `profile_${new Date().toISOString().slice(0, 10)}.csv`
	link.click()
	URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.main-layout {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 10;
	/* Ensure above Cesium */
	pointer-events: none;
	/* Let clicks pass through to Cesium */
}

.ui-layer {
	position: absolute;
	top: 70px;
	/* Ribbon Height */
	left: 0;
	width: 100%;
	height: calc(100% - 70px);
	/* Ribbon Height */
	z-index: $z-layer-2;
	pointer-events: none;
	/* Layout container is transparent */
}
</style>
