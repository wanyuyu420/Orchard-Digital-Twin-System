<template>
  <transition name="slide-right">
    <div v-if="orchardStore.showRenderSettings" class="render-settings glass-panel">
      <div class="panel-header">
        <span class="panel-title">颜色渲染参数设置</span>
        <button class="close-btn" @click="orchardStore.showRenderSettings = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="panel-body">
        <!-- 默认参数勾选 -->
        <div class="default-toggle">
          <el-checkbox
            v-model="orchardStore.useDefaultParams"
            @change="orchardStore.toggleDefaultParams"
          >
            使用默认参数
          </el-checkbox>
        </div>

        <!-- 颜色方案 -->
        <div class="form-group">
          <label>颜色方案</label>
          <el-select v-model="localParams.colorScheme" style="width: 100%">
            <el-option label="NDVI (植被指数)" value="ndvi">
              <div class="scheme-preview">
                <span class="scheme-bar ndvi-bar"></span>
                NDVI (植被指数)
              </div>
            </el-option>
            <el-option label="LAI (叶面积指数)" value="lai">
              <div class="scheme-preview">
                <span class="scheme-bar lai-bar"></span>
                LAI (叶面积指数)
              </div>
            </el-option>
            <el-option label="冠层高度" value="canopyHeight">
              <div class="scheme-preview">
                <span class="scheme-bar canopy-bar"></span>
                冠层高度
              </div>
            </el-option>
            <el-option label="健康状态" value="health">
              <div class="scheme-preview">
                <span class="scheme-bar health-bar"></span>
                健康状态
              </div>
            </el-option>
            <el-option label="施肥方案" value="fertilization">
              <div class="scheme-preview">
                <span class="scheme-bar fert-bar"></span>
                施肥方案
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- NDVI范围 -->
        <div class="form-group" v-if="localParams.colorScheme === 'ndvi'">
          <label>NDVI 范围</label>
          <el-slider
            v-model="ndviSliderRange"
            range
            :min="0"
            :max="1"
            :step="0.05"
            :marks="{ 0: '0', 0.5: '0.5', 1: '1' }"
            @change="onNdviChange"
          />
        </div>

        <!-- LAI范围 -->
        <div class="form-group" v-if="localParams.colorScheme === 'lai'">
          <label>LAI 范围</label>
          <el-slider
            v-model="laiSliderRange"
            range
            :min="0"
            :max="8"
            :step="0.1"
            :marks="{ 0: '0', 4: '4', 8: '8' }"
            @change="onLaiChange"
          />
        </div>

        <!-- 冠层高度范围 -->
        <div class="form-group" v-if="localParams.colorScheme === 'canopyHeight'">
          <label>冠层高度范围 (m)</label>
          <el-slider
            v-model="canopyHeightSliderRange"
            range
            :min="0"
            :max="10"
            :step="0.1"
            :marks="{ 0: '0', 2.5: '2.5', 5: '5', 7.5: '7.5', 10: '10' }"
            @change="onCanopyHeightChange"
          />
        </div>

        <!-- 透明度 -->
        <div class="form-group">
          <label>图层透明度</label>
          <el-slider
            v-model="localParams.opacity"
            :min="0"
            :max="1"
            :step="0.05"
            :marks="{ 0: '0', 0.5: '50%', 1: '100%' }"
            show-input
          />
        </div>

        <!-- 等值线 -->
        <div class="form-group">
          <el-checkbox v-model="localParams.showContour">
            显示等值线
          </el-checkbox>
        </div>

        <div class="form-group" v-if="localParams.showContour">
          <label>等值线间距</label>
          <el-slider
            v-model="localParams.contourInterval"
            :min="0.05"
            :max="0.5"
            :step="0.05"
            :marks="{ 0.05: '0.05', 0.25: '0.25', 0.5: '0.5' }"
          />
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="panel-footer">
        <el-button @click="resetSettings">重置默认</el-button>
        <el-button type="primary" @click="applySettings">
          <i class="fa-solid fa-check"></i>
          应用
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { ElMessage } from 'element-plus'
import type { RenderParams } from '@/types/orchard'
import { DEFAULT_RENDER_PARAMS } from '@/types/orchard'

