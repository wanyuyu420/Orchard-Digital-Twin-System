<template>
  <GlassPanel title="推演结果" icon="fa-solid fa-chart-line" :actions="['export']">
    <!-- Loading State -->
    <div v-if="store.isLoading" class="loading-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>加载数据中...</span>
    </div>

    <!-- Flood/Hydro Results -->
    <div v-else-if="state.engine !== 'dam'">
      <div class="result-metric text-alert-red font-mono">
        {{ store.result.floodArea?.toFixed(1) || '--' }} <span class="unit">km²</span>
      </div>
      <div class="result-label">预计淹没面积</div>

      <!-- Event Details -->
      <div v-if="store.selectedEvent" class="event-details mt-3">
        <div class="detail-row">
          <span class="detail-label">流域</span>
          <span class="detail-value">{{ store.selectedEvent.basin }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">入库流量</span>
          <span class="detail-value font-mono">{{ store.result.peakFlow }} m³/s</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">时间步长</span>
          <span class="detail-value font-mono">{{ store.selectedEvent.products.timeSteps }}h</span>
        </div>
      </div>

      <!-- Flood Progress Chart -->
      <div class="chart-section mt-4">
        <div class="chart-header">
          <span>淹没历时曲线</span>
          <span class="chart-time font-mono">+{{ formatProgress(state.progress) }}h</span>
        </div>
        <FloodProgressChart
          :progress="state.progress"
          :flood-area="store.result.floodArea || 50"
          height="100px"
        />
      </div>
    </div>

    <!-- Dam Safety Results -->
    <div v-else>
      <div class="result-metric text-warn-yellow font-mono">
        {{ store.result.displacement?.toFixed(2) || '--' }} <span class="unit">mm</span>
      </div>
      <div class="result-label">坝顶径向位移 (预测)</div>

      <!-- Dam Parameters Summary -->
      <div class="param-summary mt-3">
        <div class="param-item">
          <span class="param-label">库水位</span>
          <span class="param-value font-mono">{{ state.waterHeight.toFixed(1) }}m</span>
        </div>
        <div class="param-item">
          <span class="param-label">温度</span>
          <span class="param-value font-mono">{{ state.temperature.toFixed(1) }}°C</span>
        </div>
        <div class="param-item">
          <span class="param-label">时效</span>
          <span class="param-value font-mono">{{ state.agingFactor }}</span>
        </div>
      </div>

      <!-- Displacement Trend Chart -->
      <div class="chart-section mt-4">
        <div class="chart-header">
          <span>位移趋势</span>
          <span class="status-badge" :class="displacementStatus">{{ displacementStatusText }}</span>
        </div>
        <DisplacementTrendChart :current-value="store.result.displacement || 0" height="100px" />
      </div>
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSimulationStore } from '@/stores/simulation'
import GlassPanel from '@/components/common/GlassPanel.vue'
import { FloodProgressChart, DisplacementTrendChart } from '@/components/charts'

const store = useSimulationStore()
const { state } = storeToRefs(store)

function formatProgress(progress: number): string {
  const hours = Math.floor((progress / 100) * 24)
  const mins = Math.floor(((progress / 100) * 24 - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Displacement safety indicators
const displacementStatus = computed(() => {
  const d = store.result.displacement || 0
  if (d < 3) return 'safe'
  if (d < 6) return 'warning'
  return 'danger'
})

const displacementStatusText = computed(() => {
  const d = store.result.displacement || 0
  if (d < 3) return '正常'
  if (d < 6) return '注意'
  return '告警'
})
</script>

<style scoped lang="scss">
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: $text-sub;
}

.result-metric {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 4px;
}

.unit {
  font-size: 14px;
  font-weight: normal;
  color: $text-sub;
}

.result-label {
  font-size: 12px;
  color: $text-sub;
}

.text-alert-red {
  color: $alert-red;
  text-shadow: 0 0 10px rgba($alert-red, 0.4);
}

.text-warn-yellow {
  color: $warn-yellow;
  text-shadow: 0 0 10px rgba($warn-yellow, 0.4);
}

.mt-3 {
  margin-top: 12px;
}
.mt-4 {
  margin-top: 20px;
}

// Event Details
.event-details {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
}

.detail-label {
  color: $text-sub;
}

.detail-value {
  color: $text-main;
}

// Chart Section
.chart-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 10px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: $text-sub;
  margin-bottom: 8px;
}

.chart-time {
  color: $neon-cyan;
}

// Param Summary
.param-summary {
  display: flex;
  gap: 10px;
}

.param-item {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 4px;
  text-align: center;
}

.param-label {
  display: block;
  font-size: 10px;
  color: $text-sub;
  margin-bottom: 2px;
}

.param-value {
  font-size: 12px;
  color: $neon-cyan;
}

// Status Badge
.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: bold;

  &.safe {
    background: rgba($success-green, 0.2);
    color: $success-green;
  }
  &.warning {
    background: rgba($warn-yellow, 0.2);
    color: $warn-yellow;
  }
  &.danger {
    background: rgba($alert-red, 0.2);
    color: $alert-red;
  }
}
</style>
