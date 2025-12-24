<script setup lang="ts">
/**
 * HecRasStatsChart - Time series chart for HEC-RAS simulation data
 * Displays water level and flow rate with synchronized markLine
 */
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import BaseChart from './BaseChart.vue'
import { NEON_CYAN, NEON_GREEN, NEON_PURPLE, createGradient, TEXT_SECONDARY, GRID_LINE } from './theme'

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
	{ key: 'elevation（m）', name: '水位', color: NEON_CYAN, yAxisIndex: 0, unit: 'm' },
	{ key: 'flow（cms）', name: '出库流量', color: NEON_PURPLE, yAxisIndex: 1, unit: 'm³/s' },
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
		lineStyle: { color: cfg.color, width: 2, shadowColor: cfg.color, shadowBlur: 4 },
		areaStyle: {
			color: createGradient(`${cfg.color}66`, `${cfg.color}00`), // Stronger gradient
			opacity: 0.6
		},
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
				},
				lineHeight: 14 // Better spacing for multi-line label
			},
			silent: true,
			animation: false,
			data: [{
				xAxis: props.currentFrame,
				lineStyle: {
					color: '#ff4d4f',
					width: 1,
					type: 'dashed'
				},
				label: {
					show: true,
					position: 'middle', // Move to middle to avoid title overlap
					rotate: 0, // Force horizontal text
					backgroundColor: 'rgba(0,0,0,0.6)',
					formatter: () => {
						return config.map(c => {
							let val = Math.abs(dataArray[props.currentFrame]?.[c.key] || 0)
							if (isFlowScenario.value) val *= ACRE_FEET_TO_10K_M3
							// Remove Chinese name, show only value
							return `${val.toFixed(2)}`
						}).join('\n')
					}
				}
			}]
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
					lineStyle: {
						color: GRID_LINE,
						type: 'dashed',
						opacity: 0.3
					}
				},
				axisLabel: {
					color: TEXT_SECONDARY,
					fontSize: 10,
					formatter: (value: number) => {
						// Align Water Level integers with floats (e.g. 1125.0)
						if (!isFlowScenario.value && cfg.yAxisIndex === 0) {
							return value.toFixed(1)
						}
						return value
					}
				},
				nameTextStyle: { color: TEXT_SECONDARY, fontSize: 10, padding: [0, 0, 0, 10] },
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
			axisPointer: { type: 'line', lineStyle: { color: NEON_CYAN, width: 1, type: 'dashed' } },
			backgroundColor: 'rgba(10, 22, 40, 0.95)',
			borderColor: 'rgba(255, 255, 255, 0.1)',
			textStyle: { color: '#fff', fontSize: 12 },
			padding: [10, 15],
			formatter: (params: any) => {
				let res = `<div style="font-weight:bold;margin-bottom:8px;color:#fff">${params[0].name}</div>`
				params.forEach((p: any) => {
					const unit = config[p.seriesIndex]?.unit || ''
					const color = p.color
					res += `
					<div style="display:flex;justify-content:space-between;align-items:center;min-width:140px;margin-bottom:4px">
						<span style="display:flex;align-items:center;">
							<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>
							<span style="color:#aaa">${p.seriesName}</span>
						</span>
						<span style="font-weight:bold;color:${color}">${p.value.toFixed(2)} <span style="font-size:10px;font-weight:normal">${unit}</span></span>
					</div>`
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
