<template>
	<div class="main-layout">
		<!-- Layer 4: Top Ribbon -->
		<TopRibbon />

		<!-- GIS Layer (handles all drawing and analysis tools) -->
		<GISLayer />

		<!-- OSGB 3D Tiles Layer (conditional) -->
		<OSGBLayer v-if="cesiumStore.osgbEnabled" :visible="cesiumStore.osgbEnabled" />

		<!-- BIM 3D Tiles Layer (conditional) -->
		<BIMLayer v-if="cesiumStore.bimEnabled" :visible="cesiumStore.bimEnabled" />

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
import TopRibbon from '@/components/common/TopRibbon.vue';
import GISLayer from '@/components/cesium/GISLayer.vue';
import OSGBLayer from '@/components/cesium/OSGBLayer.vue';
import BIMLayer from '@/components/cesium/BIMLayer.vue';
import BottomDock from '@/layout/BottomDock.vue';
import { useCesiumStore } from '@/stores/cesium';

const cesiumStore = useCesiumStore();
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
	z-index: $z-layer-2;
	pointer-events: none;
	/* Layout container is transparent */
}
</style>
