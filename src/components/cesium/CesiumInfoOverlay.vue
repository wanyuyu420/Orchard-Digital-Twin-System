<template>
  <teleport to="body">
    <div v-if="visible" class="cesium-info-overlay" :style="overlayStyle">
      <div class="info-card" :class="`tool-${toolType}`">
        <!-- 顶部渐变条 -->
        <div class="card-accent"></div>

        <!-- 头部 -->
        <div class="card-header">
          <div class="header-icon">
            <i :class="toolIcon"></i>
          </div>
          <div class="header-title">{{ toolTitle }}</div>
          <button class="close-btn" @click="$emit('close')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 内容 -->
        <div class="card-body">
          <slot></slot>
        </div>

        <!-- 角标装饰 -->
        <div class="card-corner top-left"></div>
        <div class="card-corner top-right"></div>
        <div class="card-corner bottom-left"></div>
        <div class="card-corner bottom-right"></div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  visible?: boolean
  toolType?: 'volume' | 'flood' | 'profile' | 'measure3d' | null
  screenPosition?: { x: number; y: number } | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  toolType: null,
  screenPosition: null,
})

defineEmits<{
  close: []
}>()

const toolConfig = {
  volume: {
    title: '方量分析',
    icon: 'fa-solid fa-cubes-stacked',
  },
  flood: {
    title: '淹没分析',
    icon: 'fa-solid fa-water',
  },
  profile: {
    title: '剖面分析',
    icon: 'fa-solid fa-chart-line',
  },
  measure3d: {
    title: '3D测量',
    icon: 'fa-solid fa-ruler-combined',
  },
}

const toolTitle = computed(() => {
  return props.toolType ? toolConfig[props.toolType].title : ''
})

const toolIcon = computed(() => {
  return props.toolType ? toolConfig[props.toolType].icon : ''
})

const overlayStyle = computed(() => {
  if (!props.screenPosition) return {}
  return {
    left: `${props.screenPosition.x}px`,
    top: `${props.screenPosition.y}px`,
  }
})
</script>

<style scoped lang="scss">
.cesium-info-overlay {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 20px));
  animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.info-card {
  position: relative;
  min-width: 280px;
  max-width: 400px;
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.95) 0%,
    rgba(30, 41, 59, 0.92) 50%,
    rgba(15, 23, 42, 0.95) 100%
  );
  border-radius: 16px;
  overflow: hidden;
  pointer-events: auto;

  // Glassmorphism效果
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  // 边框发光
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.05),
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 60px rgba(34, 211, 238, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  // 顶部accent色条
  &.tool-volume .card-accent {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }
  &.tool-flood .card-accent {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }
  &.tool-profile .card-accent {
    background: linear-gradient(90deg, #10b981, #059669);
  }
  &.tool-measure3d .card-accent {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  box-shadow: 0 2px 10px rgba(34, 211, 238, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  position: relative;

  // 头部底部微光
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent);
  }
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.05));
  border: 1px solid rgba(34, 211, 238, 0.2);

  i {
    font-size: 18px;
    color: #22d3ee;
    filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.5));
  }
}

.header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
    transform: scale(1.1);
  }
}

.card-body {
  padding: 16px 18px 18px;
}

// 角标装饰
.card-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(34, 211, 238, 0.3);
  pointer-events: none;

  &.top-left {
    top: 12px;
    left: 12px;
    border-right: none;
    border-bottom: none;
    border-top-left-radius: 4px;
  }

  &.top-right {
    top: 12px;
    right: 12px;
    border-left: none;
    border-bottom: none;
    border-top-right-radius: 4px;
  }

  &.bottom-left {
    bottom: 12px;
    left: 12px;
    border-right: none;
    border-top: none;
    border-bottom-left-radius: 4px;
  }

  &.bottom-right {
    bottom: 12px;
    right: 12px;
    border-left: none;
    border-top: none;
    border-bottom-right-radius: 4px;
  }
}

// 动画
@key frames slideIn {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-100% - 40px)) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, calc(-100% - 20px)) scale(1);
  }
}

// 数据项样式（供外部使用）
:deep(.data-item) {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 10px 14px;
  margin-bottom: 8px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(34, 211, 238, 0.2);
    transform: translateX(4px);
  }

  &:last-child {
    margin-bottom: 0;
  }

  &.highlight {
    background: linear-gradient(90deg, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.05));
    border-color: rgba(34, 211, 238, 0.3);
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.1);
  }
}

:deep(.data-label) {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;

  i {
    font-size: 11px;
    opacity: 0.6;
  }
}

:deep(.data-value) {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  font-family: $font-code;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

  .highlight & {
    color: #22d3ee;
    font-size: 18px;
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  }
}

:deep(.data-grid) {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 8px;
}

:deep(.grid-item) {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .grid-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 6px;
    display: block;
  }

  .grid-value {
    font-size: 14px;
    font-weight: 600;
    color: #f8fafc;
    font-family: $font-code;
  }
}
</style>
