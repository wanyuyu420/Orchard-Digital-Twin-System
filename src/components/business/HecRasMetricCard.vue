<template>
	<div class="hec-ras-metric-card">
		<div class="metric-row">
			<div class="metric-card highlight">
				<div class="metric-label">{{ primaryLabel }}</div>
				<div class="metric-value">
					{{ primaryValue }} <small>{{ primaryUnit }}</small>
				</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">{{ secondaryLabel }}</div>
				<div class="metric-value">
					{{ secondaryValue }} <small>{{ secondaryUnit }}</small>
				</div>
			</div>
		</div>

		<div class="trend-row">
			<div class="trend-badge" :class="trend">
				{{ trendText }}
			</div>
			<div class="frame-info">
				帧: {{ currentFrame + 1 }} / {{ totalFrames }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		data: Array<Record<string, any>>
		currentFrame: number
		scenarioType?: 'kb' | 'flow'
	}>(),
	{
		scenarioType: 'kb',
	}
)

// Unit conversion constants
const ACRE_FEET_TO_10K_M3 = 0.123348

const totalFrames = computed(() => props.data?.length || 0)

// Current data point
const currentData = computed(() => props.data?.[props.currentFrame] || {})

// KB Scenario: Water level and outflow
const kbMetrics = computed(() => {
	const elevation = currentData.value['elevation（m）'] || 0
	const flow = Math.abs(currentData.value['flow（cms）'] || 0)
	return {
		primary: { label: '当前水位', value: elevation.toFixed(2), unit: 'm' },
		secondary: { label: '出库流量', value: flow.toFixed(2), unit: 'm³/s' },
	}
})

// Flow Scenario: River volume
const flowMetrics = computed(() => {
	const keys = Object.keys(currentData.value).filter(k => k !== 'time' && k !== 'id')
	const volume = ((currentData.value[keys[0]] || 0) * ACRE_FEET_TO_10K_M3).toFixed(2)
	return {
		primary: { label: '河道体积', value: volume, unit: '万m³' },
		secondary: { label: '进度', value: `${props.currentFrame + 1}`, unit: `/ ${totalFrames.value}` },
	}
})

const metrics = computed(() =>
	props.scenarioType === 'kb' ? kbMetrics.value : flowMetrics.value
)

const primaryLabel = computed(() => metrics.value.primary.label)
const primaryValue = computed(() => metrics.value.primary.value)
const primaryUnit = computed(() => metrics.value.primary.unit)
const secondaryLabel = computed(() => metrics.value.secondary.label)
const secondaryValue = computed(() => metrics.value.secondary.value)
const secondaryUnit = computed(() => metrics.value.secondary.unit)

// Trend analysis (compare with 5 frames ago)
const trend = computed(() => {
	const current = currentData.value
	const prevIndex = Math.max(0, props.currentFrame - 5)
	const prev = props.data?.[prevIndex] || {}

	const key = props.scenarioType === 'kb' ? 'elevation（m）' : Object.keys(current).find(k => k !== 'time' && k !== 'id') || ''
	const currentVal = current[key] || 0
	const prevVal = prev[key] || 0

	if (Math.abs(currentVal - prevVal) < 0.001) return 'stable'
	return currentVal > prevVal ? 'rising' : 'falling'
})

const trendText = computed(() => {
	if (trend.value === 'rising') return '↑ 上涨'
	if (trend.value === 'falling') return '↓ 下降'
	return '→ 稳定'
})
</script>

<style scoped lang="scss">
.hec-ras-metric-card {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.metric-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.metric-card {
	background: rgba(255, 255, 255, 0.05);
	padding: 12px 10px;
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	text-align: center;
	transition: all 0.3s ease;

	&.highlight {
		background: linear-gradient(135deg, rgba(0, 255, 234, 0.1), rgba(0, 136, 255, 0.1));
		border: 1px solid rgba(0, 255, 234, 0.3);
		box-shadow: 0 0 15px rgba(0, 255, 234, 0.15), inset 0 0 20px rgba(0, 255, 234, 0.05);
		position: relative;
		overflow: hidden;

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 2px;
			background: linear-gradient(90deg, transparent, #00ffea, transparent);
		}
	}
}

.metric-label {
	font-size: 12px;
	color: #ccc;
	margin-bottom: 6px;
}

.metric-value {
	font-size: 20px;
	font-weight: bold;
	color: #fff;

	small {
		font-size: 14px;
		font-weight: normal;
		color: #999;
		margin-left: 4px;
	}
}

.trend-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.trend-badge {
	padding: 4px 10px;
	border-radius: 12px;
	font-size: 11px;
	font-weight: bold;

	&.rising {
		background: rgba(255, 77, 79, 0.2);
		color: #ff4d4f;
		border: 1px solid rgba(255, 77, 79, 0.3);
	}

	&.falling {
		background: rgba(66, 185, 131, 0.2);
		color: #42b983;
		border: 1px solid rgba(66, 185, 131, 0.3);
	}

	&.stable {
		background: rgba(255, 255, 255, 0.1);
		color: #aaa;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
}

.frame-info {
	font-size: 11px;
	color: #888;
	font-family: monospace;
}
</style>
