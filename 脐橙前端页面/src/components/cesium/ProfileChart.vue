<template>
  <div class="profile-chart-container" v-if="visible">
    <div class="chart-header">
      <h3>📊 地形剖面图</h3>
      <div class="chart-actions">
        <button class="icon-btn" @click="exportImage" title="导出图片">
          <span>📷</span>
        </button>
        <button class="icon-btn" @click="exportCSV" title="导出CSV">
          <span>📄</span>
        </button>
        <button class="icon-btn close" @click="handleClose" title="关闭">
          <span>✕</span>
        </button>
      </div>
    </div>

    <div class="chart-stats">
      <div class="stat-item">
        <span class="stat-label">总长度</span>
        <span class="stat-value">{{ formatDistance(result?.totalLength || 0) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最高点</span>
        <span class="stat-value">{{ (result?.maxElevation || 0).toFixed(1) }} m</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最低点</span>
        <span class="stat-value">{{ (result?.minElevation || 0).toFixed(1) }} m</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">高差</span>
        <span class="stat-value"
          >{{ ((result?.maxElevation || 0) - (result?.minElevation || 0)).toFixed(1) }} m</span
        >
      </div>
    </div>

    <div ref="chartRef" class="chart-area"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ProfileAnalysisResult } from '@/cesium/gis/tools/ProfileTool'

// Register ECharts components
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent,
  LineChart,
  CanvasRenderer,
])

interface Props {
  result: ProfileAnalysisResult | null
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'export-csv'): void
  (
    e: 'hover',
    sample: { distance: number; elevation: number; longitude: number; latitude: number } | null
  ): void
}>()

const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  if (resizeObserver && chartRef.value) {
    resizeObserver.unobserve(chartRef.value)
    resizeObserver = null
  }
  if (chartInstance.value) {
    chartInstance.value.dispose()
    chartInstance.value = null
  }
})

watch(
  () => props.result,
  (newResult) => {
    if (newResult && chartInstance.value) {
      updateChart(newResult)
    }
  },
  { deep: true }
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return

    // When the component is mounted but DOM was gated by v-if, chartRef is not
    // available during onMounted. Re-init on first show.
    nextTick(() => {
      if (!chartInstance.value) {
        initChart()
        return
      }
      chartInstance.value.resize()
      if (props.result) updateChart(props.result)
    })
  }
)

function initChart() {
  if (!chartRef.value) return

  // Avoid double-init
  if (chartInstance.value) return

  chartInstance.value = echarts.init(chartRef.value, 'dark')

  // Handle resize
  resizeObserver = new ResizeObserver(() => {
    chartInstance.value?.resize()
  })
  resizeObserver.observe(chartRef.value)

  // Set base options
  chartInstance.value.setOption({
    backgroundColor: 'transparent',
    grid: {
      left: 60,
      right: 30,
      top: 20,
      bottom: 60,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      borderColor: 'var(--accent-primary)',
      textStyle: {
        color: '#fff',
      },
      formatter: (params: any) => {
        const data = params[0]
        if (!data) return ''
        const sample = props.result?.samples[data.dataIndex]
        if (!sample) return ''
        return `
          <div style="padding: 4px 8px;">
            <div style="color: var(--accent-primary); font-weight: bold;">距离: ${formatDistance(sample.distance)}</div>
            <div>高程: ${sample.elevation.toFixed(2)} m</div>
            <div style="font-size: 11px; color: #888;">
              ${sample.longitude.toFixed(6)}°, ${sample.latitude.toFixed(6)}°
            </div>
          </div>
        `
      },
    },
    xAxis: {
      type: 'value',
      name: '距离',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        color: '#aaa',
      },
      axisLabel: {
        formatter: (value: number) => formatDistance(value),
        color: '#aaa',
      },
      axisLine: {
        lineStyle: { color: '#555' },
      },
      splitLine: {
        lineStyle: { color: '#333' },
      },
    },
    yAxis: {
      type: 'value',
      name: '高程 (m)',
      nameLocation: 'middle',
      nameGap: 45,
      nameTextStyle: {
        color: '#aaa',
      },
      axisLabel: {
        color: '#aaa',
      },
      axisLine: {
        lineStyle: { color: '#555' },
      },
      splitLine: {
        lineStyle: { color: '#333' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 20,
        bottom: 5,
        borderColor: 'transparent',
        backgroundColor: 'rgba(255,255,255,0.05)',
        fillerColor: 'rgba(0, 255, 255, 0.2)',
        handleStyle: {
          color: 'var(--accent-primary)',
        },
      },
    ],
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#00FFFF',
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 255, 255, 0.4)' },
            { offset: 1, color: 'rgba(0, 255, 255, 0.05)' },
          ]),
        },
        data: [],
      },
    ],
  })

  // Hover event
  chartInstance.value.on('mouseover', (params: any) => {
    if (params.dataIndex !== undefined && props.result) {
      const sample = props.result.samples[params.dataIndex]
      if (sample) {
        emit('hover', {
          distance: sample.distance,
          elevation: sample.elevation,
          longitude: sample.longitude,
          latitude: sample.latitude,
        })
      }
    }
  })

  chartInstance.value.on('mouseout', () => {
    emit('hover', null)
  })

  // Initial update if result exists
  if (props.result) {
    updateChart(props.result)
  }
}

function updateChart(result: ProfileAnalysisResult) {
  if (!chartInstance.value) return

  const data = result.samples.map((s) => [s.distance, s.elevation])

  chartInstance.value.setOption({
    series: [
      {
        data: data,
      },
    ],
  })
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

function exportImage() {
  if (!chartInstance.value) return

  const url = chartInstance.value.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#1a1a2e',
  })

  const link = document.createElement('a')
  link.href = url
  link.download = `profile_${new Date().toISOString().slice(0, 10)}.png`
  link.click()
}

function exportCSV() {
  emit('export-csv')
}

function handleClose() {
  emit('close')
}
</script>

<style scoped lang="scss">
.profile-chart-container {
  position: absolute;
  /* Keep above BottomDock (bottom:24px + ~76px height + gap) */
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-width: calc(100vw - 400px);
  pointer-events: auto;
  background: rgba(10, 15, 30, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color, rgba(0, 255, 255, 0.2));
  border-radius: 12px;
  padding: 16px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .chart-actions {
    display: flex;
    gap: 8px;
  }
}

.icon-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-secondary, #aaa);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #fff);
  }

  &.close:hover {
    background: rgba(255, 100, 100, 0.3);
    color: #ff6b6b;
  }
}

.chart-stats {
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .stat-item {
    text-align: center;

    .stat-label {
      display: block;
      font-size: 11px;
      color: var(--text-muted, #666);
      margin-bottom: 2px;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent-primary, #00ffff);
    }
  }
}

.chart-area {
  width: 100%;
  height: 200px;
}
</style>
