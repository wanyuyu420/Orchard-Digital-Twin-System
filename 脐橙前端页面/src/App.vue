<template>
  <div class="app-container">
    <!-- Layer 0: Persistent 3D Map (Cesium) -->
    <CesiumViewer />

    <!-- Orchard 3D Base Model (replaces online tile imagery) -->
    <OrchardBaseModel />

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
import OrchardBaseModel from '@/components/cesium/OrchardBaseModel.vue'
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
