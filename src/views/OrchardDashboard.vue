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
import { ref, onMounted, onUnmounted } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { apiClient } from '@/api/client'

const orchardStore = useOrchardStore()

interface DashboardStats {
  totalTrees: number
  totalArea: number
  timestamp: string
}

const dashboardStats = ref<{ treesLabel: string; areaLabel: string }>({
  treesLabel: '...',
  areaLabel: '...亩',
})

let pollTimer: ReturnType<typeof setInterval> | null = null

function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function formatArea(n: number): string {
  return n.toFixed(1) + '亩'
}

async function fetchDashboardStats() {
  try {
    const res = await apiClient.get<DashboardStats>('/orchard/dashboard-stats')
    const data = res.data
    dashboardStats.value = {
      treesLabel: formatNumber(Math.round(data.totalTrees)),
      areaLabel: formatArea(data.totalArea),
    }
  } catch (err) {
    console.error('[OrchardDashboard] Failed to fetch stats:', err)
  }
}

onMounted(() => {
  fetchDashboardStats()
  pollTimer = setInterval(fetchDashboardStats, 10000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
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
