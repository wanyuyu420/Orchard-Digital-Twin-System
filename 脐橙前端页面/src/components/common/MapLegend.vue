<template>
	<div class="map-legend" :class="position">
		<div class="legend-title">{{ title }}</div>
		<div class="legend-bar">
			<div class="gradient-bar"></div>
			<div class="legend-labels">
				<span>{{ minLabel }}</span>
				<span>{{ maxLabel }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		title?: string
		minDepth?: number
		maxDepth?: number
		position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
	}>(),
	{
		title: '水深范围 (m)',
		minDepth: 0,
		maxDepth: 5,
		position: 'bottom-left',
	}
)

const minLabel = computed(() => props.minDepth.toFixed(1))
const maxLabel = computed(() => props.maxDepth.toFixed(1))
</script>

<style scoped lang="scss">
.map-legend {
	position: absolute;
	z-index: 100;
	background: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(8px);
	padding: 12px 16px;
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	min-width: 120px;
	pointer-events: auto;

	&.bottom-left {
		bottom: 120px;
		left: 20px;
	}

	&.bottom-right {
		bottom: 120px;
		right: 20px;
	}

	&.top-left {
		top: 80px;
		left: 20px;
	}

	&.top-right {
		top: 80px;
		right: 20px;
	}
}

.legend-title {
	font-size: 12px;
	color: #ccc;
	margin-bottom: 8px;
	text-align: center;
}

.legend-bar {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.gradient-bar {
	height: 12px;
	border-radius: 2px;
	background: linear-gradient(to right,
			rgba(173, 216, 230, 0.6),
			/* Light blue - shallow */
			rgba(30, 144, 255, 0.7),
			/* Dodger blue - medium */
			rgba(0, 0, 139, 0.8)
			/* Dark blue - deep */
		);
}

.legend-labels {
	display: flex;
	justify-content: space-between;
	font-size: 10px;
	color: #999;
	font-family: monospace;
}
</style>
