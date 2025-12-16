<template>
  <GlassPanel>
    <template #default>
      <div class="header-row">
        <span class="title-text"> <i class="fa-solid fa-chart-area"></i> 实时水情 </span>
        <span class="alert-tag" v-if="hasAlert">
          <i class="fa-solid fa-triangle-exclamation"></i> 洪峰过境
        </span>
        <span class="status-tag" :class="{ connected: realtimeStore.isConnected }">
          <i class="fa-solid fa-circle"></i> {{ realtimeStore.isConnected ? '实时' : '离线' }}
        </span>
      </div>

      <!-- Real-time Water Level Chart -->
      <div class="chart-wrapper">
        <WaterLevelChart
          :data="chartData"
          height="100px"
          :loading="!realtimeStore.isConnected && chartData.length === 0"
          title=""
        />
      </div>

      <div class="data-row">
        <div class="data-item">
          <div class="label">入库流量</div>
          <div class="value font-mono">
            {{ inflowRate.toLocaleString() }} <span class="unit">m³/s</span>
          </div>
        </div>
        <div class="data-item">
          <div class="label">坝前水位</div>
          <div class="value font-mono text-neon">
            {{ store.reservoirLevel.toFixed(2) }} <span class="unit">m</span>
          </div>
        </div>
      </div>

      <!-- Flow Rate Section -->
      <div class="section-divider"></div>
      <div class="section-header">
        <i class="fa-solid fa-water"></i> 流量监测
        <span class="station-count">{{ flowRateStations.length }} 站</span>
      </div>
      <div class="chart-wrapper">
        <FlowRateChart
          :data="flowRateChartData"
          height="80px"
          :loading="!realtimeStore.isConnected && flowRateChartData.length === 0"
          title=""
        />
      </div>
      <div class="flow-stats">
        <div
          class="stat-item"
          v-for="station in flowRateStations.slice(0, 3)"
          :key="station.sensor_id"
        >
          <span class="station-name">{{ station.station_name }}</span>
          <span class="flow-value"
            >{{ station.history[station.history.length - 1]?.value?.toFixed(3) ?? '-' }} m³/s</span
          >
        </div>
      </div>
    </template>
  </GlassPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useRealtimeStore } from '@/stores/realtime'
import GlassPanel from '@/components/common/GlassPanel.vue'
import { WaterLevelChart, FlowRateChart } from '@/components/charts'

const store = useDashboardStore()
const realtimeStore = useRealtimeStore()

// Connect to WebSocket on mount
onMounted(() => {
  realtimeStore.connect()
})

onUnmounted(() => {
  // Don't disconnect - let other components share the connection
})

// Chart data from realtime store
const chartData = computed(() => realtimeStore.waterLevelChartData)

// Flow rate data from realtime store
const flowRateChartData = computed(() => realtimeStore.flowRateChartData)
const flowRateStations = computed(() => realtimeStore.flowRateHistory)

// Simulated inflow rate (can be enhanced with real data later)
const inflowRate = computed(() => {
  const latest = chartData.value[chartData.value.length - 1]
  if (!latest) return 24500
  // Rough calculation based on water level change
  return Math.round(20000 + latest.value * 100)
})

// Show alert if water level exceeds threshold
const hasAlert = computed(() => {
  const latest = chartData.value[chartData.value.length - 1]
  return latest && latest.value > 45 // Example threshold
})
</script>

<style scoped lang="scss">
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.title-text {
  font-weight: 600;
  @include text-glow($neon-cyan);
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-tag {
  font-size: 10px;
  background: rgba(239, 68, 68, 0.2);
  color: $alert-red;
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-tag {
  font-size: 10px;
  color: $text-sub;
  margin-left: auto;

  i {
    font-size: 6px;
    margin-right: 4px;
  }

  &.connected {
    color: $success-green;
    i {
      animation: pulse 2s infinite;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.chart-wrapper {
  margin-bottom: 12px;
}

.data-row {
  display: flex;
  justify-content: space-between;
}

.data-item {
  .label {
    font-size: 12px;
    color: $text-sub;
    margin-bottom: 2px;
  }
  .value {
    font-size: 16px;
    font-weight: bold;
  }
  .unit {
    font-size: 10px;
    font-weight: normal;
    color: $text-sub;
  }
}

.text-neon {
  color: $neon-cyan;
  text-shadow: 0 0 8px rgba($neon-cyan, 0.4);
}

.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba($neon-cyan, 0.3), transparent);
  margin: 12px 0;
}

.section-header {
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;

  i {
    color: $neon-cyan;
  }

  .station-count {
    margin-left: auto;
    font-size: 10px;
    color: $text-sub;
    opacity: 0.7;
  }
}

.flow-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    padding: 4px 0;
    border-bottom: 1px solid rgba($neon-cyan, 0.1);

    &:last-child {
      border-bottom: none;
    }

    .station-name {
      color: $text-sub;
    }

    .flow-value {
      font-family: 'JetBrains Mono', monospace;
      color: $neon-cyan;
    }
  }
}
</style>
