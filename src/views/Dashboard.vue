<template>
	<div class="dashboard-layout">
		<!-- Left Sidebar -->
		<transition name="sidebar-left">
			<aside v-show="!isUiHidden" class="sidebar left">
				<KpiBoard />
				<WeatherStrip />
				<LayerControl class="flex-fill" />
			</aside>
		</transition>

		<!-- Right Sidebar -->
		<transition name="sidebar-right">
			<aside v-show="!isUiHidden" class="sidebar right">
				<WaterSituation />
				<CctvPlayer />
				<AiAssistant class="flex-fill" />
			</aside>
		</transition>

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
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useDashboardStore } from '@/stores/dashboard'
import { useOverlayStore } from '@/stores/overlay'
import KpiBoard from '@/components/business/KpiBoard.vue'
import WeatherStrip from '@/components/business/WeatherStrip.vue'
import LayerControl from '@/components/business/LayerControl.vue'
import WaterSituation from '@/components/business/WaterSituation.vue'
import CctvPlayer from '@/components/business/CctvPlayer.vue'
import AiAssistant from '@/components/business/AiAssistant.vue'
import CesiumInfoOverlay from '@/components/cesium/CesiumInfoOverlay.vue'
import VolumeResultContent from '@/components/cesium/results/VolumeResultContent.vue'
import Measure3DResultContent from '@/components/cesium/results/Measure3DResultContent.vue'
import ProfileResultContent from '@/components/cesium/results/ProfileResultContent.vue'
import FloodResultContent from '@/components/cesium/results/FloodResultContent.vue'

const appStore = useAppStore()
const dashboardStore = useDashboardStore()
const overlayStore = useOverlayStore()
const isUiHidden = computed(() => appStore.isUiHidden)

onMounted(() => {
	dashboardStore.fetchData()
})
</script>

<style scoped lang="scss">
.dashboard-layout {
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

	&.flex-fill {
		flex: 1;
		min-height: 0;
	}
}

.flex-fill {
	flex: 1;
	min-height: 0;
}

// Sidebar transitions
.sidebar-left-enter-active,
.sidebar-left-leave-active {
	transition: all 0.3s ease;
}

.sidebar-left-enter-from,
.sidebar-left-leave-to {
	opacity: 0;
	transform: translateX(-20px);
}

.sidebar-right-enter-active,
.sidebar-right-leave-active {
	transition: all 0.3s ease;
}

.sidebar-right-enter-from,
.sidebar-right-leave-to {
	opacity: 0;
	transform: translateX(20px);
}
</style>
