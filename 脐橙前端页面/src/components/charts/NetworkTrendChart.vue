<script setup lang="ts">
/**
 * NetworkTrendChart - Line chart showing network latency trend.
 * Simulated data for "real-time" monitoring feel.
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_CYAN, NEON_BLUE, createGradient, TEXT_SECONDARY, GRID_LINE } from './theme'

const props = withDefaults(
	defineProps<{
		height?: string
		loading?: boolean
		title?: string
	}>(),
	{
		height: '200px',
		loading: false,
		title: '网络延迟趋势',
	}
)

// Generate mock data for the last 30 minutes
const generateData = () => {
	const now = new Date()
	const res = []
	for (let i = 0; i < 20; i++) {
		const t = new Date(now.getTime() - (20 - i) * 60 * 1000)
		res.push({
			time: t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
			value: Math.floor(20 + Math.random() * 30) // Random latency 20-50ms
		})
	}
	return res
}

const data = ref(generateData())
let timer: number

onMounted(() => {
	// Update data every 5 seconds to simulate realtime
	timer = window.setInterval(() => {
		const lastTime = new Date()
		const newValue = Math.floor(20 + Math.random() * 30)
		data.value.shift()
		data.value.push({
			time: lastTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
			value: newValue
		})
	}, 5000)
})

onUnmounted(() => {
	clearInterval(timer)
})

const chartOptions = computed<EChartsOption>(() => {
	const times = data.value.map(d => d.time)
	const values = data.value.map(d => d.value)

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
			formatter: '{b}<br/>延迟: {c} ms'
		},
		legend: {
			show: false
		},
		grid: {
			left: 10,
			right: 10,
			bottom: '8%',
			top: '25%',
			containLabel: true,
		},
		xAxis: {
			type: 'category',
			data: times,
			boundaryGap: false,
			axisLabel: {
				color: TEXT_SECONDARY,
				fontSize: 10,
				interval: 4, // Show fewer labels
			},
			axisLine: {
				show: false
			},
			axisTick: {
				show: false
			}
		},
		yAxis: {
			type: 'value',
			name: 'ms',
			nameTextStyle: {
				color: TEXT_SECONDARY,
				fontSize: 10,
				align: 'right',
				padding: [0, 6, 0, 0]
			},
			splitLine: {
				lineStyle: {
					color: GRID_LINE,
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
				type: 'line',
				smooth: true,
				symbol: 'none',
				lineStyle: {
					color: NEON_CYAN,
					width: 2,
				},
				areaStyle: {
					color: createGradient(`${NEON_CYAN}40`, `${NEON_BLUE}05`),
				},
				data: values,
			},
		],
	}
})
</script>

<template>
	<BaseChart :options="chartOptions" :height="height" :loading="loading" />
</template>
