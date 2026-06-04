<template>
	<div class="meteo-layout">
		<!-- 卷帘地图层 (独立Cesium系统) -->
		<MeteoSplitLayer ref="splitLayerRef" />

		<!-- Left Sidebar: Config -->
		<transition name="sidebar-left">
			<aside v-show="!isUiHidden" class="sidebar left">
				<MeteoConfig />
			</aside>
		</transition>

		<!-- Right Sidebar: Control Center -->
		<transition name="sidebar-right">
			<aside v-show="!isUiHidden" class="sidebar right">
				<MeteoLayerControl @sync-main="handleSyncMain" @reset-view="handleResetView" @reset-split="handleResetSplit"
					@toggle-radar="handleToggleRadar" @toggle-rainfall="handleToggleRainfall"
					@rainfall-mode="handleRainfallMode" />
			</aside>
		</transition>

		<!-- Timeline (Shared) -->
		<transition name="slide-up">
			<div v-show="!isUiHidden" class="bottom-timeline-container">
				<TimelineControl />
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import MeteoConfig from '@/components/business/MeteoConfig.vue'
import MeteoLayerControl from '@/components/business/MeteoLayerControl.vue'
import MeteoSplitLayer from '@/components/business/MeteoSplitLayer.vue'
import TimelineControl from '@/components/common/TimelineControl.vue'

const appStore = useAppStore()
const isUiHidden = computed(() => appStore.isUiHidden)

// 获取MeteoSplitLayer组件引用
const splitLayerRef = ref<InstanceType<typeof MeteoSplitLayer> | null>(null)

// 控制面板事件处理
function handleSyncMain() {
	splitLayerRef.value?.syncFromMain()
}

function handleResetView() {
	splitLayerRef.value?.resetView()
}

function handleResetSplit() {
	splitLayerRef.value?.resetSplit()
}

function handleToggleRadar(show: boolean) {
	splitLayerRef.value?.toggleRadarLayer(show)
}

function handleToggleRainfall(show: boolean) {
	splitLayerRef.value?.toggleRainfallLayer(show)
}

function handleRainfallMode(mode: 'raster' | 'particle') {
	splitLayerRef.value?.setRainfallMode(mode)
}
</script>

<style scoped lang="scss">
.meteo-layout {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	justify-content: space-between;
	padding: 20px;
	pointer-events: none;
}

.sidebar {
	width: 340px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	pointer-events: auto;
	z-index: 10;
}

.bottom-timeline-container {
	position: absolute;
	bottom: 110px;
	left: 380px;
	right: 380px;
	pointer-events: auto;
	z-index: 10;
}

.slide-up-enter-active,
.slide-up-leave-active {
	transition: all 0.3s $ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
	transform: translateY(20px);
	opacity: 0;
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
