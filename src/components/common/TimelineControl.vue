<template>
	<GlassPanel class="timeline-control" noPadding>
		<button class="play-btn" @click="togglePlay">
			<i class="fa-solid" :class="state.isPlaying ? 'fa-pause' : 'fa-play'"></i>
		</button>

		<div class="progress-track" ref="trackRef" @click="seek">
			<div class="progress-bar" :style="{ width: state.progress + '%' }"></div>
			<div class="progress-handle" :style="{ left: state.progress + '%' }" @mousedown="startDrag"></div>
		</div>

		<div class="time-label font-mono text-neon">+{{ formatTime(state.progress) }}h</div>
	</GlassPanel>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSimulationStore } from '@/stores/simulation'
import GlassPanel from '@/components/common/GlassPanel.vue'

const store = useSimulationStore()
const { state } = storeToRefs(store)
const trackRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

function togglePlay() {
	store.togglePlay()
}

// Calculate total hours (default 24 for all engines)
const totalHours = computed(() => {
	return 24
})

function formatTime(progress: number) {
	const current = (progress / 100) * totalHours.value
	const h = Math.floor(current)
	const m = Math.floor((current - h) * 60)
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Calculate progress from mouse position
function getProgressFromEvent(e: MouseEvent): number {
	if (!trackRef.value) return state.value.progress
	const rect = trackRef.value.getBoundingClientRect()
	const x = e.clientX - rect.left
	return Math.max(0, Math.min(100, (x / rect.width) * 100))
}

// Click to seek
function seek(e: MouseEvent) {
	const pct = getProgressFromEvent(e)
	store.setProgress(pct)
}

// Drag handlers
function startDrag(e: MouseEvent) {
	e.preventDefault()
	isDragging.value = true

	// Pause playback during drag
	if (state.value.isPlaying) {
		store.togglePlay()
	}

	window.addEventListener('mousemove', onDrag)
	window.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
	if (!isDragging.value) return
	const pct = getProgressFromEvent(e)
	store.setProgress(pct)
}

function stopDrag() {
	isDragging.value = false
	window.removeEventListener('mousemove', onDrag)
	window.removeEventListener('mouseup', stopDrag)
}

// Cleanup on unmount
onUnmounted(() => {
	window.removeEventListener('mousemove', onDrag)
	window.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped lang="scss">
.timeline-control {
	height: 64px;
	display: flex;
	align-items: center;
	padding: 0 20px;
	gap: 20px;

	// Override GlassPanel defaults
	:deep(.panel-content) {
		padding: 0;
		flex-direction: row;
		align-items: center;
		width: 100%;
	}
}

.play-btn {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: $neon-cyan;
	border: none;
	color: #000;
	font-size: 16px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: transform 0.1s;
	@include box-glow($neon-cyan);

	&:active {
		transform: scale(0.95);
	}
}

.progress-track {
	flex: 1;
	height: 4px;
	background: rgba(255, 255, 255, 0.1);
	position: relative;
	cursor: pointer;
	border-radius: 2px;
	margin-left: 10px;
	/* 防止滑块与播放按钮重叠 */
}

.progress-bar {
	height: 100%;
	background: $neon-cyan;
	border-radius: 2px;
}

.progress-handle {
	position: absolute;
	top: 50%;
	width: 16px;
	height: 16px;
	background: #fff;
	border-radius: 50%;
	transform: translate(-50%, -50%);
	cursor: grab;
	box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);

	&:hover {
		transform: translate(-50%, -50%) scale(1.2);
	}
}

.time-label {
	width: 60px;
	text-align: right;
	font-size: 14px;
	@include text-glow($neon-cyan);
}
</style>
