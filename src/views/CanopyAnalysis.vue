<template>
  <div class="canopy-analysis">
    <!-- 右下角面板组：底图冠层数据框 + 查询结果概览，纵向排开互不遮挡 -->
    <div class="canopy-dock">
      <!-- 树点冠层数据框（后端范围内树点，数据源随上传状态切换，独立于查询） -->
      <div class="basemap-canopy-panel glass-panel" v-if="basemapOverview">
        <div class="panel-header">
          <span>树点冠层数据</span>
          <span class="range-badge" :title="sourceLabel">{{ sourceLabel }}</span>
          <button class="refresh-btn" @click="loadBasemapOverview" title="重新读取数据">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
        <div class="basemap-summary">
          <div class="total-row">
            <span class="total-value">{{ basemapOverview.totalTrees }}</span>
            <span class="total-label">范围内树数 · 棵</span>
          </div>
          <div class="metric-block" v-for="m in basemapOverview.metrics" :key="m.key">
            <div class="metric-name">{{ m.label }} <span class="metric-unit">({{ m.unit }})</span></div>
            <div class="metric-line">
              <span class="metric-k">平均</span>
              <span class="metric-v">{{ m.avg }}</span>
            </div>
            <div class="metric-line">
              <span class="metric-k">最小</span>
              <span class="metric-v">{{ m.min }}</span>
              <span class="metric-k">最大</span>
              <span class="metric-v">{{ m.max }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据未就绪 -->
      <div class="basemap-canopy-panel glass-panel basemap-status" v-else>
        <div class="panel-header">
          <span>树点冠层数据</span>
          <span class="range-badge">{{ sourceLabel }}</span>
        </div>
        <div class="basemap-status-body">
          <i class="fa-solid fa-tree"></i>
          <p>{{ basemapStatus }}</p>
          <button class="refresh-btn" @click="loadBasemapOverview">
            <i class="fa-solid fa-rotate-right"></i> 重新读取
          </button>
        </div>
      </div>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { fetchBasemapCanopyOverview } from '@/api/orchard'
import type { BasemapCanopyOverview } from '@/types/orchard'

const orchardStore = useOrchardStore()

// 控制提示是否显示
const showHint = ref(true)

// 树点数据源（地1 果园范围 ↔ 上传文件范围，随上传状态切换）
const sourceBbox = computed(() => orchardStore.treePointSourceBbox)
const sourceLabel = computed(() => orchardStore.treePointSourceLabel)

// ---- 树点冠层数据框（数据来自后端范围内树点，独立于查询） ----
const basemapOverview = ref<BasemapCanopyOverview | null>(null)
const basemapStatus = ref(`正在查询${sourceLabel.value}树点…`)
const basemapLoading = ref(false)
let disposed = false

/** 查询一次后端树点冠层数据（/orange/trees/filter + 当前数据源范围），失败给出错误原因 */
async function loadBasemapOverview() {
  if (basemapLoading.value) return
  basemapLoading.value = true
  basemapStatus.value = `正在查询${sourceLabel.value}树点…`
  try {
    const data = await fetchBasemapCanopyOverview(sourceBbox.value)
    if (disposed) return
    basemapOverview.value = data
    console.log(`[CanopyAnalysis] ${sourceLabel.value}树点冠层数据已读取: ${data.totalTrees} 棵树`)
  } catch (e: any) {
    if (disposed) return
    const detail = e?.response?.data?.detail ?? e?.message
    console.warn('[CanopyAnalysis] 查询树点冠层数据失败:', e)
    basemapStatus.value = detail
      ? `${sourceLabel.value}树点查询失败：${detail}`
      : `${sourceLabel.value}树点查询失败，请确认后端服务（端口 8000）已启动后点「重新读取」`
  } finally {
    basemapLoading.value = false
  }
}

onMounted(() => {
  loadBasemapOverview()
  // 页面加载后1秒自动隐藏提示
  setTimeout(() => {
    showHint.value = false
  }, 1000)
})

// 数据源随上传状态切换（地1 → 上传文件）后自动重查
watch(sourceBbox, () => {
  loadBasemapOverview()
})

onUnmounted(() => {
  disposed = true
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

/* 右下角面板组：底图冠层数据框 + 查询结果概览 纵向排开 */
.canopy-dock {
  position: absolute;
  right: 16px;
  bottom: 80px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
  pointer-events: auto;

  > * {
    flex-shrink: 0;
  }
}

.canopy-info-panel {
  position: relative;
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

/* 底图冠层数据框 */
.basemap-canopy-panel {
  position: relative;
  width: 280px;
  pointer-events: auto;

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: $text-main;
    border-bottom: 1px solid $border-subtle;
  }

  .refresh-btn {
    background: none;
    border: none;
    color: $text-dim;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.2s;

    &:hover {
      color: $neon-cyan;
    }
  }

  /* 数据源范围标注（地1 果园范围 / 上传文件名） */
  .range-badge {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 8px;
    font-size: 10px;
    font-weight: 400;
    color: $text-dim;
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.25);
    border-radius: 8px;
    padding: 2px 6px;
  }
}

.basemap-summary {
  padding: 12px;

  .total-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 8px;
    background: rgba(251, 146, 60, 0.08);
    border-radius: 8px;

    .total-value {
      font-size: 24px;
      font-weight: 700;
      color: $orchard-orange;
      font-family: $font-code;
    }

    .total-label {
      font-size: 11px;
      color: $text-dim;
    }
  }

  .metric-block {
    padding: 8px;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 8px;
    margin-bottom: 6px;

    .metric-name {
      font-size: 12px;
      font-weight: 600;
      color: $text-sub;
      margin-bottom: 6px;

      .metric-unit {
        color: $text-dim;
        font-weight: 400;
      }
    }

    .metric-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      margin-bottom: 2px;

      .metric-k {
        color: $text-dim;
        min-width: 24px;
      }

      .metric-v {
        color: $neon-cyan;
        font-family: $font-code;
        font-weight: 600;
        margin-right: 10px;
      }
    }
  }
}

.basemap-status-body {
  padding: 20px 16px;
  text-align: center;

  i {
    font-size: 28px;
    color: $text-dim;
    margin-bottom: 10px;
    display: block;
  }

  p {
    font-size: 12px;
    color: $text-dim;
    line-height: 1.5;
    margin-bottom: 10px;
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
