<template>
  <div class="app-container">
    <!-- Layer 0: Persistent 3D Map -->
    <CesiumViewer />

    <!-- Measure Layer (Persistent across pages) -->
    <MeasureLayer />

    <!-- Draw Layer (Persistent across pages) -->
    <DrawLayer />

    <!-- UI Layers -->
    <MainLayout />
  </div>
</template>

<script setup lang="ts">
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import MeasureLayer from '@/components/cesium/MeasureLayer.vue'
import DrawLayer from '@/components/cesium/DrawLayer.vue'
import MainLayout from '@/layout/MainLayout.vue'
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
