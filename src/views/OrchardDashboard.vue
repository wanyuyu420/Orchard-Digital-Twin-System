<template>
  <div class="orchard-dashboard">
    <!-- 左侧已由LeftSidebar统一管理 -->

    <!-- 右侧态势面板 - 查询面板显示时隐藏 -->
    <div class="status-bar-right" v-show="!orchardStore.showQueryPanel">
      <div class="status-card">
        <div class="status-icon" style="background: rgba(74, 222, 128, 0.15)">
          <i class="fa-solid fa-tree" style="color: #4ade80"></i>
        </div>
        <div class="status-info">
          <div class="status-value">{{ dashboardStats.treesLabel }}</div>
          <div class="status-label">果树总数</div>
        </div>
      </div>
      <div class="status-card">
        <div class="status-icon" style="background: rgba(251, 146, 60, 0.15)">
          <i class="fa-solid fa-wheat-awn" style="color: #fb923c"></i>
        </div>
        <div class="status-info">
          <div class="status-value">{{ dashboardStats.areaLabel }}</div>
          <div class="status-label">种植面积</div>
        </div>
      </div>
    </div>

    <!-- Cesium地图信息叠加层 -->
    <div class="map-info-overlay">
      <div class="coords-display">
        赣南 · 脐橙核心产区 | 江西省赣州市
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

// 树点数据源随上传状态切换（地1 果园范围 → 上传文件范围）后，重新统计果树总数
watch(
  () => orchardStore.treePointSourceBbox,
  () => {
    orchardStore.refreshMapStats()
  },
)

function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

// 底图统计（OrchardTilesetLayer 加载 trees 后填充），数据就绪前显示占位符
// 树点计数可能因 GeoScene 瞬时不可达而失败，失败时显示占位符而非错误的 0
const dashboardStats = computed(() => ({
  treesLabel: orchardStore.mapStats.treeCountReady
    ? formatNumber(orchardStore.mapStats.totalTrees)
    : '...',
  areaLabel: orchardStore.mapStats.ready
    ? orchardStore.mapStats.areaMu.toFixed(1) + '亩'
    : '...亩',
}))
</script>

<style scoped lang="scss">
.orchard-dashboard {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.status-bar-right {
  position: absolute;
  right: 16px;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: $glass-base;
  backdrop-filter: blur(12px);
  border: 1px solid $border-subtle;
  border-radius: 10px;
  min-width: 160px;

  .status-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .status-info {
    .status-value {
      font-size: 20px;
      font-weight: 700;
      color: $text-main;
      font-family: $font-code;
    }

    .status-label {
      font-size: 11px;
      color: $text-dim;
      margin-top: 1px;
    }
  }
}

.map-info-overlay {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;

  .coords-display {
    padding: 8px 20px;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid $border-subtle;
    border-radius: 20px;
    font-size: 12px;
    color: $text-sub;
  }
}
</style>
