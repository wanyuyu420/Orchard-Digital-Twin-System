<template>
  <div class="map-toolbar-wrapper" :class="positionClass">
    <!-- 垂直工具栏按钮组 -->
    <div class="toolbar-container">
      <div
        v-if="showMapStyle"
        class="toolbar-btn"
        @click="togglePanel"
        :class="{ 'is-active': isPanelVisible }"
        title="底图与风格"
      >
        <i class="fa-solid fa-layer-group"></i>
      </div>
      <div v-if="showLocation" class="toolbar-btn" @click="$emit('locate')" title="定位">
        <i class="fa-solid fa-location-crosshairs"></i>
      </div>
      <div
        v-if="show3DToggle"
        class="toolbar-btn"
        @click="$emit('toggle3d')"
        :class="{ 'is-active': is3DActive }"
        title="3D视角"
      >
        <i class="fa-solid fa-cube"></i>
      </div>
      <!-- 自定义按钮插槽 -->
      <slot name="extra-buttons"></slot>
    </div>

    <!-- 弹出的控制面板 -->
    <transition :name="panelTransition">
      <div class="control-panel-box" v-show="isPanelVisible">
        <div class="panel-header">
          <h3>{{ panelTitle }}</h3>
          <span class="close-btn" @click="isPanelVisible = false">×</span>
        </div>

        <div class="panel-body">
          <!-- 滤镜控制 -->
          <div class="setting-group">
            <div class="filter-toggle">
              <span class="toggle-label">科技风滤镜</span>
              <label class="switch">
                <input
                  type="checkbox"
                  v-model="localFilterState.enabled"
                  @change="emitFilterChange"
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 滤镜颜色 -->
          <div class="setting-group" v-if="localFilterState.enabled">
            <div class="group-label">滤镜颜色</div>
            <input
              type="color"
              v-model="localFilterState.color"
              @change="emitFilterChange"
              class="color-input"
            />
          </div>

          <!-- 预设主题 -->
          <div class="setting-group" v-if="localFilterState.enabled">
            <div class="group-label">预设主题</div>
            <div class="preset-colors">
              <span
                v-for="preset in presetColors"
                :key="preset.color"
                class="color-block"
                :style="{ background: preset.color }"
                :title="preset.name"
                @click="applyPreset(preset.color)"
              ></span>
            </div>
          </div>

          <!-- 自定义面板内容插槽 -->
          <slot name="panel-content"></slot>

          <!-- 底图样式 -->
          <div class="setting-group" v-if="showBasemapSelector">
            <div class="group-label">底图样式</div>
            <div class="basemap-list">
              <div
                class="basemap-item"
                :class="{ active: localMapType === 'amap' }"
                @click="selectBasemap('amap')"
              >
                <div class="thumb amap"></div>
                <span>高德</span>
              </div>
              <div
                class="basemap-item"
                :class="{ active: localMapType === 'tdt_vec' }"
                @click="selectBasemap('tdt_vec')"
              >
                <div class="thumb vec"></div>
                <span>矢量</span>
              </div>
              <div
                class="basemap-item"
                :class="{ active: localMapType === 'tdt_ter' }"
                @click="selectBasemap('tdt_ter')"
              >
                <div class="thumb ter"></div>
                <span>地形</span>
              </div>
              <div
                class="basemap-item"
                :class="{ active: localMapType === 'tdt_img' }"
                @click="selectBasemap('tdt_img')"
              >
                <div class="thumb img"></div>
                <span>影像</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'

// Props
const props = withDefaults(
  defineProps<{
    position?: 'left' | 'right'
    showMapStyle?: boolean
    showLocation?: boolean
    show3DToggle?: boolean
    showBasemapSelector?: boolean
    is3DActive?: boolean
    panelTitle?: string
    filterState?: { enabled: boolean; color: string }
    mapType?: string
  }>(),
  {
    position: 'right',
    showMapStyle: true,
    showLocation: true,
    show3DToggle: false,
    showBasemapSelector: true,
    is3DActive: false,
    panelTitle: '地图风格控制',
    filterState: () => ({ enabled: true, color: '#4E70A6' }),
    mapType: 'amap',
  }
)

// Emits
const emit = defineEmits<{
  (e: 'locate'): void
  (e: 'toggle3d'): void
  (e: 'update:filterState', value: { enabled: boolean; color: string }): void
  (e: 'update:mapType', value: string): void
  (e: 'filterChange', value: { enabled: boolean; color: string }): void
  (e: 'basemapChange', value: string): void
}>()

// State
const isPanelVisible = ref(false)
const localFilterState = ref({ ...props.filterState })
const localMapType = ref(props.mapType)

// 预设颜色
const presetColors = [
  { name: '科技蓝', color: '#4E70A6' },
  { name: '深海蓝', color: '#003C78' },
  { name: '森林绿', color: '#006450' },
  { name: '暗紫色', color: '#3C2850' },
  { name: '棕褐色', color: '#503C28' },
  { name: '深邃黑', color: '#141428' },
]

// Computed
const positionClass = computed(() => `position-${props.position}`)
const panelTransition = computed(() => (props.position === 'left' ? 'slide-left' : 'slide-right'))

