<script setup lang="ts">
/**
 * DeviceStatusChart - Gauge chart showing online device percentage.
 * Color zones: green > 80%, yellow 50-80%, red < 50%.
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_GREEN, NEON_YELLOW, NEON_RED, TEXT_SECONDARY, TEXT_PRIMARY, NEON_CYAN } from './theme'

const props = withDefaults(
	defineProps<{
		online: number
		total: number
		height?: string
		loading?: boolean
		title?: string
	}>(),
	{
		height: '180px',
		loading: false,
		title: '设备在线率',
	}
)

const percentage = computed(() => {
	if (props.total === 0) return 0
	return Math.round((props.online / props.total) * 100)
})

const chartOptions = computed<EChartsOption>(() => ({
	title: {
		text: props.title,
		left: 'center',
		top: 0,
		textStyle: {
			color: NEON_CYAN,
			fontSize: 14,
			fontWeight: 500
		},
	},
	series: [
		{
			type: 'gauge',
			startAngle: 200,
			endAngle: -20,
			center: ['50%', '60%'],
			radius: '95%', // Maximize horizontal fill
			min: 0,
			max: 100,
			splitNumber: 5,
			axisLine: {
				lineStyle: {
					width: 12,
					color: [
						[0.5, NEON_RED],
						[0.8, NEON_YELLOW],
						[1, NEON_GREEN],
					],
				},
			},
			pointer: {
				icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
				length: '60%',
				width: 8,
				offsetCenter: [0, '-10%'],
				itemStyle: {
					color: 'auto',
				},
			},
			axisTick: {
				length: 6,
				lineStyle: {
					color: 'auto',
					width: 1,
				},
			},
			splitLine: {
				length: 10,
				lineStyle: {
					color: 'auto',
					width: 2,
				},
			},
			axisLabel: {
				color: TEXT_SECONDARY,
				fontSize: 9,
				distance: 16,
				formatter: '{value}%',
			},
			title: {
				offsetCenter: [0, '35%'], // Inside the arc
				fontSize: 11,
				color: TEXT_SECONDARY,
			},
			detail: {
				fontSize: 22,
				offsetCenter: [0, '70%'], // Moved down significantly to avoid overlap
				valueAnimation: true,
				formatter: '{value}%',
				color: TEXT_PRIMARY,
			},
			data: [
				{
					value: percentage.value,
					name: `${props.online}/${props.total} 在线`,
				},
			],
		},
	],
}))
</script>

<template>
	<BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
