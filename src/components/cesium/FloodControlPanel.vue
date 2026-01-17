<template>
	<div class="flood-panel">
		<div class="panel-header">
			<h3>🌊 淹没分析面板</h3>
			<div class="panel-actions">
				<button class="icon-btn" @click="toggleAnimation" title="动画">
					<span>⏯</span>
				</button>
				<button class="icon-btn close" @click="$emit('close')" title="关闭">
					<span>✕</span>
				</button>
			</div>
		</div>

		<div class="panel-stats">
			<div class="stat-item">
				<span class="stat-label">当前水位</span>
				<span class="stat-value">{{ (localLevel ?? 0).toFixed(1) }} m</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">淹没面积</span>
				<span class="stat-value">{{ formatArea(floodArea) }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">淹没体积</span>
				<span class="stat-value">{{ formatVolume(floodVolume) }}</span>
			</div>
		</div>

		<div class="panel-controls">
			<div class="slider-row">
				<button class="step-btn" @click="stepDown" title="降低">
					<i class="fa-solid fa-minus"></i>
				</button>

				<input class="slider" type="range" :min="sliderMin" :max="sliderMax" :step="step" v-model.number="localLevel"
					@input="onInput" />

				<button class="step-btn" @click="stepUp" title="增加">
					<i class="fa-solid fa-plus"></i>
				</button>
			</div>

			<div class="speed-row">
				<span class="speed-label">涨水速度</span>
				<input class="speed" type="range" :min="0.05" :max="5" :step="0.05" v-model.number="riseRateMps"
					@input="onSpeedInput" />
				<span class="speed-value">{{ riseRateMps.toFixed(2) }} m/s</span>
			</div>

			<div class="hint" v-if="calcStatus === 'sampling'">
				正在进行地形网格采样计算，面积/体积会在完成后自动刷新……
			</div>
			<div class="hint" v-else-if="calcStatus === 'ready' && effectiveGridSpacing">
				计算方式：地形网格积分（≈ {{ effectiveGridSpacing.toFixed(0) }}m 网格，{{ sampleCount }} 个采样点）
			</div>
			<div class="hint" v-else-if="calcStatus === 'failed'">
				{{ errorMessage || '地形采样失败，已回退为简化估算（多边形面积近似）。' }}
			</div>

			<div class="hint" v-if="!controllerAvailable">
				当前没有激活的淹没工具实例，无法联动调整水面；仅展示结果数据。
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGISStore } from '@/stores/gis'

interface Props {
	modelValue: number
	min?: number
	max?: number
	step?: number
	data?: any
}

const props = withDefaults(defineProps<Props>(), {
	min: 0,
	max: 200,
	step: 0.5,
	data: null,
})

defineEmits<{
	(e: 'update:modelValue', value: number): void
	(e: 'close'): void
}>()

const gisStore = useGISStore()

// 本地受控：让滑块/显示先跟手，再合并下发到 FloodTool
const localLevel = ref<number>(props.modelValue ?? 0)

watch(
	() => props.modelValue,
	(v) => {
		// 只有在外部变化时同步（比如动画播放/点击步进），避免拖动时被回写抢夺
		if (typeof v === 'number' && Number.isFinite(v)) {
			localLevel.value = v
		}
	}
)

const floodArea = computed(() => props.data?.floodedArea ?? props.data?.floodArea ?? 0)
const floodVolume = computed(() => props.data?.floodedVolume ?? props.data?.floodVolume ?? 0)

const calcStatus = computed(() => props.data?.calculationStatus ?? 'idle')
const errorMessage = computed(() => props.data?.errorMessage ?? '')
const effectiveGridSpacing = computed(() => props.data?.effectiveGridSpacingMeters ?? props.data?.gridSpacingMeters ?? null)
const sampleCount = computed(() => props.data?.sampleCount ?? 0)

const sliderMin = computed(() => {
	const terrainMin = props.data?.minTerrainHeight
	const v = typeof terrainMin === 'number' ? Math.floor(terrainMin) - 5 : props.min
	return Math.min(v ?? 0, props.modelValue ?? 0)
})

const sliderMax = computed(() => {
	const terrainMax = props.data?.maxTerrainHeight
	const v = typeof terrainMax === 'number' ? Math.ceil(terrainMax) + 50 : props.max
	return Math.max(v ?? 200, props.modelValue ?? 0)
})

