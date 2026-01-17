<template>
	<div class="volume-diff-chart-container" v-if="visible">
		<div class="chart-header">
			<h3>📊 两期差异方量</h3>
			<div class="chart-actions">
				<button class="icon-text-btn" @click="exportJson" title="导出 JSON">
					<i class="fas fa-file-code"></i> JSON
				</button>
				<button class="icon-text-btn" @click="exportHistogramCsv" title="导出直方图 CSV">
					<i class="fas fa-file-csv"></i> CSV
				</button>
				<div class="divider"></div>
				<button class="icon-btn close" @click="handleClose" title="关闭">
					<span>✕</span>
				</button>
			</div>
		</div>

		<div v-if="!hasDiff" class="empty-tip">
			<div class="tip-title">该结果没有两期差异数据</div>
			<div class="tip-desc">可在测试页生成“two_phase”示例结果，或后续接入真实二期表面数据源。</div>
		</div>

		<div v-else class="chart-stats">
			<div class="stat-item">
				<span class="stat-label">面积</span>
				<span class="stat-value">{{ formatArea(data?.area ?? 0) }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">挖方</span>
				<span class="stat-value" style="color:#f97316">{{ formatVolume(data?.cutVolume ?? 0) }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">填方</span>
				<span class="stat-value" style="color:#22c55e">{{ formatVolume(data?.fillVolume ?? 0) }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">净值(填-挖)</span>
				<span class="stat-value" :style="{ color: (data?.netVolume ?? 0) >= 0 ? '#22c55e' : '#f97316' }">
					{{ formatVolume(data?.netVolume ?? 0) }}
				</span>
			</div>
		</div>

		<div v-if="hasDiff" class="chart-meta">
			<div class="meta-top">
				<div class="chart-view">
					<button class="seg-btn" :class="{ active: bottomView === 'histogram' }" @click="bottomView = 'histogram'">
						直方图
					</button>
					<button class="seg-btn" :class="{ active: bottomView === 'map_xy' }" :disabled="!hasSamples"
						@click="bottomView = 'map_xy'" title="平面 XY 展示：每个基本单元的 Δh 变化">
						平面XY
					</button>
					<button class="seg-btn" :class="{ active: bottomView === 'projection_x' }" :disabled="!hasSamples"
						@click="bottomView = 'projection_x'" title="沿局部 X 方向投影（距离-Δh）">
						投影X
					</button>
					<button class="seg-btn" :class="{ active: bottomView === 'projection_y' }" :disabled="!hasSamples"
						@click="bottomView = 'projection_y'" title="沿局部 Y 方向投影（距离-Δh）">
						投影Y
					</button>
				</div>
				<div v-if="!hasSamples" class="meta-hint">提示：结果未包含采样点，无法绘制投影图</div>
			</div>

			<div class="meta-grid">
				<div class="meta-item"><span class="k">AOI 来源</span><span class="v" :title="aoiText">{{ aoiText }}</span></div>
				<div class="meta-item"><span class="k">采样点数</span><span class="v">{{ diffMeta.sampleCount }}</span></div>
				<div class="meta-item"><span class="k">请求间距</span><span class="v">{{ diffMeta.requestedSpacingMeters.toFixed(1)
				}} m</span></div>
				<div class="meta-item"><span class="k">实际间距</span><span class="v">{{ diffMeta.effectiveSpacingMeters.toFixed(1)
				}} m</span></div>
				<div class="meta-item"><span class="k">单元面积</span><span class="v">{{ diffMeta.cellArea.toFixed(2) }} m²</span>
				</div>
				<div class="meta-item"><span class="k">Δh 均值</span><span class="v">{{ diffMeta.meanDiff.toFixed(3) }} m</span>
				</div>
				<div class="meta-item"><span class="k">Δh 最小值</span><span class="v">{{ diffMeta.minDiff.toFixed(3) }} m</span>
				</div>
				<div class="meta-item"><span class="k">Δh 最大值</span><span class="v">{{ diffMeta.maxDiff.toFixed(3) }} m</span>
				</div>
			</div>
		</div>

		<div ref="chartRef" class="chart-area" v-if="hasDiff"></div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { VolumeAnalysisData } from '@/types/analysis'

	// Register ECharts components
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	; (echarts as any).use([GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BarChart, ScatterChart, LineChart, CanvasRenderer])

interface Props {
	data: VolumeAnalysisData | null
	visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	visible: true,
})

const emit = defineEmits<{ (e: 'close'): void }>()

const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

const hasDiff = computed(() => !!props.data?.diff && props.data?.diffMode === 'two_phase')
const hasSamples = computed(() => (props.data?.diffSamples?.length ?? 0) > 0)
const bottomView = ref<'histogram' | 'map_xy' | 'projection_x' | 'projection_y'>('histogram')

onMounted(() => {
	initChartIfNeeded()
	updateChart()
})

onUnmounted(() => {
	if (resizeObserver && chartRef.value) {
		resizeObserver.unobserve(chartRef.value)
		resizeObserver = null
	}
	if (chartInstance.value) {
		chartInstance.value.dispose()
		chartInstance.value = null
	}
})

watch(
	() => props.visible,
	(v) => {
		if (!v) return
		nextTick(() => {
			initChartIfNeeded()
			chartInstance.value?.resize()
			updateChart()
		})
	}
)

watch(
	() => props.data,
	() => {
		if (!props.visible) return
		nextTick(() => {
			initChartIfNeeded()
			updateChart()
		})
	},
	{ deep: true }
)

watch(bottomView, () => {
	if (!props.visible) return
	nextTick(() => {
		initChartIfNeeded()
		updateChart()
	})
})

function initChartIfNeeded() {
	if (!chartRef.value) return
	if (chartInstance.value) return
	if (!hasDiff.value) return

	chartInstance.value = echarts.init(chartRef.value, 'dark')

	resizeObserver = new ResizeObserver(() => {
		chartInstance.value?.resize()
	})
	resizeObserver.observe(chartRef.value)

	// 首次创建后立刻渲染一次（避免 props.data 在 mount 前已就绪导致 watcher 不触发）
	updateChart()
}

function updateChart() {
	if (!hasDiff.value) return
	if (!chartInstance.value) return
	// 若用户切到投影图但缺少采样点，自动回退
	if (
		(bottomView.value === 'projection_x' || bottomView.value === 'projection_y' || bottomView.value === 'map_xy') &&
		!hasSamples.value
	) {
		bottomView.value = 'histogram'
	}

	const d = props.data!
	const diff = d.diff!

	const volBar = [
		Math.max(0, d.cutVolume ?? 0),
		Math.max(0, d.fillVolume ?? 0),
		d.netVolume ?? (d.fillVolume - d.cutVolume),
	]

	const histogramLabels = diff.histogram.map((b) => b.center.toFixed(2))
	const histogramCounts = diff.histogram.map((b) => b.count)

	const baseOption: any = {
		backgroundColor: 'transparent',
		animation: false,
		tooltip: {
			backgroundColor: 'rgba(0, 0, 0, 0.85)',
			borderColor: 'rgba(34, 211, 238, 0.35)',
			textStyle: { color: '#fff' },
		},
		legend: undefined,
	}

	// View-specific pieces
	let grid: any
	let xAxis: any
	let yAxis: any
	let series: any[] = []
	let legend: any = undefined
	let dataZoom: any[] | undefined

	if (bottomView.value === 'histogram') {
		// Two-panel view (top: volume, bottom: histogram)
		grid = [
			{ left: 64, right: 20, top: 18, height: 120 },
			{ left: 64, right: 20, top: 190, bottom: 35 },
		]

		xAxis = [
			{
				type: 'category',
				gridIndex: 0,
				data: ['挖方', '填方', '净值'],
				axisLabel: { color: '#bbb', margin: 12 },
				axisLine: { lineStyle: { color: '#555' } },
				axisTick: { show: false },
			},
			{
				type: 'category',
				gridIndex: 1,
				data: histogramLabels,
				axisLabel: {
					color: '#999',
					fontSize: 10,
					interval: 'auto',
					hideOverlap: true,
					margin: 12,
				},
				axisLine: { lineStyle: { color: '#555' } },
				axisTick: { alignWithLabel: true, lineStyle: { color: '#444' } },
			},
		]

		yAxis = [
			{
				type: 'value',
				gridIndex: 0,
				name: 'm³',
				nameTextStyle: { color: '#aaa' },
				axisLabel: { color: '#aaa' },
				splitLine: { lineStyle: { color: '#333' } },
			},
			{
				type: 'value',
				gridIndex: 1,
				name: '点数',
				nameTextStyle: { color: '#aaa' },
				axisLabel: { color: '#aaa' },
				splitLine: { lineStyle: { color: '#333' } },
			},
		]

		series = [
			{
				name: '方量',
				type: 'bar',
				xAxisIndex: 0,
				yAxisIndex: 0,
				barWidth: 30,
				data: volBar,
				itemStyle: {
					color: (params: any) => {
						const name = params?.name as string
						if (name === '填方') return '#22c55e'
						if (name === '挖方') return '#f97316'
						return '#06b6d4'
					},
				},
			},
			{
				name: '差值直方图',
				type: 'bar',
				xAxisIndex: 1,
				yAxisIndex: 1,
				barWidth: '90%',
				data: histogramCounts,
				itemStyle: { color: '#60a5fa', opacity: 0.85 },
			},
		]
		dataZoom = undefined
		legend = undefined
	} else if (bottomView.value === 'map_xy') {
		// Full-height plan view: XY scatter colored by diff
		grid = { left: 64, right: 70, top: 18, bottom: 45 }
		xAxis = {
			type: 'value',
			name: 'X / m',
			nameTextStyle: { color: '#aaa' },
			axisLabel: { color: '#aaa' },
			splitLine: { lineStyle: { color: '#222' } },
		}
		yAxis = {
			type: 'value',
			name: 'Y / m',
			nameTextStyle: { color: '#aaa' },
			axisLabel: { color: '#aaa' },
			splitLine: { lineStyle: { color: '#222' } },
		}

		const pts = (d.diffSamples ?? []).map((s) => [s.x, s.y, s.diff])
		series = [
			{
				name: 'Δh',
				type: 'scatter',
				data: pts,
				symbolSize: 5,
				encode: { x: 0, y: 1, tooltip: [0, 1, 2] },
				itemStyle: { opacity: 0.85 },
				progressive: 4000,
			},
		]

		const min = diffMeta.value?.minDiff ?? -1
		const max = diffMeta.value?.maxDiff ?? 1
		dataZoom = [
			{ type: 'inside', xAxisIndex: 0, filterMode: 'none' },
			{ type: 'inside', yAxisIndex: 0, filterMode: 'none' },
			{ type: 'slider', xAxisIndex: 0, height: 16, bottom: 6, borderColor: 'rgba(255,255,255,0.1)' },
			{
				type: 'slider',
				yAxisIndex: 0,
				width: 14,
				right: 8,
				borderColor: 'rgba(255,255,255,0.1)',
				orient: 'vertical',
			},
		]

			; (baseOption as any).visualMap = {
				type: 'continuous',
				dimension: 2,
				min,
				max,
				right: 14,
				top: 22,
				textStyle: { color: '#cbd5e1' },
				inRange: {
					color: ['#f97316', '#60a5fa', '#22c55e'],
				},
				formatter: (v: number) => v.toFixed(2),
			}
		legend = undefined
	} else {
		// Full-height projection: distance vs diff
		const axis = bottomView.value === 'projection_x' ? 'x' : 'y'
		grid = { left: 64, right: 20, top: 18, bottom: 45 }
		const raw = (d.diffSamples ?? []).map((s) => ({ p: axis === 'x' ? s.x : s.y, diff: s.diff }))
		raw.sort((a, b) => a.p - b.p)
		const minP = raw.length ? raw[0].p : 0
		const maxP = raw.length ? raw[raw.length - 1].p : 1
		const span = Math.max(1e-6, maxP - minP)
		const bins = Math.max(30, Math.min(120, Math.round(Math.sqrt(raw.length) * 3)))
		const binSize = span / bins
		const sum = new Array<number>(bins).fill(0)
		const cnt = new Array<number>(bins).fill(0)
		const pos: Array<[number, number]> = []
		const neg: Array<[number, number]> = []

		for (const pt of raw) {
			const idx = Math.min(bins - 1, Math.max(0, Math.floor((pt.p - minP) / binSize)))
			sum[idx] += pt.diff
			cnt[idx] += 1
			if (pt.diff >= 0) pos.push([pt.p, pt.diff])
			else neg.push([pt.p, pt.diff])
		}

		const avgLine: Array<[number, number]> = []
		for (let i = 0; i < bins; i++) {
			if (cnt[i] === 0) continue
			const center = minP + (i + 0.5) * binSize
			avgLine.push([center, sum[i] / cnt[i]])
		}

		xAxis = {
			type: 'value',
			name: `投影距离(${axis.toUpperCase()}) / m`,
			nameTextStyle: { color: '#aaa' },
			axisLabel: { color: '#aaa' },
			splitLine: { lineStyle: { color: '#222' } },
		}
		yAxis = {
			type: 'value',
			name: 'Δh / m',
			nameTextStyle: { color: '#aaa' },
			axisLabel: { color: '#aaa' },
			splitLine: { lineStyle: { color: '#333' } },
		}

		series = [
			{
				name: '挖方单元(Δh<0)',
				type: 'scatter',
				data: neg,
				symbolSize: 4,
				itemStyle: { color: '#f97316', opacity: 0.65 },
				progressive: 2000,
			},
			{
				name: '填方单元(Δh≥0)',
				type: 'scatter',
				data: pos,
				symbolSize: 4,
				itemStyle: { color: '#22c55e', opacity: 0.65 },
				progressive: 2000,
			},
			{
				name: '均值趋势(分箱)',
				type: 'line',
				data: avgLine,
				showSymbol: false,
				smooth: true,
				lineStyle: { width: 2, color: '#60a5fa' },
			},
		]

		dataZoom = [
			{ type: 'inside', xAxisIndex: 0, filterMode: 'none' },
			{ type: 'slider', xAxisIndex: 0, height: 16, bottom: 6, borderColor: 'rgba(255,255,255,0.1)' },
		]
		legend = {
			show: true,
			textStyle: { color: '#cbd5e1' },
			top: 18,
			left: 64,
		}
	}

	const tooltipBase = {
		backgroundColor: 'rgba(0, 0, 0, 0.85)',
		borderColor: 'rgba(34, 211, 238, 0.35)',
		textStyle: { color: '#fff' },
	}

	chartInstance.value.setOption(
		{
			...baseOption,
			grid,
			legend,
			dataZoom,
			xAxis,
			yAxis,
			series,
			tooltip:
				bottomView.value === 'histogram'
					? {
						...tooltipBase,
						trigger: 'axis',
						axisPointer: { type: 'shadow' },
					}
					: {
						...tooltipBase,
						trigger: 'item',
					},
		},
		{ notMerge: true } as any
	)
}

const data = computed(() => props.data)
const diffMeta = computed(() => props.data?.diff!)
const aoiText = computed(() => {
	const aoi = props.data?.aoi
	if (!aoi) return '未提供（默认：夹具/手绘均可）'
	const mode = aoi.mode === 'manual' ? '手绘' : '夹具'
	return `${mode}（${aoi.vertexCount} 点）`
})

function downloadText(filename: string, content: string, mime: string) {
	const blob = new Blob([content], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(url)
}

function exportJson() {
	if (!props.data) return
	const name = `volume-diff_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
	downloadText(name, JSON.stringify(props.data, null, 2), 'application/json;charset=utf-8')
}

function exportHistogramCsv() {
	if (!hasDiff.value) return
	const d = props.data!
	const diff = d.diff!
	const header = ['start', 'end', 'center', 'count'].join(',')
	const rows = diff.histogram.map((b) => [b.start, b.end, b.center, b.count].join(','))
	const csv = [header, ...rows].join('\n')
	const name = `volume-diff-hist_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
	downloadText(name, csv, 'text/csv;charset=utf-8')
}

function handleClose() {
	emit('close')
}

function formatVolume(cubic: number): string {
	if (!cubic) return '0 m³'
	const abs = Math.abs(cubic)
	const sign = cubic < 0 ? '-' : ''
	// 1 km³ = 1e9 m³
	if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(3)} km³`
	if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)} 百万m³`
	if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)} 万m³`
	return `${sign}${abs.toFixed(1)} m³`
}

function formatArea(sqMeters: number): string {
	if (!sqMeters) return '0 m²'
	if (sqMeters >= 1e6) return `${(sqMeters / 1e6).toFixed(2)} km²`
	if (sqMeters >= 1e4) return `${(sqMeters / 1e4).toFixed(2)} 公顷`
	return `${sqMeters.toFixed(0)} m²`
}
</script>

<style scoped lang="scss">
.volume-diff-chart-container {
	position: fixed;
	top: 90px;
	left: 20px;
	width: min(760px, calc(100vw - 40px));
	height: 580px;
	background: rgba(10, 14, 28, 0.92);
	border: 1px solid rgba(34, 211, 238, 0.25);
	border-radius: 12px;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(10px);
	z-index: 1002;
	pointer-events: auto;
	display: flex;
	flex-direction: column;
}

.chart-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);

	h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #e5e7eb;
	}
}

.chart-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.icon-text-btn {
	height: 28px;
	padding: 0 10px;
	display: flex;
	align-items: center;
	gap: 6px;
	border: 1px solid rgba(255, 255, 255, 0.12);
	background: rgba(255, 255, 255, 0.05);
	color: rgba(255, 255, 255, 0.8);
	border-radius: 6px;
	cursor: pointer;
	font-size: 12px;
	transition: all 0.2s;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		border-color: rgba(255, 255, 255, 0.2);
	}

	i {
		font-size: 11px;
	}
}

.divider {
	width: 1px;
	height: 16px;
	background: rgba(255, 255, 255, 0.15);
	margin: auto 2px;
}

.icon-btn {
	width: 28px;
	height: 28px;
	display: grid;
	place-items: center;
	border: 1px solid rgba(255, 255, 255, 0.12);
	background: rgba(255, 255, 255, 0.05);
	color: rgba(255, 255, 255, 0.9);
	border-radius: 6px;
	cursor: pointer;

	&.close {
		border-color: rgba(239, 68, 68, 0.25);
		background: rgba(239, 68, 68, 0.12);

		&:hover {
			background: rgba(239, 68, 68, 0.25);
		}
	}
}

.chart-stats {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 10px;
	padding: 10px 14px;
}

.chart-meta {
	margin: 0 14px 10px;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 8px;
	padding: 10px 12px;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.meta-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 10px;
}

.chart-view {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.seg-btn {
	height: 26px;
	padding: 0 10px;
	border-radius: 999px;
	border: 1px solid rgba(255, 255, 255, 0.14);
	background: rgba(255, 255, 255, 0.05);
	color: rgba(255, 255, 255, 0.75);
	font-size: 12px;
	cursor: pointer;
	transition: all 0.2s;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	&.active {
		background: rgba(34, 211, 238, 0.18);
		border-color: rgba(34, 211, 238, 0.35);
		color: #e5e7eb;
	}

	&:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
}

.meta-hint {
	font-size: 12px;
	color: rgba(255, 255, 255, 0.45);
}

.meta-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 10px 16px;
}

.meta-item {
	display: flex;
	flex-direction: column;
	gap: 2px;
	overflow: hidden;

	.k {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.45);
	}

	.v {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.9);
		font-family: 'JetBrains Mono', monospace;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-variant-numeric: tabular-nums;
	}
}

.stat-item {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 10px;
	padding: 8px 10px;

	.stat-label {
		display: block;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 2px;
	}

	.stat-value {
		font-size: 13px;
		color: #e5e7eb;
		font-weight: 600;
	}
}

.chart-area {
	flex: 1;
	margin: 0 10px 10px;
}

.empty-tip {
	margin: 14px;
	padding: 12px;
	border-radius: 10px;
	border: 1px dashed rgba(255, 255, 255, 0.18);
	background: rgba(255, 255, 255, 0.04);
	color: rgba(255, 255, 255, 0.75);

	.tip-title {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.tip-desc {
		font-size: 12px;
		line-height: 1.5;
	}
}
</style>
