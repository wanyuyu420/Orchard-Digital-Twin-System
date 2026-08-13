<template>
  <div class="orchard-control-bar glass-panel">
    <!-- 树木透明度滑杆(移植自果园2.0 viewer.html 工具栏) -->
    <div class="ctrl-group" title="树木透明度">
      <i class="fa-solid fa-droplet"></i>
      <span class="ctrl-label">树木透明度</span>
      <input
        type="range"
        min="10"
        max="100"
        v-model.number="treeOpacity"
        class="ctrl-range"
        :style="{ '--fill': treeOpacity + '%' }"
        @input="onOpacityInput"
      />
      <span class="ctrl-val">{{ treeOpacity }}%</span>
    </div>

    <div class="divider"></div>

    <!-- 树显隐 -->
    <button
      class="ctrl-btn"
      :class="{ active: !cesiumStore.orchardTreesVisible }"
      @click="toggleTrees"
      :title="treesLabel"
    >
      <i class="fa-solid" :class="cesiumStore.orchardTreesVisible ? 'fa-eye' : 'fa-eye-slash'"></i>
      <span>{{ treesLabel }}</span>
    </button>

    <div class="divider"></div>

    <!-- 果园精模:懒加载 + 显隐 -->
    <button
      class="ctrl-btn primary"
      :class="{ active: cesiumStore.orchardModelsVisible }"
      @click="toggleModels"
      :disabled="modelsLoading"
      :title="modelsLabel"
    >
      <i class="fa-solid" :class="modelsLoading ? 'fa-spinner fa-spin' : 'fa-tree'"></i>
      <span>{{ modelsLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'

const cesiumStore = useCesiumStore()

// 滑杆本地值(0-100),防抖 80ms 后写 store(对齐 viewer.html)
const treeOpacity = ref(Math.round(cesiumStore.orchardTreeOpacity * 100))
let opacityTimer: ReturnType<typeof setTimeout> | null = null

function onOpacityInput(): void {
  if (opacityTimer) clearTimeout(opacityTimer)
  opacityTimer = setTimeout(() => {
    cesiumStore.orchardTreeOpacity = treeOpacity.value / 100
  }, 80)
}

const treesLabel = computed(() =>
  cesiumStore.orchardTreesVisible ? '隐藏树木' : '显示树木',
)

function toggleTrees(): void {
  cesiumStore.orchardTreesVisible = !cesiumStore.orchardTreesVisible
}

const modelsLoading = computed(
  () => cesiumStore.orchardModelsVisible && !cesiumStore.orchardModelsLoaded,
)

const modelsLabel = computed(() => {
  if (modelsLoading.value) return '加载中…'
  return cesiumStore.orchardModelsVisible ? '隐藏果园精模' : '显示果园精模'
})

function toggleModels(): void {
  if (modelsLoading.value) return
  cesiumStore.orchardModelsVisible = !cesiumStore.orchardModelsVisible
}

onUnmounted(() => {
  if (opacityTimer) clearTimeout(opacityTimer)
})
</script>

<style scoped lang="scss">
.orchard-control-bar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: $z-layer-5;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  white-space: nowrap;

  .divider {
    width: 1px;
    height: 20px;
    background: $border-subtle;
  }

  .ctrl-group {
    display: flex;
    align-items: center;
    gap: 8px;
    color: $text-sub;
    font-size: 12px;

    .ctrl-label {
      color: $text-sub;
    }

    .ctrl-val {
      min-width: 36px;
      text-align: right;
      color: $neon-cyan;
      font-family: $font-code;
      font-size: 12px;
    }
  }

  .ctrl-range {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      $neon-cyan var(--fill, 100%),
      $border-subtle var(--fill, 100%)
    );
    outline: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: $neon-cyan;
      border: 2px solid #fff;
      box-shadow: 0 0 6px rgba(34, 211, 238, 0.6);
    }
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid $border-subtle;
    background: rgba(255, 255, 255, 0.04);
    color: $text-sub;
    font-size: 12px;
    font-family: $font-ui;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: $text-main;
      border-color: $border-glass;
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.active {
      border-color: rgba(251, 146, 60, 0.4);
      color: $orchard-orange;
      background: rgba(251, 146, 60, 0.12);
    }

    &.primary {
      border-color: rgba(74, 222, 128, 0.35);
      color: $orchard-green;

      &:hover {
        background: rgba(74, 222, 128, 0.12);
      }

      &.active {
        background: rgba(74, 222, 128, 0.15);
      }
    }
  }
}
</style>
