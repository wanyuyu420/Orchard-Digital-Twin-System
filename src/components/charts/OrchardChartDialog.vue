<template>
  <transition name="slide-right">
    <div v-if="orchardStore.showChartDialog" class="chart-dialog glass-panel">
      <!-- 头部 -->
      <div class="panel-header">
        <span class="panel-title">冠层图表统计</span>
        <button class="close-btn" @click="closeDialog">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 图表类型切换 -->
      <div class="chart-tabs">
        <button
          v-for="tab in chartTabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: chartType === tab.key }"
          @click="chartType = tab.key"
        >
          <i :class="tab.icon"></i>
          {{ tab.label }}
        </button>
      </div>

      <!-- 指标切换 -->
      <div class="metric-tabs">
        <button
          v-for="m in availableMetrics"
          :key="m.key"
          class="metric-btn"
          :class="{ active: selectedMetric === m.key }"
          @click="selectedMetric = m.key"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- 主体内容 -->
      <div class="panel-body">
        <!-- 错误状态 -->
        <div v-if="orchardStore.chartError" class="state-box error-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>{{ orchardStore.chartError }}</p>
          <el-button size="small" @click="retry">重试</el-button>
        </div>

        <!-- 加载中（首次） -->
        <div v-else-if="isFirstLoading" class="state-box loading-state">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>

        <!-- 无数据 -->
        <div v-else-if="!currentMetric" class="state-box empty-state">
          <i class="fa-solid fa-chart-simple"></i>
          <span>暂无数据</span>
        </div>

        <!-- 图表 -->
        <template v-else>
          <BaseChart
            :options="chartOptions"
            height="300px"
            :loading="orchardStore.chartLoading"
          />
          <div class="chart-footer">
            <span class="update-time">
              <i class="fa-solid fa-clock"></i>
              {{ lastUpdateTime }}
            </span>
            <span class="metric-value">
              均值: <b>{{ currentMetric.avg }}</b> {{ currentMetric.unit }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { useOrchardStore } from '@/stores/orchard'
import type { ChartMetricData, ChartViewType } from '@/types/orchard'
import {
  NEON_CYAN, NEON_BLUE, NEON_PURPLE, NEON_GREEN,
  NEON_YELLOW, NEON_ORANGE, TEXT_SECONDARY, GRID_LINE,
  CHART_COLORS, createGradient,
} from './theme'

const orchardStore = useOrchardStore()

const chartType = ref<ChartViewType>('bar')
const selectedMetric = ref<string>('canopyVolume')
const isFirstLoading = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

const chartTabs = [
  { key: 'bar' as ChartViewType, label: '柱状图', icon: 'fa-solid fa-chart-column' },
  { key: 'pie' as ChartViewType, label: '饼状图', icon: 'fa-solid fa-chart-pie' },
  { key: 'line' as ChartViewType, label: '折线图', icon: 'fa-solid fa-chart-line' },
]

const availableMetrics = computed<{ key: string; label: string }[]>(() => {
  if (!orchardStore.chartData?.metrics) return []
  return orchardStore.chartData.metrics.map((m: ChartMetricData) => ({
    key: m.key,
    label: m.label,
  }))
})

const currentMetric = computed<ChartMetricData | undefined>(() => {
  return orchardStore.chartData?.metrics?.find(
    (m: ChartMetricData) => m.key === selectedMetric.value
  )
})

const lastUpdateTime = computed(() => {
  if (!orchardStore.chartData?.timestamp) return ''
  const d = new Date(orchardStore.chartData.timestamp)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
})

const chartOptions = computed<EChartsOption>(() => {
  const metric = currentMetric.value
  if (!metric) return {}

  const unit = metric.unit

  if (chartType.value === 'bar') {
    const dist = metric.distribution || []
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params
          const item = p as { name: string; value: number }
          return `${item.name}<br/>数量: <b>${item.value}</b> 棵`
        },
      },
      grid: { left: 60, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: dist.map((d) => d.name),
        axisLabel: { color: TEXT_SECONDARY, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: '数量(棵)',
        nameTextStyle: { color: TEXT_SECONDARY, fontSize: 11 },
        axisLabel: { color: TEXT_SECONDARY, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: dist.map((d) => ({
            value: d.value,
            itemStyle: {
              color: NEON_CYAN,
              borderRadius: [4, 4, 0, 0] as [number, number, number, number],
            },
          })),
          barWidth: '55%',
          animationDuration: 400,
        },
      ],
    } as EChartsOption
  }

  if (chartType.value === 'pie') {
    const pie = metric.pieData || []
    const total = pie.reduce((s, d) => s + d.value, 0)
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number }
          return `${p.name}<br/>${p.value} 棵 (${p.percent}%)`
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: TEXT_SECONDARY, fontSize: 12 },
        itemWidth: 12,
        itemHeight: 12,
      },
      series: [
        {
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['40%', '55%'],
          itemStyle: {
            borderRadius: 4,
            borderColor: '#111827',
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold' as const },
          },
          data: pie.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          })),
        },
      ],
    } as EChartsOption
  }

  if (chartType.value === 'line') {
    const trend = metric.trend || []
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params
          const item = p as { name: string; value: number }
          return `${item.name}<br/>${metric.label}: <b>${item.value}</b> ${unit}`
        },
      },
      grid: { left: 60, right: 20, bottom: '12%', top: 20 },
      xAxis: {
        type: 'category',
        data: trend.map((d) => d.time),
        boundaryGap: false,
        axisLabel: { color: TEXT_SECONDARY, fontSize: 10, interval: 3 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: TEXT_SECONDARY, fontSize: 11 },
        splitLine: { lineStyle: { color: GRID_LINE, type: 'dashed' as const } },
        axisLabel: { color: TEXT_SECONDARY, fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: NEON_CYAN, width: 2 },
          areaStyle: {
            color: createGradient(NEON_CYAN + '40', NEON_BLUE + '05'),
          },
          data: trend.map((d) => d.value),
          animationDuration: 300,
        },
      ],
    } as EChartsOption
  }

  return {}
})

