<template>
	<div class="main-layout">
		<!-- Layer 4: Top Ribbon -->
		<TopRibbon />

		<!-- GIS Layer (handles all drawing and analysis tools) -->
		<GISLayer />

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
