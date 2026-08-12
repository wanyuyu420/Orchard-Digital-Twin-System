<template>
  <div class="canopy-analysis">
    <!-- 冠层分析信息面板 -->
    <div class="canopy-info-panel glass-panel" v-if="orchardStore.tsomQueryResult">
      <div class="panel-header">冠层参数概览</div>
      <div class="canopy-stats">
        <div class="canopy-stat">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.statistics.averageCanopyHeight.toFixed(2) }}m</span>
          <span class="stat-label">平均冠高</span>
        </div>
        <div class="canopy-stat">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.statistics.averageCanopyVolume.toFixed(2) }}m³</span>
          <span class="stat-label">平均体积</span>
        </div>
        <div class="canopy-stat">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.statistics.averageLai.toFixed(2) }}</span>
          <span class="stat-label">平均LAI</span>
        </div>
      </div>
      <div class="canopy-health">
        <div class="health-segment healthy" :style="{ width: healthyPercent + '%' }">
          {{ orchardStore.tsomQueryResult.statistics.healthyCount }}
        </div>
        <div class="health-segment warning" :style="{ width: warningPercent + '%' }">
          {{ orchardStore.tsomQueryResult.statistics.warningCount }}
        </div>
        <div class="health-segment critical" :style="{ width: criticalPercent + '%' }">
          {{ orchardStore.tsomQueryResult.statistics.criticalCount }}
        </div>
      </div>
    </div>

    <!-- 无数据提示 - 切换页面时显示1秒后自动消失 -->
    <div v-if="showHint && !orchardStore.tsomQueryResult" class="no-data-hint glass-panel fade-out">
      <i class="fa-solid fa-cubes"></i>
      <p>使用绘制工具选择果树区域</p>
      <p class="sub-hint">矩形 · 圆形 · 多边形</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

// 控制提示是否显示
const showHint = ref(true)

onMounted(() => {
  // 页面加载后1秒自动隐藏提示
  setTimeout(() => {
    showHint.value = false
  }, 1000)
})

const total = computed(() => {
  const s = orchardStore.tsomQueryResult?.statistics
  if (!s) return 1
  return s.healthyCount + s.warningCount + s.criticalCount || 1
})

const healthyPercent = computed(() => {
  const s = orchardStore.tsomQueryResult?.statistics
  return s ? (s.healthyCount / total.value) * 100 : 0
})

const warningPercent = computed(() => {
  const s = orchardStore.tsomQueryResult?.statistics
  return s ? (s.warningCount / total.value) * 100 : 0
})

const criticalPercent = computed(() => {
  const s = orchardStore.tsomQueryResult?.statistics
  return s ? (s.criticalCount / total.value) * 100 : 0
})
</script>

<style scoped lang="scss">
.canopy-analysis {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.canopy-info-panel {
  position: absolute;
  right: 16px;
  bottom: 80px;
  width: 280px;
  pointer-events: auto;

  .panel-header {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: $text-main;
    border-bottom: 1px solid $border-subtle;
  }
}

.canopy-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 12px;
}

.canopy-stat {
  text-align: center;
  padding: 8px 4px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: $orchard-orange;
    font-family: $font-code;
  }

  .stat-label {
    font-size: 10px;
    color: $text-dim;
    display: block;
    margin-top: 2px;
  }
}

.canopy-health {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  margin: 0 12px 12px;

  .health-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #fff;
    min-width: 20px;

    &.healthy { background: $success-green; }
    &.warning { background: $warn-yellow; }
    &.critical { background: $alert-red; }
  }
}

.no-data-hint {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 30px 50px;
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: fadeOut 1.2s ease-out 1s forwards;

  i {
    font-size: 40px;
    color: #fb923c;
    margin-bottom: 12px;
    display: block;
  }

  p {
    font-size: 14px;
    color: #ffffff;
    font-weight: 500;
  }

  .sub-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    visibility: hidden;
  }
}
</style>
