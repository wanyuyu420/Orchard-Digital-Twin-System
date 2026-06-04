<template>
  <div class="topology-list">
    <div
      v-for="device in devices"
      :key="device.id"
      class="device-item glass-panel"
      :class="{ active: selectedId === device.id }"
      @click="store.selectDevice(device.id)"
    >
      <div class="device-name">
        <i class="fa-solid fa-microchip"></i>
        {{ device.name }}
      </div>
      <div class="device-meta">
        <span :class="device.status === 'online' ? 'text-success' : 'text-alert'">
          <i class="fa-solid fa-circle status-dot"></i> {{ device.status }}
        </span>
        <span class="meta-sep">|</span>
        <span>{{ device.type }}</span>
        <span class="meta-sep">|</span>
        <span>{{ device.latency }}ms</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDeviceStore } from '@/stores/device'

const store = useDeviceStore()
const { devices, selectedId } = storeToRefs(store)
</script>

<style scoped lang="scss">
.topology-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  @include custom-scrollbar;
}

.device-item {
  padding: 12px;
  margin-bottom: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    background: rgba(34, 211, 238, 0.1);
    border-left-color: $neon-cyan;
  }
}

.device-name {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-meta {
  font-size: 11px;
  color: $text-sub;
}

.meta-sep {
  margin: 0 4px;
  opacity: 0.3;
}

.status-dot {
  font-size: 6px;
  vertical-align: middle;
  margin-right: 2px;
}

.text-success {
  color: $success-green;
}
.text-alert {
  color: $alert-red;
}
</style>
