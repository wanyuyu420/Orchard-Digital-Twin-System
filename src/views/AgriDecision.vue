<template>
  <div class="agri-decision">
    <!-- 农情决策面板 - 当查询面板或图层详细信息面板显示时隐藏 -->
    <div class="decision-panel glass-panel" v-show="!orchardStore.showQueryPanel && !orchardStore.showLayerDetailPanel">
      <div class="panel-header">
        <i class="fa-solid fa-lightbulb"></i>
        精准农情决策建议
      </div>

      <!-- 农事操作入口 -->
      <div class="action-buttons">
        <button class="action-btn fert" @click="orchardStore.showFertilizationWindow = true">
          <i class="fa-solid fa-droplet"></i>
          <div class="action-text">
            <span class="action-title">施肥方案</span>
            <span class="action-desc">按生长指标生成变量施肥推荐</span>
          </div>
        </button>
        <button class="action-btn alert" @click="onOpenAlerts">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div class="action-text">
            <span class="action-title">弱树告警</span>
            <span class="action-desc">巡检生长指数低于阈值的弱树</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

/** 弱树告警：拉取告警列表 + 打开窗口 + 显示地图红点 */
function onOpenAlerts() {
  orchardStore.fetchTreeAlerts().catch(() => {})
}

</script>

<style scoped lang="scss">
.agri-decision {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.decision-panel {
  position: absolute;
  right: 16px;
  bottom: 480px;
  width: 340px;
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    font-size: 14px;
    font-weight: 600;
    color: #fb923c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.action-buttons {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  > i {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  &.fert {
    color: $neon-cyan;

    &:hover {
      background: rgba(34, 211, 238, 0.12);
      border-color: rgba(34, 211, 238, 0.3);
    }
  }

  &.alert {
    color: $alert-red;

    &:hover {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.3);
    }
  }

  .action-text {
    display: flex;
    flex-direction: column;

    .action-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
    }

    .action-desc {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      margin-top: 1px;
    }
  }
}
</style>
