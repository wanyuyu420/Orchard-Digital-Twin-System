<template>
  <div class="app-container">
    <!-- Layer 0: Persistent 3D Map (Cesium) -->
    <CesiumViewer />

    <!-- Orchard 2.0 real 3D Tiles (trees + orchard refined model) -->
    <OrchardTilesetLayer />

    <!-- Orchard 3D Tiles 底部控制条(树透明度/显隐/果园精模懒加载) -->
    <OrchardControlBar />

    <!-- Measure Layer (Persistent across pages) -->
    <MeasureLayer />

    <!-- Draw Layer (Persistent across pages) -->
    <DrawLayer />

    <!-- UI Layers - 脐橙冠层三维解析系统主布局 -->
    <OrchardMainLayout />
  </div>
</template>

<script setup lang="ts">
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import OrchardTilesetLayer from '@/components/cesium/OrchardTilesetLayer.vue'
import OrchardControlBar from '@/components/orchard/OrchardControlBar.vue'
import MeasureLayer from '@/components/cesium/MeasureLayer.vue'
import DrawLayer from '@/components/cesium/DrawLayer.vue'
import OrchardMainLayout from '@/layout/OrchardMainLayout.vue'
import { useOrchardStore } from '@/stores/orchard'
import { onMounted } from 'vue'

const orchardStore = useOrchardStore()

onMounted(() => {
  orchardStore.init()
})
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
