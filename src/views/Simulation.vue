<template>
	<div class="simulation-layout">
		<!-- Flood Visualization Layer (rendered when engine is flood/hydro) -->
		<FloodLayer v-if="isFloodEngine" />

		<!-- Left Sidebar: Config -->
		<transition name="sidebar-left">
			<aside v-show="!isUiHidden" class="sidebar left">
				<SimConfig />
			</aside>
		</transition>

		<!-- Right Sidebar: Results -->
		<transition name="sidebar-right">
			<aside v-show="!isUiHidden" class="sidebar right">
				<SimResult />
			</aside>
		</transition>

		<!-- Analysis Result Panel (3D Tools) -->
		<AnalysisResultPanel />

		<!-- Cesium HTML Overlay (Modern) -->
		<CesiumInfoOverlay :visible="overlayStore.visible" :tool-type="overlayStore.toolType"
			:screen-position="overlayStore.screenPosition" @close="overlayStore.hideOverlay()">
			<VolumeResultContent v-if="overlayStore.toolType === 'volume' && overlayStore.data" :data="overlayStore.data" />
			<Measure3DResultContent v-else-if="overlayStore.toolType === 'measure3d' && overlayStore.data"
				:data="overlayStore.data" />
			<ProfileResultContent v-else-if="overlayStore.toolType === 'profile' && overlayStore.data"
				:data="overlayStore.data" />
			<FloodResultContent v-else-if="overlayStore.toolType === 'flood' && overlayStore.data"
				:data="overlayStore.data" />
		</CesiumInfoOverlay>

		<!-- Bottom Dock: Timeline -->
		<transition name="slide-up">
			<div v-show="!isUiHidden" class="bottom-timeline-container">
				<TimelineControl />
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSimulationStore } from '@/stores/simulation'
import { useOverlayStore } from '@/stores/overlay'
import SimConfig from '@/components/business/SimConfig.vue'
import SimResult from '@/components/business/SimResult.vue'
import TimelineControl from '@/components/common/TimelineControl.vue'
import FloodLayer from '@/components/cesium/FloodLayer.vue'
import AnalysisResultPanel from '@/components/business/AnalysisResultPanel.vue'
import CesiumInfoOverlay from '@/components/cesium/CesiumInfoOverlay.vue'
import VolumeResultContent from '@/components/cesium/results/VolumeResultContent.vue'
import Measure3DResultContent from '@/components/cesium/results/Measure3DResultContent.vue'
import ProfileResultContent from '@/components/cesium/results/ProfileResultContent.vue'
import FloodResultContent from '@/components/cesium/results/FloodResultContent.vue'

const appStore = useAppStore()
const simulationStore = useSimulationStore()
const overlayStore = useOverlayStore()
const isUiHidden = computed(() => appStore.isUiHidden)

// Show flood layer when engine is flood or hydro
const isFloodEngine = computed(() => {
	const engine = simulationStore.state.engine
	return engine === 'flood' || engine === 'hydro'
})

onMounted(() => {
	simulationStore.fetchData()
})
</script>

<style scoped lang="scss">
.simulation-layout {
	display: flex;
	justify-content: space-between;
	height: 100%;
	padding: 20px;
	pointer-events: none;
}

.sidebar {
	width: 340px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	pointer-events: auto;
}

.bottom-timeline-container {
	position: absolute;
	bottom: 110px;
	/* Above dock */
	left: 380px;
	/* Clear left sidebar */
	right: 380px;
	/* Clear right sidebar */
	pointer-events: auto;
}

// Transition for bottom panel
.slide-up-enter-active,
.slide-up-leave-active {
	transition: all 0.3s $ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
	transform: translateY(20px);
	opacity: 0;
}
</style>
