<script setup lang="ts">
/**
 * FloodProgressChart - Area chart showing flood inundation progress over time.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_RED, createGradient, TEXT_SECONDARY } from './theme'

const props = withDefaults(
  defineProps<{
    progress: number // 0-100
    floodArea: number
    height?: string
    loading?: boolean
  }>(),
  {
    height: '100px',
    loading: false,
  }
)

// Generate simulated flood curve data
const chartOptions = computed<EChartsOption>(() => {
  const hours = 24
  const times: string[] = []
  const values: number[] = []
  const currentHour = Math.floor((props.progress / 100) * hours)

  for (let h = 0; h <= hours; h++) {
    times.push(`${h}h`)
    // Simulate flood curve - rises then falls
    const peak = 12
    const peakValue = props.floodArea || 50
    const t = h - peak
    const value = peakValue * Math.exp((-t * t) / 50)
    values.push(h <= currentHour ? Math.round(value * 10) / 10 : (null as unknown as number))
  }

  return {
    grid: {
      left: 35,
      right: 10,
      top: 10,
      bottom: 25,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const item = p as { name: string; value: number }
        if (item.value === null) return ''
        return `${item.name}<br/>淹没面积: <b>${item.value}</b> km²`
      },
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 9,
        interval: 5,
      },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: NEON_RED,
          width: 2,
        },
        areaStyle: {
          color: createGradient(`${NEON_RED}60`, `${NEON_RED}10`),
        },
        animationDuration: 300,
      },
    ],
  }
})
</script>

<template>
  <BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
