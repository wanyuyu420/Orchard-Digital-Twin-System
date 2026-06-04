<script setup lang="ts">
/**
 * WaterLevelChart - Real-time line chart showing water level trends.
 * Displays last 24 hours with gradient fill and smooth animation.
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
		title: '水位趋势',
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
				return `${item.name}<br/>水位: <b>${item.value}</b> m`
			},
		},
		grid: {
			left: 55,
			right: 15,
			top: 35,
			bottom: 25,
		},
		xAxis: {
			type: 'category',
			data: times,
			boundaryGap: false,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: {
				color: TEXT_SECONDARY,
				fontSize: 10,
				interval: 'auto',
				hideOverlap: true,
				margin: 8,
			},
		},
		yAxis: {
			type: 'value',
			name: 'm',
			scale: true, // Auto-scale to fit data range
			nameGap: 8,
			nameTextStyle: {
				color: TEXT_SECONDARY,
				fontSize: 10,
				align: 'right',
			},
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: {
				color: TEXT_SECONDARY,
				fontSize: 10,
				formatter: (val: number) => val.toFixed(1),
				margin: 4,
			},
			splitNumber: 2, // Very clean
			splitLine: {
				lineStyle: {
					color: 'rgba(255, 255, 255, 0.05)',
					type: 'dashed',
				},
			},
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
					width: 3,
					shadowBlur: 10,
					shadowColor: NEON_CYAN,
				},
				itemStyle: {
					color: NEON_CYAN,
				},
				areaStyle: {
					color: createGradient(`${NEON_CYAN}40`, `${NEON_BLUE}05`),
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
