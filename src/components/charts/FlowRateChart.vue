<script setup lang="ts">
/**
 * FlowRateChart - Real-time line chart showing flow rate trends.
 * Displays hydrological station flow rate data with gradient fill.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_CYAN, NEON_BLUE, createGradient, TEXT_SECONDARY } from './theme'

const props = withDefaults(
  defineProps<{
    data: Array<{ time: Date; value: number }>
    height?: string
    loading?: boolean
    title?: string
  }>(),
  {
    height: '200px',
    loading: false,
    title: '流量趋势',
  }
)

const chartOptions = computed<EChartsOption>(() => {
  const times = props.data.map((d) =>
    d.time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  )
  const values = props.data.map((d) => d.value)

  return {
    title: {
      text: props.title,
      left: 'center',
      top: 0,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const item = p as { name: string; value: number }
        return `${item.name}<br/>流量: <b>${item.value?.toFixed(3) ?? '-'}</b> m³/s`
      },
    },
    grid: {
      left: 55,
      right: 20,
      top: 40,
      bottom: 30,
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      name: 'm³/s',
      nameTextStyle: {
        color: TEXT_SECONDARY,
        fontSize: 10,
      },
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 10,
        formatter: (val: number) => val.toFixed(2),
      },
      splitNumber: 4,
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
          color: NEON_CYAN,
          width: 2,
        },
        itemStyle: {
          color: NEON_CYAN,
        },
        areaStyle: {
          color: createGradient(`${NEON_CYAN}60`, `${NEON_BLUE}10`),
        },
        animationDuration: 500,
      },
    ],
  }
})
</script>

<template>
  <BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
