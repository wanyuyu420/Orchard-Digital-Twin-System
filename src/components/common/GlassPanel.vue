<template>
	<div class="glass-panel" :class="{ 'no-padding': noPadding }">
		<div v-if="title" class="panel-header">
			<div class="panel-title">
				<i v-if="icon" :class="icon" class="panel-icon"></i>
				<span>{{ title }}</span>
			</div>
			<div class="panel-actions">
				<slot name="actions">
					<i v-for="action in actions" :key="action" class="action-btn fa-solid" :class="getActionIcon(action)"
						@click="$emit('action-click', action)"></i>
				</slot>
			</div>
		</div>
		<div class="panel-content">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	title?: string;
	icon?: string;
	actions?: string[];
	noPadding?: boolean;
}>();

defineEmits(['action-click']);

function getActionIcon(action: string) {
	switch (action) {
		case 'import': return 'fa-file-import';
		case 'export': return 'fa-file-export';
		case 'save': return 'fa-floppy-disk';
		case 'close': return 'fa-xmark';
		default: return '';
	}
}
</script>

<style scoped lang="scss">
.glass-panel {
	@include glass-panel;
	display: flex;
	flex-direction: column;
	transition: all $transition-base;
	pointer-events: auto;
	/* Re-enable clicks for glass panels */

	&.no-padding .panel-content {
		padding: 0;
	}
}

.panel-header {
	padding: 12px 16px;
	border-bottom: 1px solid $border-subtle;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.panel-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: 600;
	@include text-glow($neon-cyan);
}

.panel-actions {
	display: flex;
	gap: 8px;
}

.action-btn {
	color: $text-sub;
	cursor: pointer;
	transition: color 0.2s;

	&:hover {
		color: $neon-cyan;
	}
}

.panel-content {
	padding: 16px;
	flex: 1;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
</style>
