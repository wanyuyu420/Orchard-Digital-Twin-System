<template>
  <transition name="cruise-pop">
    <div v-if="cruiseStore.isCruising" class="cruise-bar" role="status" aria-label="巡园漫游控制条">
      <!-- 标题 + 模式 -->
      <div class="cruise-head">
        <i class="fa-solid fa-route"></i>
        <span class="cruise-title">巡园漫游</span>
        <span class="cruise-stage">手动驾驶</span>
      </div>

      <!-- 驾驶提示 + 实时高度 -->
      <div class="cruise-mid">
        <div class="cruise-hint">
          鼠标拖拽看方向 · W 前进 · S 下降 · Space 上升 · A/D 转向
        </div>
        <div class="cruise-alt">
          <span class="alt-label">高度</span>
          <span class="alt-value">{{ altMsl.toFixed(0) }}</span>
          <span class="alt-unit">m</span>
          <span class="alt-agl">离地 {{ altAgl.toFixed(0) }} m</span>
        </div>
      </div>

      <!-- 控制 -->
      <div class="cruise-actions">
        <button class="cb-btn exit-btn" @click="cruiseStore.stop()">
          <i class="fa-solid fa-xmark"></i>
          <span>退出</span>
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCruiseStore } from '@/stores/cruise'

const cruiseStore = useCruiseStore()

const altMsl = computed(() => Math.max(0, cruiseStore.altMsl))
const altAgl = computed(() => Math.max(0, cruiseStore.altAgl))
</script>

<style lang="scss" scoped>
.cruise-bar {
  position: absolute;
  left: 50%;
  bottom: 72px; // 高于总览页底部坐标胶囊(.map-info-overlay, bottom:24)避免重叠
  transform: translateX(-50%);
  z-index: $z-layer-6;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 20px;
  background: rgba(18, 22, 38, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid $border-subtle;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  color: $text-main;
  font-family: $font-ui;
  user-select: none;
}

.cruise-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $orchard-orange;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;

  i {
    font-size: 15px;
    text-shadow: 0 0 8px rgba(251, 146, 60, 0.5);
  }

  .cruise-stage {
    font-size: 12px;
    font-weight: 400;
    color: $neon-cyan;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.25);
  }
}

.cruise-mid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 260px;
}

.cruise-hint {
  font-family: $font-code;
  font-size: 11px;
  color: $neon-cyan;
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.22);
  letter-spacing: 0.02em;
}

.cruise-alt {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: $font-code;
  font-size: 12px;
  color: $text-sub;

  .alt-label {
    color: $text-dim;
  }

  .alt-value {
    font-size: 16px;
    font-weight: 700;
    color: $orchard-orange;
  }

  .alt-unit {
    color: $text-dim;
    margin-right: 6px;
  }

  .alt-agl {
    color: $success-green;
    padding: 1px 8px;
    border-radius: 8px;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.22);
  }
}

.cruise-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cb-btn {
  height: 32px;
  min-width: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  color: $text-sub;
  cursor: pointer;
  font-size: 13px;
  font-family: $font-ui;
  transition: all 0.2s;
  pointer-events: auto;

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.12);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.exit-btn {
  color: #fca5a5;

  &:hover {
    color: #fee2e2;
    background: rgba(239, 68, 68, 0.16);
  }
}

// 出入场：保留 translateX(-50%)，避免水平跳动
.cruise-pop-enter-active,
.cruise-pop-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.cruise-pop-enter-from,
.cruise-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>

<!-- 巡航期间禁用 Cesium 罗盘拖拽（其持独立 handler，会直接 setView 打断飞行） -->
<style lang="scss">
.is-cruising .cesium-navigation {
  pointer-events: none;
  opacity: 0.3;
  transition: opacity 0.2s ease;
}
</style>
