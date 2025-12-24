<script setup lang="ts">
/**
 * HecRasStatsChart - Time series chart for HEC-RAS simulation data
 * Displays water level and flow rate with synchronized markLine
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_CYAN, NEON_GREEN, createGradient, TEXT_SECONDARY } from './theme'

const props = withDefaults(
	defineProps<{
		data: Array<Record<string, any>>
		currentFrame: number
		height?: string
		title?: string
		seriesConfig?: Array<{
			key: string
			name: string
			color: string
			yAxisIndex: number
			unit: string
		}>
	}>(),
	{
		height: '180px',
		title: '过程线',
		seriesConfig: () => [],
	}
)

// KB scenario config (water level + flow)
const kbSeriesConfig = [
	{ key: 'elevation（m）', name: '水位', color: NEON_GREEN, yAxisIndex: 0, unit: 'm' },
	{ key: 'flow（cms）', name: '出库流量', color: NEON_CYAN, yAxisIndex: 1, unit: 'm³/s' },
]

// Constants for unit conversion
const ACRE_FEET_TO_10K_M3 = 0.123348

// Auto-detect config based on data keys
const effectiveConfig = computed(() => {
	if (props.seriesConfig.length > 0) return props.seriesConfig

	// Try to detect from data
	const firstItem = props.data?.[0]
	if (!firstItem) return kbSeriesConfig

	// Check if it's Flow scenario by looking for a Volume key
	const keys = Object.keys(firstItem)
	const volumeKey = keys.find(k => k.includes('Volume'))

	if (volumeKey) {
		// Dynamically create Flow config with the actual key name
		return [
			{ key: volumeKey, name: '河道体积', color: NEON_GREEN, yAxisIndex: 0, unit: '万m³' },
		]
	}

	// Default to KB config
	return kbSeriesConfig
})

// Check if current data is Flow scenario
const isFlowScenario = computed(() => {
	const firstItem = props.data?.[0]
	if (!firstItem) return false
	const keys = Object.keys(firstItem)
	return keys.some(k => k.includes('Volume'))
})

const chartOptions = computed<EChartsOption>(() => {
	const config = effectiveConfig.value
	const dataArray = props.data || []

	// Build series
	const series: any[] = config.map((cfg, idx) => ({
		name: cfg.name,
		type: 'line',
		yAxisIndex: cfg.yAxisIndex,
		// Apply unit conversion for Flow scenario (Acre-Feet to 万m³)
		data: dataArray.map(item => {
			const rawValue = Math.abs(item[cfg.key] || 0)
			return isFlowScenario.value ? rawValue * ACRE_FEET_TO_10K_M3 : rawValue
		}),
		smooth: true,
		showSymbol: false,
		lineStyle: { color: cfg.color, width: 2 },
		areaStyle: idx === 0 ? {
			color: createGradient(`${cfg.color}33`, `${cfg.color}00`),
		} : undefined,
	}))

	// Add markLine to first series for current frame indicator
	if (series.length > 0) {
		series[0].markLine = {
			symbol: ['none', 'none'],
			label: {
				show: true,
				position: 'end',
				backgroundColor: 'rgba(255, 77, 79, 0.9)',
				color: '#fff',
				padding: [4, 8],
				borderRadius: 4,
				fontSize: 10,
				formatter: () => {
					return config.map(c => {
						let val = Math.abs(dataArray[props.currentFrame]?.[c.key] || 0)
						if (isFlowScenario.value) val *= ACRE_FEET_TO_10K_M3
						return `${c.name}: ${val.toFixed(2)}`
					}).join('\n')
				}
			},
			silent: true,
			animation: false,
			data: [{ xAxis: props.currentFrame, lineStyle: { color: '#ff4d4f', width: 2 } }]
		}
	}

	// Build yAxis array
	const yAxes = config.reduce((acc: any[], cfg) => {
		if (!acc[cfg.yAxisIndex]) {
			acc[cfg.yAxisIndex] = {
				type: 'value',
				name: cfg.unit,
				scale: true,
				splitLine: {
					show: cfg.yAxisIndex === 0,
					lineStyle: { color: 'rgba(255,255,255,0.05)' }
				},
				axisLabel: { color: cfg.color, fontSize: 9, formatter: `{value}` },
				nameTextStyle: { color: cfg.color, fontSize: 9 },
			}
		}
		return acc
	}, [])

	return {
		backgroundColor: 'transparent',
		animation: false,
		title: {
			text: props.title,
			textStyle: { fontSize: 13, color: NEON_GREEN },
			left: 'center',
			top: 5,
		},
		legend: {
			show: config.length > 1,
			bottom: 0,
			textStyle: { color: '#ccc', fontSize: 10 },
			itemWidth: 10,
			itemHeight: 10,
		},
		tooltip: {
			trigger: 'axis',
			axisPointer: { type: 'cross' },
			formatter: (params: any) => {
				let res = `${params[0].name}`
				params.forEach((p: any) => {
					const unit = config[p.seriesIndex]?.unit || ''
					res += `<br/>${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)}${unit}</b>`
				})
				return res
			}
		},
		grid: {
			left: 5,
			right: config.some(c => c.yAxisIndex === 1) ? 5 : 35,
			bottom: config.length > 1 ? 25 : 35,
			top: 35,
			containLabel: true,
		},
		xAxis: {
			type: 'category',
			data: dataArray.map((item, i) => item.time || `Frame ${i}`),
			axisLabel: {
				show: true,
				color: TEXT_SECONDARY,
				fontSize: 10,
				hideOverlap: true,
				interval: 'auto',
				formatter: (value: string) => {
					// Parse time format like "01Sep2008 0015" or "31Aug2008 2400"
					const months: Record<string, string> = {
						'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
						'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
					}
					const match = value.match(/(\d{2})([A-Z][a-z]{2})\d{4}\s(\d{2})(\d{2})/)
					if (match) {
						const [_, d, m, hh, mm] = match
						return `${months[m]}-${d}\n${hh}:${mm}`
					}
					return value
				}
			},
			axisTick: { show: false },
			axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
		},
		yAxis: yAxes,
		series,
	}
})
</script>

<template>
	<BaseChart :options="chartOptions" :height="height" />
</template>
