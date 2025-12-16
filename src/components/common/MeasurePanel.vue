<template>
  <transition name="slide-fade">
    <div
      v-if="measureStore.measurements.length > 0"
      class="measure-panel"
      :class="{ collapsed: isCollapsed }"
    >
      <div class="panel-header">
        <div class="header-title">
          <i class="fa-solid fa-ruler-combined"></i>
          <span>测量记录</span>
          <span class="record-count">({{ measureStore.measurements.length }})</span>
        </div>
        <div class="header-actions">
          <button class="btn-toggle" @click="toggleCollapse" :title="isCollapsed ? '展开' : '折叠'">
            <i class="fa-solid" :class="isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
          </button>
          <button class="btn-clear" @click="clearAll" title="清空全部">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <transition name="expand">
        <div v-show="!isCollapsed" class="panel-body">
          <div
            v-for="measurement in measureStore.measurements"
            :key="measurement.id"
            class="measurement-item"
          >
            <div class="item-icon">
              <i
                class="fa-solid"
                :class="measurement.type === 'distance' ? 'fa-ruler' : 'fa-draw-polygon'"
                :style="{ color: measurement.type === 'distance' ? '#22D3EE' : '#FCD34D' }"
              ></i>
            </div>
            <div class="item-content">
              <div class="item-type">
                {{ measurement.type === 'distance' ? '距离测量' : '面积测量' }}
              </div>
              <div class="item-value">
                {{ formatValue(measurement) }}
              </div>
              <div class="item-time">{{ formatTime(measurement.createdAt) }}</div>
            </div>
            <button class="btn-delete" @click="deleteMeasurement(measurement.id)" title="删除">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// Note: useMeasureStore is now an alias for useGISStore (backward compatibility)
// For new code, consider using useGISStore directly from '@/stores/gis'
import { useMeasureStore } from '@/stores/gis'
import type { Measurement } from '@/types/measure'

const measureStore = useMeasureStore()
const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function formatValue(measurement: Measurement): string {
  if (measurement.type === 'distance') {
    const meters = measurement.distance
    if (meters < 1000) {
      return `${meters.toFixed(2)} m`
    } else {
      return `${(meters / 1000).toFixed(2)} km`
    }
  } else {
    const squareMeters = measurement.area
    if (squareMeters < 1000000) {
      return `${squareMeters.toFixed(2)} m²`
    } else {
      return `${(squareMeters / 1000000).toFixed(2)} km²`
    }
  }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else {
    return new Date(date).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

function deleteMeasurement(id: string) {
  measureStore.removeMeasurement(id)
}

function clearAll() {
  if (confirm('确定清空所有测量记录吗？')) {
    measureStore.clearAll()
  }
}
</script>

<style scoped lang="scss">
.measure-panel {
  position: fixed;
  top: 90px;
  right: 24px;
  width: 300px;
  max-height: 500px;
  background: rgba(2, 6, 23, 0.95);
  border: 1px solid rgba($neon-cyan, 0.3);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  z-index: $z-layer-3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: max-height 0.3s ease;

  &.collapsed {
    max-height: 56px;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba($neon-cyan, 0.2);
  background: rgba($neon-cyan, 0.05);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $neon-cyan;
  font-size: 14px;
  font-weight: 600;

  i {
    font-size: 16px;
  }

  .record-count {
    font-size: 12px;
    color: $text-sub;
    font-weight: 400;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-toggle,
.btn-clear {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: $text-sub;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba($neon-cyan, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba($neon-cyan, 0.5);
    }
  }
}

.measurement-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  transition: all 0.2s;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba($neon-cyan, 0.3);
  }
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  i {
    font-size: 16px;
  }
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-type {
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 4px;
}

.item-value {
  font-size: 16px;
  font-weight: 600;
  color: $text-main;
  font-family: $font-code;
  margin-bottom: 2px;
}

.item-time {
  font-size: 11px;
  color: $text-sub;
}

.btn-delete {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: $text-sub;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}

// Transition animations
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>