const orchardStore = useOrchardStore()

const localParams = reactive<RenderParams>({ ...orchardStore.renderParams })

const ndviSliderRange = ref<[number, number]>([localParams.ndviMin, localParams.ndviMax])
const laiSliderRange = ref<[number, number]>([localParams.laiMin, localParams.laiMax])
const canopyHeightSliderRange = ref<[number, number]>([
  localParams.canopyHeightMin,
  localParams.canopyHeightMax,
])

// 同步store默认参数变化
watch(
  () => orchardStore.useDefaultParams,
  (useDefault) => {
    if (useDefault) {
      Object.assign(localParams, DEFAULT_RENDER_PARAMS)
      ndviSliderRange.value = [DEFAULT_RENDER_PARAMS.ndviMin, DEFAULT_RENDER_PARAMS.ndviMax]
      laiSliderRange.value = [DEFAULT_RENDER_PARAMS.laiMin, DEFAULT_RENDER_PARAMS.laiMax]
      canopyHeightSliderRange.value = [
        DEFAULT_RENDER_PARAMS.canopyHeightMin,
        DEFAULT_RENDER_PARAMS.canopyHeightMax,
      ]
    }
  },
)

function onNdviChange(val: [number, number]) {
  localParams.ndviMin = val[0]
  localParams.ndviMax = val[1]
}

function onLaiChange(val: [number, number]) {
  localParams.laiMin = val[0]
  localParams.laiMax = val[1]
}

function onCanopyHeightChange(val: [number, number]) {
  localParams.canopyHeightMin = val[0]
  localParams.canopyHeightMax = val[1]
}

function applySettings() {
  orchardStore.updateRenderParams({ ...localParams })
  orchardStore.showRenderSettings = false
  ElMessage.success('渲染参数已应用')
}

function resetSettings() {
  Object.assign(localParams, DEFAULT_RENDER_PARAMS)
  ndviSliderRange.value = [DEFAULT_RENDER_PARAMS.ndviMin, DEFAULT_RENDER_PARAMS.ndviMax]
  laiSliderRange.value = [DEFAULT_RENDER_PARAMS.laiMin, DEFAULT_RENDER_PARAMS.laiMax]
  canopyHeightSliderRange.value = [
    DEFAULT_RENDER_PARAMS.canopyHeightMin,
    DEFAULT_RENDER_PARAMS.canopyHeightMax,
  ]
  ElMessage.info('参数已重置为默认值')
}
</script>

<style scoped lang="scss">
.render-settings {
  position: absolute;
  right: 24px;
  top: 80px;
  width: 420px;
  max-height: calc(100vh - 120px);
  z-index: $z-layer-7;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .close-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover { color: $alert-red; }
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.default-toggle {
  margin-bottom: 16px;
  padding: 10px 14px;
  background: rgba(251, 146, 60, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(251, 146, 60, 0.1);
}

.form-group {
  margin-bottom: 18px;

  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.scheme-preview {
  display: flex;
  align-items: center;
  gap: 8px;

  .scheme-bar {
    width: 32px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;

    &.ndvi-bar { background: linear-gradient(90deg, #8b4513, #eab308, #22c55e, #166534); }
    &.lai-bar { background: linear-gradient(90deg, #fef08a, #a3e635, #22c55e, #166534); }
    &.canopy-bar { background: linear-gradient(90deg, #22d3ee, #3b82f6, #7c3aed); }
    &.health-bar { background: linear-gradient(90deg, #ef4444, #eab308, #22c55e); }
    &.fert-bar { background: linear-gradient(90deg, #d4a574, #fb923c, #22c55e, #166534); }
  }
}

.panel-footer {
  padding: 14px 18px;
  border-top: 1px solid $border-subtle;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s $ease-out;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
