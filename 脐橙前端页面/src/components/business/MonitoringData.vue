<script setup lang="ts">
/**
 * MonitoringData - Displays real sensor monitoring data from the database.
 * Shows pore pressure, stress, strain, and other metrics from 发电引水洞.
 */
import { computed, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import GlassPanel from '@/components/common/GlassPanel.vue'

const store = useDashboardStore()

// Group data by metric type
const porePressures = computed(() => store.porePressures)
const stressData = computed(() => store.stressData)

// Format sensor name for display (truncate long names)
function formatSensorName(name: string): string {
  if (name.length > 20) {
    // Extract key identifier (e.g., "Pcg-1", "Rcg-2")
    const match = name.match(/^([A-Za-z]+\d*-\d+)/)
    if (match) return match[1]
    return name.substring(0, 18) + '...'
  }
  return name
}

// Format value with unit
function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return '--'
  return `${value.toFixed(2)} ${unit || ''}`
}

// Get status class based on value (for visual indication)
function getStatusClass(value: number | null, metric: string): string {
  if (value === null) return 'status-unknown'
  // Add thresholds based on metric type
  if (metric === 'pore_pressure') {
    if (value > 300) return 'status-warning'
    if (value < 0) return 'status-info'
  }
  if (metric === 'stress') {
    if (Math.abs(value) > 50) return 'status-warning'
  }
  return 'status-normal'
}

onMounted(() => {
  // Data is already fetched by Dashboard, but ensure it's loaded
  if (store.porePressures.length === 0) {
    store.fetchData()
  }
})
</script>

<template>
  <GlassPanel title="监测数据" icon="fa-solid fa-gauge-high">
    <div class="monitoring-content">
      <!-- Pore Pressure Section -->
      <div class="section" v-if="porePressures.length > 0">
        <div class="section-header">
          <i class="fa-solid fa-water"></i>
          <span>渗压计 ({{ porePressures.length }})</span>
        </div>
        <div class="data-grid">
          <div
            v-for="item in porePressures.slice(0, 6)"
            :key="`pore-${item.sensor_id}`"
            class="data-card"
            :class="getStatusClass(item.value, 'pore_pressure')"
          >
            <div class="sensor-name" :title="item.station_name">
              {{ formatSensorName(item.station_name) }}
            </div>
            <div class="sensor-value font-mono">
              {{ formatValue(item.value, item.unit) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Stress Section -->
      <div class="section" v-if="stressData.length > 0">
        <div class="section-header">
          <i class="fa-solid fa-arrows-to-circle"></i>
          <span>应力计 ({{ stressData.length }})</span>
        </div>
        <div class="data-grid">
          <div
            v-for="item in stressData.slice(0, 6)"
            :key="`stress-${item.sensor_id}`"
            class="data-card"
            :class="getStatusClass(item.value, 'stress')"
          >
            <div class="sensor-name" :title="item.station_name">
              {{ formatSensorName(item.station_name) }}
            </div>
            <div class="sensor-value font-mono">
              {{ formatValue(item.value, item.unit) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="porePressures.length === 0 && stressData.length === 0" class="empty-state">
        <i class="fa-solid fa-database"></i>
        <span>暂无监测数据</span>
      </div>

      <!-- Real Data Badge -->
      <div class="real-data-badge" v-if="porePressures.length > 0 || stressData.length > 0">
        <i class="fa-solid fa-circle-check"></i>
        <span>真实数据 · 发电引水洞</span>
      </div>
    </div>
  </GlassPanel>
</template>

<style scoped lang="scss">
.monitoring-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  i {
    color: $neon-cyan;
  }
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.data-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  padding: 8px;
  border-left: 3px solid $neon-cyan;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  &.status-normal {
    border-left-color: $success-green;
  }

  &.status-warning {
    border-left-color: $warn-yellow;
  }

  &.status-info {
    border-left-color: $neon-blue;
  }

  &.status-unknown {
    border-left-color: $text-sub;
  }
}

.sensor-name {
  font-size: 10px;
  color: $text-sub;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sensor-value {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: $text-sub;
  gap: 8px;

  i {
    font-size: 24px;
    opacity: 0.5;
  }
}

.real-data-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 10px;
  color: $success-green;
  padding: 6px;
  background: rgba($success-green, 0.1);
  border-radius: 4px;
  margin-top: 4px;

  i {
    font-size: 12px;
  }
}
</style>