const controllerAvailable = computed(() => !!(gisStore as any).floodController)

const riseRateMps = ref<number>(
	(gisStore as any).floodController?.getRiseRateMps?.() ?? 0.5
)

watch(
	() => (gisStore as any).floodController,
	(ctrl) => {
		if (ctrl?.getRiseRateMps) {
			riseRateMps.value = ctrl.getRiseRateMps()
		}
	}
)

let rafId: number | null = null
function flushLevelToController() {
	if (rafId) cancelAnimationFrame(rafId)
	rafId = requestAnimationFrame(() => {
		rafId = null
			; (gisStore as any).floodController?.setWaterLevel?.(localLevel.value)
	})
}

function onInput() {
	// localLevel 已通过 v-model 更新，这里只合并下发
	flushLevelToController()
}

function onSpeedInput() {
	; (gisStore as any).floodController?.setRiseRateMps?.(riseRateMps.value)
}

function stepUp() {
	; (gisStore as any).floodController?.raise?.()
}

function stepDown() {
	; (gisStore as any).floodController?.lower?.()
}

function toggleAnimation() {
	; (gisStore as any).floodController?.toggleAnimation?.()
}

function formatVolume(cubic: number): string {
	if (!cubic) return '0 m³'
	if (cubic >= 1e9) return `${(cubic / 1e9).toFixed(2)} km³`
	if (cubic >= 1e6) return `${(cubic / 1e6).toFixed(2)} 百万m³`
	if (cubic >= 1e3) return `${(cubic / 1e3).toFixed(1)} 千m³`
	return `${cubic.toFixed(1)} m³`
}

function formatArea(sqMeters: number): string {
	if (!sqMeters) return '0 m²'
	if (sqMeters >= 1e6) return `${(sqMeters / 1e6).toFixed(2)} km²`
	if (sqMeters >= 1e4) return `${(sqMeters / 1e4).toFixed(2)} 公顷`
	return `${sqMeters.toFixed(0)} m²`
}
</script>

<style scoped lang="scss">
.flood-panel {
	position: absolute;
	bottom: 120px;
	left: 50%;
	transform: translateX(-50%);
	width: 620px;
	max-width: calc(100vw - 400px);
	pointer-events: auto;
	background: rgba(10, 15, 30, 0.95);
	backdrop-filter: blur(16px);
	border: 1px solid rgba(59, 130, 246, 0.25);
	border-radius: 12px;
	padding: 16px;
	z-index: 100;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.panel-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.panel-actions {
		display: flex;
		gap: 8px;
	}
}

.icon-btn {
	background: rgba(255, 255, 255, 0.1);
	border: none;
	border-radius: 6px;
	padding: 6px 10px;
	cursor: pointer;
	color: var(--text-secondary, #aaa);
	transition: all 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.2);
		color: var(--text-primary, #fff);
	}

	&.close:hover {
		background: rgba(255, 100, 100, 0.3);
		color: #ff6b6b;
	}
}

.panel-stats {
	display: flex;
	justify-content: space-around;
	padding: 8px 0;
	margin-bottom: 10px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);

	.stat-item {
		text-align: center;

		.stat-label {
			display: block;
			font-size: 11px;
			color: var(--text-muted, #666);
			margin-bottom: 2px;
		}

		.stat-value {
			font-size: 14px;
			font-weight: 600;
			color: #60a5fa;
		}
	}
}

.panel-controls {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.slider-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.speed-row {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-top: 4px;
}

.speed-label {
	width: 64px;
	font-size: 12px;
	color: #94a3b8;
}

.speed {
	flex: 1;
}

.speed-value {
	width: 86px;
	text-align: right;
	font-size: 12px;
	color: #cbd5e1;
}

.step-btn {
	width: 36px;
	height: 30px;
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.12);
	background: rgba(255, 255, 255, 0.06);
	color: #cbd5e1;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		background: rgba(96, 165, 250, 0.18);
		border-color: rgba(96, 165, 250, 0.35);
		color: #fff;
	}
}

.slider {
	flex: 1;
}

.hint {
	font-size: 12px;
	color: #94a3b8;
}
</style>
