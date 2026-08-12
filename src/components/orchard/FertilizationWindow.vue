<template>
  <transition name="fade">
    <div v-if="orchardStore.showFertilizationWindow" class="fertilization-window glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <i class="fa-solid fa-droplet"></i>
          <span class="panel-title">施肥方案</span>
        </div>
        <div class="header-right">
          <el-checkbox
            v-model="orchardStore.autoShowFertilization"
            size="small"
            style="color: #94a3b8"
          >
            上传后自动弹出
          </el-checkbox>
          <button class="close-btn" @click="orchardStore.showFertilizationWindow = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="panel-body">
        <!-- 无施肥方案 -->
        <div v-if="orchardStore.fertilizationPlans.length === 0" class="empty-state">
          <i class="fa-solid fa-seedling empty-icon"></i>
          <p>暂无施肥方案</p>
          <p class="empty-hint">完成冠层分析后，系统将生成精准施肥建议</p>
        </div>

        <!-- 施肥方案列表 -->
        <div v-else class="fert-list">
          <div
            v-for="plan in orchardStore.fertilizationPlans"
            :key="plan.id"
            class="fert-card"
            :class="{ active: orchardStore.activeFertilizationId === plan.id }"
            @click="orchardStore.activeFertilizationId = plan.id"
          >
            <div class="card-header">
              <div class="fert-type">
                <i class="fa-solid fa-flask"></i>
                {{ plan.fertilizerType }}
              </div>
              <span class="fert-status" :class="plan.status">
                {{ fertStatusLabel(plan.status) }}
              </span>
            </div>
            <div class="card-title">{{ plan.name }}</div>
            <div class="card-details">
              <div class="fert-detail">
                <span class="detail-label">施肥量</span>
                <span class="detail-value">{{ plan.amountPerMu }} kg/亩</span>
              </div>
              <div class="fert-detail">
                <span class="detail-label">建议时间</span>
                <span class="detail-value">{{ formatDate(plan.recommendedDate) }}</span>
              </div>
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

function fertStatusLabel(status: string): string {
  switch (status) {
    case 'draft': return '草稿'
    case 'executing': return '执行中'
    case 'completed': return '已完成'
    default: return status
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped lang="scss">
.fertilization-window {
  position: absolute;
  left: calc(50% + 16px);
  top: calc(50% + 16px);
  transform: translate(-50%, -50%);
  width: 460px;
  max-height: 60vh;
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
    color: $neon-cyan;
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
  padding: 30px 20px;

  .empty-icon {
    font-size: 40px;
    color: $text-dim;
    margin-bottom: 10px;
  }

  p {
    color: $text-sub;
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
    color: $text-dim;
    margin-top: 4px;
  }
}

.fert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fert-card {
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
    border-color: $neon-cyan;
    background: rgba(34, 211, 238, 0.08);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .fert-type {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: $neon-cyan;
    background: rgba(34, 211, 238, 0.1);
    padding: 2px 10px;
    border-radius: 12px;
  }

  .fert-status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 8px;

    &.draft { color: $text-dim; background: rgba(100, 116, 139, 0.1); }
    &.executing { color: $warn-yellow; background: rgba(234, 179, 8, 0.1); }
    &.completed { color: $success-green; background: rgba(34, 197, 94, 0.1); }
  }

  .card-title {
    font-size: 14px;
    font-weight: 500;
    color: $text-main;
    margin-bottom: 8px;
  }

  .card-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .fert-detail {
    .detail-label {
      display: block;
      font-size: 10px;
      color: $text-dim;
      text-transform: uppercase;
    }
    .detail-value {
      font-size: 13px;
      color: $text-main;
      font-weight: 500;
    }
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
