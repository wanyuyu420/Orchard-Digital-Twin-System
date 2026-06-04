<template>
  <div class="agri-decision">
    <!-- 农情决策面板 - 当查询面板或图层详细信息面板显示时隐藏 -->
    <div class="decision-panel glass-panel" v-show="!orchardStore.showQueryPanel && !orchardStore.showLayerDetailPanel">
      <div class="panel-header">
        <i class="fa-solid fa-lightbulb"></i>
        精准农情决策建议
      </div>
      <div class="panel-body">
        <div class="decision-item" v-for="item in decisionItems" :key="item.id">
          <div class="decision-icon" :style="{ background: item.color + '20' }">
            <i :class="item.icon" :style="{ color: item.color }"></i>
          </div>
          <div class="decision-content">
            <div class="decision-title">{{ item.title }}</div>
            <div class="decision-desc">{{ item.description }}</div>
          </div>
        </div>
      </div>

      <!-- 关联施肥方案 -->
      <div class="linked-plans" v-if="orchardStore.fertilizationPlans.length > 0">
        <div class="section-header">关联施肥方案</div>
        <div
          v-for="plan in orchardStore.fertilizationPlans"
          :key="plan.id"
          class="plan-item"
          @click="orchardStore.activeFertilizationId = plan.id; orchardStore.showFertilizationWindow = true"
        >
          <i class="fa-solid fa-file-prescription"></i>
          <span>{{ plan.name }}</span>
          <span class="plan-status" :class="plan.status">{{ plan.status === 'completed' ? '已完成' : '执行中' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

const decisionItems = [
  {
    id: 1,
    icon: 'fa-solid fa-droplet',
    color: '#22d3ee',
    title: '灌溉建议',
    description: '根据冠层LAI指数，建议对低LAI区域增加灌溉频次至每日1次',
  },
  {
    id: 2,
    icon: 'fa-solid fa-flask',
    color: '#a78bfa',
    title: '施肥建议',
    description: 'NDVI<0.4的果树区域需补充氮肥，建议用量15kg/亩',
  },
  {
    id: 3,
    icon: 'fa-solid fa-shield-halved',
    color: '#f87171',
    title: '病虫害预警',
    description: '检测到3处区域叶面积指数异常下降，建议实地排查',
  },
  {
    id: 4,
    icon: 'fa-solid fa-clock',
    color: '#fbbf24',
    title: '采收预测',
    description: '基于冠层体积和NDVI趋势，预计最佳采收期: 11月15日-25日',
  },
]

onMounted(() => {
  orchardStore.fetchFertilizationPlans()
})
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
  bottom: 80px;
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

  .panel-body {
    padding: 12px 18px;
  }
}

.decision-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  &:last-child {
    border-bottom: none;
  }

  .decision-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 15px;
  }

  .decision-content {
    .decision-title {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
    }

    .decision-desc {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 3px;
      line-height: 1.5;
    }
  }
}

.linked-plans {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 18px;

  .section-header {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
  }
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .plan-status {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: auto;

    &.completed {
      color: $success-green;
      background: rgba(34, 197, 94, 0.1);
    }
    &.executing {
      color: $warn-yellow;
      background: rgba(234, 179, 8, 0.1);
    }
  }
}
</style>
