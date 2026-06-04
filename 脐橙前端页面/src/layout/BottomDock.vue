<template>
	<div class="dock-container" :class="{ hidden: isUiHidden }">
		<div class="dock">
			<div v-for="item in menuItems" :key="item.id" class="dock-item" :class="{ active: currentModule === item.id }"
				@click="navigateTo(item.id)">
				<i :class="item.icon"></i>
				<span>{{ item.label }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

const currentModule = computed(() => appStore.currentModule)
const isUiHidden = computed(() => appStore.isUiHidden)

const menuItems = [
	{ id: 'dashboard', label: '态势', icon: 'fa-solid fa-earth-americas' },
	{ id: 'simulation', label: '仿真', icon: 'fa-solid fa-laptop-code' },
	{ id: 'meteo', label: '气象', icon: 'fa-solid fa-cloud-bolt' },
	{ id: 'data', label: '数据', icon: 'fa-solid fa-database' },
	{ id: 'device', label: '运维', icon: 'fa-solid fa-microchip' },
	{ id: 'ai', label: '工程', icon: 'fa-solid fa-brain' },
]

function navigateTo(id: string) {
	router.push({ name: id })
}
</script>

<style scoped lang="scss">
.dock-container {
	position: absolute;
	bottom: 24px;
	left: 50%;
	transform: translateX(-50%);
	z-index: $z-layer-6;
	pointer-events: auto;
	transition: transform 0.4s $ease-out;

	&.hidden {
		transform: translateX(-50%) translateY(100px);
	}
}

.dock {
	display: flex;
	gap: 8px;
	padding: 8px;
	border-radius: 16px;
	background: rgba(15, 23, 42, 0.6);
	backdrop-filter: blur(20px);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.dock-item {
	width: 60px;
	height: 60px;
	border-radius: 12px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	color: $text-sub;
	cursor: pointer;
	transition: all 0.3s;
	position: relative;
	font-size: 12px;

	i {
		font-size: 20px;
		margin-bottom: 4px;
	}

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		transform: translateY(-5px);
	}

	&.active {
		color: $neon-cyan;
		background: rgba(34, 211, 238, 0.1);

		&::after {
			content: '';
			position: absolute;
			bottom: 4px;
			width: 4px;
			height: 4px;
			background: $neon-cyan;
			border-radius: 50%;
		}
	}
}
</style>
