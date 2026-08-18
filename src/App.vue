<template>
  <div class="app-container">
    <!-- Layer 0: Persistent 3D Map (Cesium) -->
    <CesiumViewer />

    <!-- Orchard 2.0 real 3D Tiles (trees + orchard refined model) -->
    <OrchardTilesetLayer />

    <!-- 上传地块（地2）三维场景：点击侧边栏"已完成"任务卡片后加载 -->
    <UploadPlotLayer />

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
import UploadPlotLayer from '@/components/cesium/UploadPlotLayer.vue'
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
