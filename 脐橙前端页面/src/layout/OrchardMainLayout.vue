<template>
  <div class="main-layout">
    <!-- Layer 4: Top Menu Bar -->
    <TopMenuBar />

    <!-- Layer 5: Left Sidebar (Google Maps style) -->
    <LeftSidebar />

    <!-- GIS Layer (handles drawing tools) -->
    <GISLayer />

    <!-- Dynamic Layers -->
    <DynamicLayerRenderer />

    <!-- Layer 2: UI Layer (Router View) -->
    <div class="ui-layer">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <!-- 查询级联面板 -->
    <QueryPanel />
    <QueryResultPanel />
    <DetailPanel />

    <!-- 颜色渲染设置 -->
    <ColorRenderSettings />

    <!-- 分析结果窗口 -->
    <AnalysisResultWindow />

    <!-- 施肥方案窗口 -->
    <FertilizationWindow />

    <!-- 图层详细信息面板 -->
    <LayerDetailPanel />
  </div>
</template>

<script setup lang="ts">
import TopMenuBar from '@/layout/TopMenuBar.vue'
import LeftSidebar from '@/layout/LeftSidebar.vue'
import GISLayer from '@/components/cesium/GISLayer.vue'
import DynamicLayerRenderer from '@/components/cesium/DynamicLayerRenderer.vue'
import QueryPanel from '@/components/orchard/QueryPanel.vue'
import QueryResultPanel from '@/components/orchard/QueryResultPanel.vue'
import DetailPanel from '@/components/orchard/DetailPanel.vue'
import ColorRenderSettings from '@/components/orchard/ColorRenderSettings.vue'
import AnalysisResultWindow from '@/components/orchard/AnalysisResultWindow.vue'
import FertilizationWindow from '@/components/orchard/FertilizationWindow.vue'
import LayerDetailPanel from '@/components/orchard/LayerDetailPanel.vue'
</script>

<style scoped lang="scss">
.main-layout {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.ui-layer {
  position: absolute;
  top: 50px;
  left: 0;
  width: 100%;
  height: calc(100% - 50px);
  z-index: $z-layer-2;
  pointer-events: none;
}
</style>
