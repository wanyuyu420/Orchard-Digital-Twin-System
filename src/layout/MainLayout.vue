<template>
	<div class="main-layout">
		<!-- Layer 4: Top Ribbon -->
		<TopRibbon />

		<!-- GIS Layer (handles all drawing and analysis tools) -->
		<GISLayer />

		<!-- OSGB 3D Tiles Layer (conditional) -->
		<OSGBLayer v-if="cesiumStore.osgbEnabled" :visible="cesiumStore.osgbEnabled" :url="projectConfig.osgb.url"
			:ellipsoid-offset="projectConfig.osgb.ellipsoidOffset" :terrain-offset="projectConfig.osgb.terrainOffset" />

		<!-- BIM 3D Tiles Layer (conditional) -->
		<BIMLayer v-if="cesiumStore.bimEnabled" :visible="cesiumStore.bimEnabled" :url="projectConfig.bim.url"
			:alignment="projectConfig.bim.alignment" />

		<!-- Stations Layer -->
		<StationLayer />

		<!-- Video Points Layer -->
		<VideoLayer />

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
import OSGBLayer from '@/components/cesium/OSGBLayer.vue'
import BIMLayer from '@/components/cesium/BIMLayer.vue'
import StationLayer from '@/components/cesium/StationLayer.vue'
import VideoLayer from '@/components/cesium/VideoLayer.vue'
import BottomDock from '@/layout/BottomDock.vue'
import { useCesiumStore } from '@/stores/cesium'
import { projectConfig } from '@/config/layers'

const cesiumStore = useCesiumStore()
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
