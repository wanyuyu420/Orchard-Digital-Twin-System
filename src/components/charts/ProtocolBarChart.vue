<script setup lang="ts">
/**
 * ProtocolBarChart - Bar chart showing device distribution by protocol.
 * Replaces Pie chart for better readability with tilted labels.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { CHART_COLORS, TEXT_SECONDARY, NEON_CYAN, createGradient, NEON_BLUE } from './theme'

const props = withDefaults(
	defineProps<{
		data: Array<{ name: string; value: number }>
		height?: string
		loading?: boolean
		title?: string
	}>(),
	{
		height: '200px',
		loading: false,
		title: '协议分布',
	}
)

const chartOptions = computed<EChartsOption>(() => {
	const categories = props.data.map(d => d.name)
	const values = props.data.map(d => d.value)

	return {
		title: {
			text: props.title,
			left: 'center',
			top: 0,
			textStyle: {
				color: NEON_CYAN,
				fontSize: 14,
				fontWeight: 500
			}
		},
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				type: 'shadow',
			},
		},
		grid: {
			left: 10,
			right: 10,
			bottom: '8%',
			top: '18%',
			containLabel: true, // Switched back to true with minimal margins for maximum fill
		},
		xAxis: {
			type: 'category',
			data: categories,
			axisLabel: {
				rotate: 45, // Tilted labels
				interval: 0, // Show all labels
				color: TEXT_SECONDARY,
				fontSize: 10,
				margin: 12, // Space between axis and label
			},
			axisTick: {
				show: false
			},
			axisLine: {
				show: true,
				lineStyle: {
					color: 'rgba(255, 255, 255, 0.1)',
				},
			},
		},
		yAxis: {
			type: 'value',
			minInterval: 1, // Ensure integer steps for count
			splitLine: {
				lineStyle: {
					color: 'rgba(255, 255, 255, 0.05)',
					type: 'dashed',
				},
			},
			axisLabel: {
				color: TEXT_SECONDARY,
				fontSize: 10,
			}
		},
		series: [
			{
				type: 'bar',
				barWidth: '60%', // Increased for "fullness"
				showBackground: true,
				backgroundStyle: {
					color: 'rgba(255, 255, 255, 0.02)',
					borderRadius: [4, 4, 0, 0],
				},
				data: values.map((val, index) => {
					const baseColor = CHART_COLORS[index % CHART_COLORS.length]
					return {
						value: val,
						itemStyle: {
							color: createGradient(baseColor, `${baseColor}44`),
							borderRadius: [4, 4, 0, 0],
						},
					}
				}),
				label: {
					show: true,
					position: 'top',
					color: TEXT_SECONDARY,
					fontSize: 10,
					distance: 10
				},
			},
		],
	}
})
</script>

<template>
	<BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