async function fetchData() {
  await orchardStore.fetchChartData()
  isFirstLoading.value = false
}

function startPolling() {
  stopPolling()
  fetchData()
  pollTimer = setInterval(() => {
    orchardStore.fetchChartData()
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function retry() {
  fetchData()
}

function closeDialog() {
  orchardStore.showChartDialog = false
}

// 切换指标时，如果折线图没有数据，自动切回柱状图
watch(selectedMetric, () => {
  const metric = currentMetric.value
  if (metric && chartType.value === 'line' && (!metric.trend || metric.trend.length === 0)) {
    chartType.value = 'bar'
  }
})

onMounted(() => {
  if (orchardStore.showChartDialog) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})

// 监听显隐
watch(
  () => orchardStore.showChartDialog,
  (show) => {
    if (show) {
      startPolling()
    } else {
      stopPolling()
    }
  }
)
</script>

<style scoped lang="scss">
.chart-dialog {
  position: absolute;
  right: 24px;
  top: 80px;
  width: 480px;
  max-height: calc(100vh - 120px);
  z-index: $z-layer-7;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .close-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover { color: $alert-red; }
  }
}

.chart-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 18px 0;
  border-bottom: 1px solid $border-subtle;

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: $text-sub;
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    transition: all 0.2s;

    i { font-size: 14px; }

    &:hover {
      color: $text-main;
      background: rgba(255, 255, 255, 0.05);
    }

    &.active {
      color: $neon-cyan;
      background: rgba($neon-cyan, 0.08);
      border-bottom: 2px solid $neon-cyan;
    }
  }
}

.metric-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 18px;

  .metric-btn {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid $border-subtle;
    border-radius: 6px;
    background: transparent;
    color: $text-sub;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: $text-main;
      border-color: rgba(255, 255, 255, 0.3);
    }

    &.active {
      color: $neon-cyan;
      border-color: $neon-cyan;
      background: rgba($neon-cyan, 0.08);
    }
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px 18px;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;

  i {
    font-size: 32px;
  }

  p {
    margin: 0;
    color: $text-sub;
    font-size: 13px;
  }

  span {
    color: $text-sub;
    font-size: 13px;
  }

  &.error-state i { color: $alert-red; }
  &.loading-state i { color: $neon-cyan; }
  &.empty-state i { color: $text-dim; }
}

.chart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid $border-subtle;

  .update-time {
    font-size: 11px;
    color: $text-dim;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .metric-value {
    font-size: 12px;
    color: $text-sub;

    b { color: $neon-cyan; }
  }
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s $ease-out;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
