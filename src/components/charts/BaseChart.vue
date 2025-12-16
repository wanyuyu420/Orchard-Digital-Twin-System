<script setup lang="ts">
/**
 * BaseChart - Wrapper component for ECharts with dark theme.
 * Handles initialization, resizing, and disposal.
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption, ECharts } from 'echarts'
import { darkTheme } from './theme'

const props = withDefaults(
  defineProps<{
    options: EChartsOption
    height?: string
    loading?: boolean
    autoResize?: boolean
  }>(),
  {
    height: '200px',
    loading: false,
    autoResize: true,
  }
)

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ECharts | null = null

// Merged options with theme
const mergedOptions = computed<EChartsOption>(() => ({
  ...darkTheme,
  ...props.options,
}))

// Initialize chart
function initChart() {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption(mergedOptions.value)
}

// Update chart options
function updateChart() {
  if (!chartInstance) return
  chartInstance.setOption(mergedOptions.value, { notMerge: false })
}

// Handle resize
function handleResize() {
  chartInstance?.resize()
}

// Watch for options changes
watch(
  () => props.options,
  () => {
    updateChart()
  },
  { deep: true }
)

// Watch loading state
watch(
  () => props.loading,
  (loading) => {
    if (loading) {
      chartInstance?.showLoading({
        text: '',
        color: '#00ffea',
        maskColor: 'rgba(10, 22, 40, 0.8)',
      })
    } else {
      chartInstance?.hideLoading()
    }
  }
)

onMounted(() => {
  initChart()

  if (props.autoResize) {
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  if (props.autoResize) {
    window.removeEventListener('resize', handleResize)
  }

  chartInstance?.dispose()
  chartInstance = null
})

// Expose chart instance for external access
defineExpose({
  getChart: () => chartInstance,
  resize: handleResize,
})
</script>

<template>
  <div ref="chartRef" class="base-chart" :style="{ height }"></div>
</template>

<style scoped lang="scss">
.base-chart {
  width: 100%;
}
</style>