// Watch props changes
watch(
  () => props.filterState,
  (val) => {
    localFilterState.value = { ...val }
  },
  { deep: true }
)

watch(
  () => props.mapType,
  (val) => {
    localMapType.value = val
  }
)

// Methods
const togglePanel = () => {
  isPanelVisible.value = !isPanelVisible.value
}

const emitFilterChange = () => {
  emit('update:filterState', { ...localFilterState.value })
  emit('filterChange', { ...localFilterState.value })
}

const applyPreset = (color: string) => {
  localFilterState.value.color = color
  localFilterState.value.enabled = true
  emitFilterChange()
}

const selectBasemap = (type: string) => {
  localMapType.value = type
  emit('update:mapType', type)
  emit('basemapChange', type)
}

// Expose
defineExpose({
  togglePanel,
  closePanel: () => {
    isPanelVisible.value = false
  },
  openPanel: () => {
    isPanelVisible.value = true
  },
})
</script>

<style lang="scss" scoped>
.map-toolbar-wrapper {
  position: absolute;
  pointer-events: auto;
  z-index: 100;

  &.position-right {
    right: 20px;
    top: 50%;
    transform: translateY(-50%);

    .control-panel-box {
      position: absolute;
      right: calc(100% + 10px);
      top: 0;
    }
  }

  &.position-left {
    left: 90px;
    top: 80px;

    .control-panel-box {
      position: absolute;
      left: calc(100% + 10px);
      top: 0;
    }
  }
}

.toolbar-container {
  display: flex;
  flex-direction: column;
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba($neon-cyan, 0.3);
  border-radius: 4px;
  overflow: hidden;

  .toolbar-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: $neon-cyan;
    transition: all 0.2s;

    &:hover {
      background: rgba($neon-cyan, 0.12);
    }

    &.is-active {
      background: rgba($neon-cyan, 0.18);
      color: #fff;
    }

    i {
      font-size: 14px;
    }
  }
}

.control-panel-box {
  width: 280px;
  background: rgba(0, 20, 40, 0.95);
  border: 1px solid rgba($neon-cyan, 0.3);
  border-radius: 6px;
  color: #fff;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    border-bottom: 1px solid rgba($neon-cyan, 0.2);
    background: rgba($neon-cyan, 0.08);

    h3 {
      margin: 0;
      font-size: 14px;
      color: $neon-cyan;
    }

    .close-btn {
      cursor: pointer;
      font-size: 18px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1;

      &:hover {
        color: #fff;
      }
    }
  }

  .panel-body {
    padding: 15px;
  }

  .setting-group {
    margin-bottom: 15px;

    &:last-child {
      margin-bottom: 0;
    }

    .group-label {
      font-size: 12px;
      color: $text-sub;
      margin-bottom: 8px;
    }
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .toggle-label {
      font-size: 13px;
      color: $text-main;
    }
  }

  .color-input {
    width: 100%;
    height: 32px;
    border: 1px solid rgba($neon-cyan, 0.3);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
      padding: 2px;
    }

    &::-webkit-color-swatch {
      border-radius: 2px;
      border: none;
    }
  }

  .preset-colors {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .color-block {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      cursor: pointer;
      border: 2px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s;

      &:hover {
        transform: scale(1.1);
        border-color: #fff;
      }
    }
  }

  .basemap-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;

    .basemap-item {
      cursor: pointer;
      text-align: center;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 8px;
      transition: all 0.2s;
      background: rgba(255, 255, 255, 0.03);

      .thumb {
        height: 45px;
        width: 100%;
        border-radius: 4px;
        margin-bottom: 6px;
        background-size: cover;
        background-position: center;
      }

      .thumb.vec {
        background: linear-gradient(135deg, #e8e8e8 0%, #c8c8c8 100%);
      }

      .thumb.ter {
        background: linear-gradient(135deg, #5a6b48 0%, #3d4a32 100%);
      }

      .thumb.img {
        background: linear-gradient(135deg, #1a3a5c 0%, #0a1a2a 100%);
      }

      .thumb.amap {
        background: linear-gradient(135deg, #f0f0f0 0%, #d8d8d8 100%);
        position: relative;

        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 15%;
          right: 15%;
          height: 2px;
          background: #3385ff;
          transform: translateY(-50%);
        }
      }

      span {
        font-size: 11px;
        color: $text-sub;
      }

      &.active {
        border-color: $neon-cyan;
        box-shadow: 0 0 8px rgba($neon-cyan, 0.4);

        span {
          color: $neon-cyan;
        }
      }

      &:hover {
        border-color: rgba($neon-cyan, 0.4);
      }
    }
  }
}

// Toggle switch
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .slider {
      background: $neon-cyan;
    }

    &:checked + .slider:before {
      transform: translateX(22px);
    }
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.2);
    transition: 0.3s;
    border-radius: 22px;

    &:before {
      position: absolute;
      content: '';
      height: 18px;
      width: 18px;
      left: 2px;
      bottom: 2px;
      background: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }
}

// Transitions
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
