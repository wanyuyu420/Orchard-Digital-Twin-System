<template>
  <transition name="fade">
    <div v-if="orchardStore.showAnalysisWindow" class="analysis-window glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <i class="fa-solid fa-microscope"></i>
          <span class="panel-title">数据分析结果</span>
        </div>
        <div class="header-right">
          <el-checkbox
            v-model="orchardStore.autoShowAnalysis"
            size="small"
            style="color: #94a3b8"
          >
            上传后自动弹出
          </el-checkbox>
          <button class="close-btn" @click="orchardStore.showAnalysisWindow = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="panel-body">
        <!-- 无分析结果 -->
        <div v-if="orchardStore.analysisResults.length === 0" class="empty-state">
          <i class="fa-solid fa-chart-bar empty-icon"></i>
          <p>暂无分析结果</p>
          <p class="empty-hint">上传数据文件后，系统将自动进行分析</p>
        </div>

        <!-- 分析结果列表 -->
        <div v-else class="analysis-list">
          <div
            v-for="result in orchardStore.analysisResults"
            :key="result.id"
            class="analysis-card"
            :class="{ active: orchardStore.activeAnalysisId === result.id }"
            @click="orchardStore.activeAnalysisId = result.id"
          >
            <div class="card-header">
              <div class="card-type" :class="result.type">
                <i class="fa-solid" :class="typeIcon(result.type)"></i>
                {{ typeLabel(result.type) }}
              </div>
              <span class="card-status" :class="result.status">
                {{ statusLabel(result.status) }}
              </span>
            </div>
            <div class="card-title">{{ result.name }}</div>
            <div class="card-meta">
              执行时间: {{ formatDate(result.executedAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

function typeIcon(type: string): string {
  switch (type) {
    case 'canopy': return 'fa-cubes'
    case 'ndvi': return 'fa-chart-pie'
    case 'lai': return 'fa-leaf'
    case 'health': return 'fa-heart-pulse'
    case 'yield': return 'fa-wheat-awn'
    default: return 'fa-chart-line'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'canopy': return '冠层分析'
    case 'ndvi': return 'NDVI分析'
    case 'lai': return 'LAI分析'
    case 'health': return '健康评估'
    case 'yield': return '产量预估'
    default: return type
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return '等待中'
    case 'processing': return '分析中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return status
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.analysis-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  max-height: 70vh;
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
    gap: 8px;
    color: $orchard-orange;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
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

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    color: $text-dim;
    margin-bottom: 12px;
  }

  p {
    color: $text-sub;
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
    color: $text-dim;
    margin-top: 6px;
  }
}

.analysis-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analysis-card {
  padding: 14px;
  border-radius: 10px;
  border: 1px solid $border-subtle;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: $border-glass;
    background: rgba(255, 255, 255, 0.03);
  }

  &.active {
    border-color: $orchard-orange;
    background: rgba(251, 146, 60, 0.08);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .card-type {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;

    &.canopy { color: #7c3aed; background: rgba(124, 58, 237, 0.1); }
    &.ndvi { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
    &.lai { color: #22d3ee; background: rgba(34, 211, 238, 0.1); }
    &.health { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    &.yield { color: #eab308; background: rgba(234, 179, 8, 0.1); }
  }

  .card-status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 8px;

    &.completed { color: $success-green; background: rgba(34, 197, 94, 0.1); }
    &.processing { color: $warn-yellow; background: rgba(234, 179, 8, 0.1); }
    &.pending { color: $text-dim; background: rgba(100, 116, 139, 0.1); }
    &.failed { color: $alert-red; background: rgba(239, 68, 68, 0.1); }
  }

  .card-title {
    font-size: 14px;
    font-weight: 500;
    color: $text-main;
  }

  .card-meta {
    font-size: 11px;
    color: $text-dim;
    margin-top: 4px;
  }
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
