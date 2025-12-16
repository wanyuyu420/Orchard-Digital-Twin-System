<template>
  <GlassPanel title="控制中心" icon="fa-solid fa-sliders">
    <!-- 视角控制 -->
    <div class="control-section">
      <div class="section-title">视角控制</div>
      <div class="button-row">
        <button class="control-btn" @click="$emit('sync-main')" title="同步主页视角">
          <i class="fa-solid fa-crosshairs"></i>
          <span>同步主页</span>
        </button>
        <button class="control-btn" @click="$emit('reset-view')" title="重置视角">
          <i class="fa-solid fa-rotate-left"></i>
          <span>重置视角</span>
        </button>
      </div>
    </div>

    <!-- 卷帘控制 -->
    <div class="control-section">
      <div class="section-title">卷帘控制</div>
      <button class="control-btn full-width" @click="$emit('reset-split')" title="重置卷帘位置">
        <i class="fa-solid fa-arrows-left-right-to-line"></i>
        <span>重置卷帘</span>
      </button>
    </div>

    <!-- 图层控制 -->
    <div class="control-section">
      <div class="section-title">图层显示</div>
      <div class="layer-toggles">
        <div class="toggle-row" @click="toggleRadar">
          <span class="label radar-color">
            <i class="fa-solid fa-satellite-dish"></i> 雷达回波
          </span>
          <i
            class="fa-solid"
            :class="isRadarActive ? 'fa-toggle-on active-icon' : 'fa-toggle-off inactive-icon'"
          ></i>
        </div>
        <div class="toggle-row" @click="toggleRainfall">
          <span class="label rainfall-color">
            <i class="fa-solid fa-cloud-showers-heavy"></i> 反演降雨
          </span>
          <i
            class="fa-solid"
            :class="isRainfallActive ? 'fa-toggle-on active-icon' : 'fa-toggle-off inactive-icon'"
          ></i>
        </div>
      </div>
    </div>

    <!-- 降雨显示模式 -->
    <div class="control-section">
      <div class="section-title">降雨显示模式</div>
      <div class="mode-buttons">
        <button
          class="mode-btn"
          :class="{ active: rainfallMode === 'raster' }"
          @click="setMode('raster')"
        >
          <i class="fa-solid fa-border-all"></i>
          <span>栅格</span>
        </button>
        <button
          class="mode-btn"
          :class="{ active: rainfallMode === 'particle' }"
          @click="setMode('particle')"
        >
          <i class="fa-solid fa-droplet"></i>
          <span>粒子</span>
        </button>
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="instruction-text">
      <i class="fa-solid fa-circle-info"></i> 拖动屏幕中央滑块进行卷帘对比
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GlassPanel from '@/components/common/GlassPanel.vue'

const emit = defineEmits<{
  'sync-main': []
  'reset-view': []
  'reset-split': []
  'toggle-radar': [show: boolean]
  'toggle-rainfall': [show: boolean]
  'rainfall-mode': [mode: 'raster' | 'particle']
}>()

const isRadarActive = ref(true)
const isRainfallActive = ref(true)
const rainfallMode = ref<'raster' | 'particle'>('raster')

function toggleRadar() {
  isRadarActive.value = !isRadarActive.value
  emit('toggle-radar', isRadarActive.value)
}

function toggleRainfall() {
  isRainfallActive.value = !isRainfallActive.value
  emit('toggle-rainfall', isRainfallActive.value)
}

function setMode(mode: 'raster' | 'particle') {
  rainfallMode.value = mode
  emit('rainfall-mode', mode)
}
</script>

<style scoped lang="scss">
.control-section {
  margin-bottom: 16px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 11px;
  color: $text-sub;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.button-row {
  display: flex;
  gap: 8px;
}

.control-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: $text-sub;
  cursor: pointer;
  transition: all 0.2s;

  i {
    font-size: 16px;
  }

  span {
    font-size: 11px;
  }

  &:hover {
    background: rgba($neon-cyan, 0.15);
    border-color: rgba($neon-cyan, 0.4);
    color: $neon-cyan;
  }

  &.full-width {
    flex-direction: row;
    justify-content: center;
    gap: 8px;

    span {
      font-size: 12px;
    }
  }
}

.layer-toggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.label {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.radar-color {
  color: #ef4444;
}

.rainfall-color {
  color: $neon-cyan;
}

.active-icon {
  color: $neon-cyan;
  font-size: 20px;
}

.inactive-icon {
  color: $text-sub;
  font-size: 20px;
}

.mode-buttons {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: $text-sub;
  cursor: pointer;
  transition: all 0.2s;

  i {
    font-size: 14px;
  }

  span {
    font-size: 12px;
  }

  &:hover {
    background: rgba($neon-cyan, 0.1);
    border-color: rgba($neon-cyan, 0.3);
  }

  &.active {
    background: rgba($neon-cyan, 0.2);
    border-color: $neon-cyan;
    color: $neon-cyan;
  }
}

.instruction-text {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: $text-sub;
  text-align: center;

  i {
    margin-right: 4px;
  }
}
</style>
