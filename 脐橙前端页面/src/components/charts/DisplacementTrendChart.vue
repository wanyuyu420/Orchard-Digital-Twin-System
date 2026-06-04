<script setup lang="ts">
/**
 * DisplacementTrendChart - Line chart showing dam displacement trends.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_YELLOW, NEON_RED, TEXT_SECONDARY, NEON_GREEN } from './theme'

const props = withDefaults(
  defineProps<{
    currentValue: number
    height?: string
    loading?: boolean
  }>(),
  {
    height: '100px',
    loading: false,
  }
)

// Generate simulated displacement history
const chartOptions = computed<EChartsOption>(() => {
  const points = 20
  const times: string[] = []
  const values: number[] = []

  // Generate historical values trending toward current value
  for (let i = 0; i < points; i++) {
    times.push(`T-${points - i}`)
    const baseValue = props.currentValue * (0.6 + 0.4 * (i / points))
    const noise = (Math.random() - 0.5) * 0.5
    values.push(Math.round((baseValue + noise) * 100) / 100)
  }
  times.push('Now')
  values.push(props.currentValue)

  return {
    grid: {
      left: 35,
      right: 10,
      top: 15,
      bottom: 25,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const item = p as { name: string; value: number }
        return `${item.name}<br/>位移: <b>${item.value}</b> mm`
      },
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 9,
        interval: 4,
      },
    },
    yAxis: {
      type: 'value',
      name: 'mm',
      nameTextStyle: {
        color: TEXT_SECONDARY,
        fontSize: 9,
      },
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 9,
      },
      min: 0,
      max: 10,
    },
    visualMap: {
      show: false,
      pieces: [
        { lte: 3, color: NEON_GREEN },
        { gt: 3, lte: 6, color: NEON_YELLOW },
        { gt: 6, color: NEON_RED },
      ],
    },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: {
          width: 2,
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            type: 'dashed',
            width: 1,
          },
          data: [
            { yAxis: 3, label: { show: false }, lineStyle: { color: NEON_YELLOW + '80' } },
            { yAxis: 6, label: { show: false }, lineStyle: { color: NEON_RED + '80' } },
          ],
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
