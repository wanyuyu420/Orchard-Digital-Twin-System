<script setup lang="ts">
/**
 * SparklineChart - Mini line chart for inline display in KPI cards.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_CYAN, createGradient } from './theme'

const props = withDefaults(
  defineProps<{
    data: number[]
    height?: string
    color?: string
  }>(),
  {
    height: '40px',
    color: NEON_CYAN,
  }
)

const chartOptions = computed<EChartsOption>(() => ({
  grid: {
    left: 0,
    right: 0,
    top: 2,
    bottom: 2,
  },
  xAxis: {
    type: 'category',
    show: false,
    boundaryGap: false,
  },
  yAxis: {
    type: 'value',
    show: false,
    min: (value: { min: number }) => Math.max(0, value.min - value.min * 0.1),
  },
  series: [
    {
      type: 'line',
      data: props.data,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: props.color,
        width: 1.5,
      },
      areaStyle: {
        color: createGradient(`${props.color}40`, `${props.color}05`),
      },
    },
  ],
}))
</script>

<template>
  <BaseChart :options="chartOptions" :height="height" :auto-resize="true" />
</template>
