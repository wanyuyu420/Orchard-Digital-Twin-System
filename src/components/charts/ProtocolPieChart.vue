<script setup lang="ts">
/**
 * ProtocolPieChart - Pie chart showing device distribution by protocol.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { CHART_COLORS, TEXT_SECONDARY } from './theme'

const props = withDefaults(
  defineProps<{
    data: Array<{ name: string; value: number }>
    height?: string
    loading?: boolean
    title?: string
  }>(),
  {
    height: '180px',
    loading: false,
    title: '协议分布',
  }
)

const chartOptions = computed<EChartsOption>(() => ({
  title: {
    text: props.title,
    left: 'center',
    top: 0,
    textStyle: {
      fontSize: 12,
    },
  },
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)',
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    textStyle: {
      color: TEXT_SECONDARY,
      fontSize: 10,
    },
  },
  series: [
    {
      type: 'pie',
      radius: ['35%', '60%'],
      center: ['40%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#111827',
        borderWidth: 2,
      },
      label: {
        show: false,
        position: 'center',
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 12,
          fontWeight: 'bold',
          color: '#fff',
        },
      },
      labelLine: {
        show: false,
      },
      data: props.data.map((item, index) => ({
        ...item,
        itemStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
      })),
    },
  ],
}))
</script>

<template>
  <BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
