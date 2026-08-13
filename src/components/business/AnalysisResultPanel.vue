<template>
  <transition name="slide-in">
    <div v-if="visible" class="analysis-result-panel">
      <div class="panel-header">
        <div class="header-content">
          <i class="tool-icon" :class="toolIcon"></i>
          <span class="tool-title">{{ toolTitle }}</span>
        </div>
        <button class="close-btn" @click="close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="panel-body">
        <!-- Volume Result -->
        <div v-if="resultType === 'volume'" class="result-content">
          <div class="result-item highlight">
            <div class="item-label">体积</div>
            <div class="item-value">{{ formatVolume(result.volume) }}</div>
          </div>
          <div class="result-item">
            <div class="item-label">面积</div>
            <div class="item-value">{{ formatArea(result.area) }}</div>
          </div>
          <div class="result-grid">
            <div class="grid-item">
              <span class="label">最高点</span>
              <span class="value">{{ result.maxHeight?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">最低点</span>
              <span class="value">{{ result.minHeight?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">基准面</span>
              <span class="value">{{ result.baseHeight?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">三角形</span>
              <span class="value">{{ result.triangleCount }} 个</span>
            </div>
          </div>
        </div>

        <!-- Measure3D Result -->
        <div v-else-if="resultType === 'measure3d'" class="result-content">
          <div class="result-item highlight">
            <div class="item-label">斜距</div>
            <div class="item-value">{{ formatDistance(result.slopeDistance) }}</div>
          </div>
          <div class="result-item">
            <div class="item-label">水平距离</div>
            <div class="item-value">{{ formatDistance(result.horizontalDistance) }}</div>
          </div>
          <div class="result-item">
            <div class="item-label">垂直距离</div>
            <div class="item-value">
              {{ formatDistance(result.verticalDistance) }}
              <span class="direction-arrow">{{ result.elevationDifference >= 0 ? '↑' : '↓' }}</span>
            </div>
          </div>
          <div class="result-grid">
            <div class="grid-item">
              <span class="label">起点高程</span>
              <span class="value">{{ result.startPoint?.elevation?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">终点高程</span>
              <span class="value">{{ result.endPoint?.elevation?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">坡度角</span>
              <span class="value">{{ result.slopeAngle?.toFixed(1) }}°</span>
            </div>
            <div class="grid-item">
              <span class="label">坡度</span>
              <span class="value">{{ result.slopePercent?.toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <!-- Profile Result -->
        <div v-else-if="resultType === 'profile'" class="result-content">
          <div class="result-item highlight">
            <div class="item-label">路径长度</div>
            <div class="item-value">{{ formatDistance(result.totalLength) }}</div>
          </div>
          <div class="result-grid">
            <div class="grid-item">
              <span class="label">最高点</span>
              <span class="value">{{ result.maxElevation?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">最低点</span>
              <span class="value">{{ result.minElevation?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">累计爬升</span>
              <span class="value">{{ result.totalAscent?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">累计下降</span>
              <span class="value">{{ result.totalDescent?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">平均高程</span>
              <span class="value">{{ result.avgElevation?.toFixed(1) }} m</span>
            </div>
            <div class="grid-item">
              <span class="label">采样点数</span>
              <span class="value">{{ result.samples?.length }} 点</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <div class="timestamp">
          <i class="fa-regular fa-clock"></i>
          {{ formatTime(result.analyzedAt || result.createdAt) }}
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  resultType?: 'volume' | 'measure3d' | 'profile' | null
  result?: any
}

const props = withDefaults(defineProps<Props>(), {
  resultType: null,
  result: null,
})

const emit = defineEmits<{
  close: []
}>()

const visible = computed(() => props.resultType !== null && props.result !== null)

const toolConfig = {
  volume: {
    title: '方量分析结果',
    icon: 'fa-solid fa-cubes-stacked',
  },
  measure3d: {
    title: '3D测量结果',
    icon: 'fa-solid fa-ruler-combined',
  },
  profile: {
    title: '剖面分析结果',
    icon: 'fa-solid fa-chart-line',
  },
}

const toolTitle = computed(() => {
  return props.resultType ? toolConfig[props.resultType].title : ''
})

const toolIcon = computed(() => {
  return props.resultType ? toolConfig[props.resultType].icon : ''
})

// Format functions
const formatVolume = (cubic: number): string => {
  if (!cubic) return '0 m³'
  if (cubic >= 1e6) return `${(cubic / 1e6).toFixed(2)} km³`
  if (cubic >= 1e3) return `${(cubic / 1e3).toFixed(1)} 千m³`
  return `${cubic.toFixed(1)} m³`
}

const formatArea = (sqMeters: number): string => {
  if (!sqMeters) return '0 m²'
  if (sqMeters >= 1e6) return `${(sqMeters / 1e6).toFixed(2)} km²`
  if (sqMeters >= 1e4) return `${(sqMeters / 1e4).toFixed(2)} 公顷`
  return `${sqMeters.toFixed(0)} m²`
}

const formatDistance = (meters: number): string => {
  if (!meters) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(meters < 10 ? 2 : 1)} m`
}

const formatTime = (date: Date): string => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const close = () => {
  emit('close')
}
</script>

<style scoped lang="scss">
.analysis-result-panel {
  position: absolute;
  top: 90px;
  right: 24px;
  width: 320px;
  background: linear-gradient(135deg, rgba(2, 6, 23, 0.95) 0%, rgba(10, 15, 35, 0.95) 100%);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(34, 211, 238, 0.2);
  z-index: 999;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0.05) 100%);
  border-bottom: 1px solid rgba(34, 211, 238, 0.2);

  .header-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tool-icon {
    font-size: 18px;
    color: $neon-cyan;
    animation: pulse 2s ease-in-out infinite;
  }

  .tool-title {
    font-size: 15px;
    font-weight: 600;
    color: $text-main;
    letter-spacing: 0.5px;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: $text-sub;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(255, 77, 77, 0.2);
      color: #ff4d4d;
      border-color: #ff4d4d;
      transform: scale(1.05);
    }
  }
}

.panel-body {
  padding: 16px;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(34, 211, 238, 0.2);
  }

  &.highlight {
    background: linear-gradient(90deg, rgba(34, 211, 238, 0.12) 0%, rgba(34, 211, 238, 0.04) 100%);
    border-color: rgba(34, 211, 238, 0.3);

    .item-value {
      color: $neon-cyan;
      font-size: 20px;
      font-weight: 700;
      text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
    }
  }

  .item-label {
    font-size: 12px;
    color: $text-sub;
    font-weight: 500;
  }

  .item-value {
    font-size: 16px;
    font-weight: 600;
    color: $text-main;
    font-family: $font-code;
    display: flex;
    align-items: center;
    gap: 6px;

    .direction-arrow {
      font-size: 14px;
      color: $neon-cyan;
    }
  }
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 4px;

  .grid-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .label {
      font-size: 10px;
      color: $text-sub;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .value {
      font-size: 13px;
      font-weight: 600;
      color: $text-main;
      font-family: $font-code;
    }
  }
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);

  .timestamp {
    font-size: 10px;
    color: $text-sub;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: $font-code;

    i {
      font-size: 9px;
    }
  }
}

// Animations
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}
</style>
