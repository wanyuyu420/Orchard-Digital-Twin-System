<template>
  <transition name="fade">
    <!-- 4详细内容窗口（居中弹窗） -->
    <div v-if="orchardStore.showDetailPanel && detailPoi" class="detail-panel glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <button class="back-btn" @click="orchardStore.goBackQueryLevel">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="panel-title">果树详情</span>
        </div>
        <button class="close-btn" @click="orchardStore.goBackQueryLevel">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="detail-body">
        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="section-label">基本信息</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">POI ID</span>
              <span class="info-value">{{ detailPoi.id }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">名称</span>
              <span class="info-value">{{ detailPoi.name || '--' }}</span>
            </div>


            <div class="info-item">
              <span class="info-label">所属园区</span>
              <span class="info-value">{{ detailPoi.orchardName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">位置</span>
              <span class="info-value">{{ detailPoi.longitude.toFixed(6) }}, {{ detailPoi.latitude.toFixed(6) }}</span>
            </div>
          </div>
        </div>

        <!-- 冠层参数 -->
        <div class="detail-section">
          <div class="section-label">冠层参数</div>
          <div class="param-cards">
            <div class="param-card">
              <div class="param-value">{{ detailPoi.canopyHeight.toFixed(2) }}m</div>
              <div class="param-label">冠层高度</div>
            </div>
            <div class="param-card">
              <div class="param-value">{{ detailPoi.canopyDiameter.toFixed(2) }}m</div>
              <div class="param-label">冠层直径</div>
            </div>
            <div class="param-card">
              <div class="param-value">{{ detailPoi.canopyVolume.toFixed(2) }}m³</div>
              <div class="param-label">冠层体积</div>
            </div>

          </div>
        </div>

        <!-- 健康状态 -->
        <div class="detail-section">
          <div class="section-label">健康评估</div>
          <div class="health-bar">
            <div class="health-indicator" :class="detailPoi.healthStatus">
              <i class="fa-solid" :class="healthIcon"></i>
              <span>{{ healthLabel }}</span>
            </div>
            <div class="health-info">
              <span>健康指数: {{ detailPoi.healthStatus === 'healthy' ? '健康' : detailPoi.healthStatus === 'warning' ? '预警' : '严重' }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- 操作按钮 -->
      <div class="panel-footer">
        <el-button @click="locateOnMap">
          <i class="fa-solid fa-location-crosshairs"></i>
          地图定位
        </el-button>
        <el-button type="primary" @click="viewAnalysis">
          <i class="fa-solid fa-chart-simple"></i>
          查看分析
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { useCesiumStore } from '@/stores/cesium'

const orchardStore = useOrchardStore()
const cesiumStore = useCesiumStore()

const detailPoi = computed(() => {
  if (orchardStore.queryLevel === 'detail') {
    return orchardStore.selectedPoiDetail
  }
  return null
})

const healthIcon = computed(() => {
  if (!detailPoi.value) return 'fa-circle-question'
  switch (detailPoi.value.healthStatus) {
    case 'healthy': return 'fa-circle-check'
    case 'warning': return 'fa-triangle-exclamation'
    case 'critical': return 'fa-circle-xmark'
    default: return 'fa-circle-question'
  }
})

const healthLabel = computed(() => {
  if (!detailPoi.value) return '--'
  switch (detailPoi.value.healthStatus) {
    case 'healthy': return '健康'
    case 'warning': return '预警'
    case 'critical': return '严重'
    default: return '未知'
  }
})

function formatDate(dateStr: string) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function locateOnMap() {
  if (!detailPoi.value) return
  const viewer = cesiumStore.viewer
  if (viewer) {
    viewer.camera.flyTo({
      destination: (window as any).Cesium.Cartesian3.fromDegrees(
        detailPoi.value.longitude,
        detailPoi.value.latitude,
        200,
      ),
    })
  }
}

function viewAnalysis() {
  orchardStore.showDetailPanel = false
  orchardStore.showAnalysisWindow = true
}
</script>

<style scoped lang="scss">
.detail-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 560px;
  max-height: 80vh;
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .back-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover {
      color: $text-main;
      background: rgba(255, 255, 255, 0.08);
    }
  }

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

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.detail-section {
  margin-bottom: 18px;

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 6px;
    border-bottom: 1px solid $border-subtle;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;

  .info-label {
    font-size: 12px;
    color: $text-dim;
  }

  .info-value {
    font-size: 13px;
    color: $text-main;
    font-family: $font-code;
  }
}

.param-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .param-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid $border-subtle;
    border-radius: 10px;
    padding: 12px;
    text-align: center;

    .param-value {
      font-size: 22px;
      font-weight: 700;
      color: $orchard-orange;
      font-family: $font-code;
    }

    .param-label {
      font-size: 11px;
      color: $text-dim;
      margin-top: 4px;
    }
  }
}

.health-bar {
  .health-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 13px;
    margin-bottom: 12px;

    &.healthy {
      background: rgba(34, 197, 94, 0.1);
      color: $success-green;
    }

    &.warning {
      background: rgba(234, 179, 8, 0.1);
      color: $warn-yellow;
    }

    &.critical {
      background: rgba(239, 68, 68, 0.1);
      color: $alert-red;
    }
  }

  .ndvi-bar-container {
    display: flex;
    align-items: center;
    gap: 10px;

    .ndvi-bar-label {
      font-size: 11px;
      color: $text-dim;
      width: 30px;
    }

    .ndvi-bar {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;

      .ndvi-fill {
        height: 100%;
        background: linear-gradient(90deg, #ef4444, #eab308, #22c55e);
        border-radius: 3px;
        transition: width 0.5s ease;
      }
    }

    .ndvi-value {
      font-size: 13px;
      font-weight: 600;
      color: $text-main;
      font-family: $font-code;
    }
  }
}

.panel-footer {
  padding: 14px 18px;
  border-top: 1px solid $border-subtle;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
