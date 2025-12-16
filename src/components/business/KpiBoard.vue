<template>
  <GlassPanel title="运行概览" icon="fa-solid fa-server">
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">安全运行</div>
        <div class="value font-mono">2,140 <span class="unit">天</span></div>
      </div>
      <div class="kpi-card">
        <div class="label">当前蓄水</div>
        <div class="value font-mono text-neon-blue">
          {{ store.storagePercent }} <span class="unit">%</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="label">在线设备</div>
        <div class="value font-mono text-neon-cyan">
          {{ store.onlineDevices }}<span class="unit">/{{ store.totalDevices }}</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="label">今日告警</div>
        <div class="value font-mono" :class="alertClass">
          {{ store.todayAlerts }} <span class="unit">条</span>
        </div>
      </div>
    </div>

    <!-- Rainfall Sparkline -->
    <div class="sparkline-section" v-if="rainfallSparklineData.length > 0">
      <div class="sparkline-label"><i class="fa-solid fa-cloud-rain"></i> 近期降雨趋势</div>
      <SparklineChart :data="rainfallSparklineData" height="32px" />
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useRealtimeStore } from '@/stores/realtime'
import GlassPanel from '@/components/common/GlassPanel.vue'
import { SparklineChart } from '@/components/charts'

const store = useDashboardStore()
const realtimeStore = useRealtimeStore()

onMounted(() => {
  realtimeStore.connect()
})

const alertClass = computed(() => {
  if (store.todayAlerts === 0) return 'text-success'
  if (store.todayAlerts < 3) return 'text-warn'
  return 'text-alert'
})

// Rainfall sparkline data from realtime store
const rainfallSparklineData = computed(() => {
  const data = realtimeStore.rainfallChartData
  if (data.length === 0) return []
  return data.map((d) => d.value)
})
</script>

<style scoped lang="scss">
.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kpi-card {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  border-radius: 4px;
  transition: background 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.label {
  font-size: 10px;
  color: $text-sub;
  margin-bottom: 4px;
}

.value {
  font-size: 18px;
  font-weight: bold;
}

.unit {
  font-size: 10px;
  color: $text-sub;
  font-weight: normal;
}

.sparkline-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sparkline-label {
  font-size: 10px;
  color: $text-sub;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;

  i {
    color: $neon-blue;
  }
}

.text-neon-blue {
  color: $neon-blue;
  text-shadow: 0 0 8px rgba($neon-blue, 0.4);
}

.text-neon-cyan {
  color: $neon-cyan;
  text-shadow: 0 0 8px rgba($neon-cyan, 0.4);
}

.text-success {
  color: $success-green;
  text-shadow: 0 0 8px rgba($success-green, 0.4);
}

.text-warn {
  color: $warn-yellow;
  text-shadow: 0 0 8px rgba($warn-yellow, 0.4);
}

.text-alert {
  color: $alert-red;
  text-shadow: 0 0 8px rgba($alert-red, 0.4);
}
</style>
