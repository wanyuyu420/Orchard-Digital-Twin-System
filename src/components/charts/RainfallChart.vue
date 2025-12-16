<script setup lang="ts">
/**
 * RainfallChart - Bar chart showing rainfall by station.
 * Color-coded by severity: blue < 10mm, yellow 10-25mm, red > 25mm.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_BLUE, NEON_YELLOW, NEON_RED, TEXT_SECONDARY } from './theme'

const props = withDefaults(
  defineProps<{
    data: Array<{ station: string; value: number; unit?: string | null }>
    height?: string
    loading?: boolean
    title?: string
  }>(),
  {
    height: '200px',
    loading: false,
    title: '站点降雨量',
  }
)

// Get color based on rainfall value
function getRainfallColor(value: number): string {
  if (value < 10) return NEON_BLUE
  if (value < 25) return NEON_YELLOW
  return NEON_RED
}

const chartOptions = computed<EChartsOption>(() => {
  const stations = props.data.map((d) => d.station)
  const values = props.data.map((d) => d.value)
  const colors = props.data.map((d) => getRainfallColor(d.value))

  return {
    title: {
      text: props.title,
      left: 'center',
      top: 0,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const item = p as { name: string; value: number }
        const dataItem = props.data.find((d) => d.station === item.name)
        const unit = dataItem?.unit || 'mm'
        return `${item.name}<br/>降雨量: <b>${item.value}</b> ${unit}`
      },
    },
    grid: {
      left: 60,
      right: 20,
      top: 40,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      data: stations,
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 10,
        rotate: stations.length > 5 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      name: 'mm',
      nameTextStyle: {
        color: TEXT_SECONDARY,
        fontSize: 10,
      },
      axisLabel: {
        color: TEXT_SECONDARY,
        fontSize: 10,
      },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: colors[i],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '60%',
        animationDuration: 500,
      },
    ],
  }
})
</script>

<template>
  <BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
