<template>
  <ModalBox title="设备运维中心" icon="fa-solid fa-microchip">
    <div class="device-layout">
      <!-- Left: Stats + Charts + Topology -->
      <div class="layout-col left-col">
        <!-- Stats Summary -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-value text-cyan">{{ sensorStats.total }}</div>
            <div class="stat-label">传感器总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-green">{{ sensorStats.active }}</div>
            <div class="stat-label">在线</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-yellow">{{ sensorStats.offline }}</div>
            <div class="stat-label">离线</div>
          </div>
        </div>

        <!-- Device Status Charts - Larger size -->
        <div class="charts-section">
          <div class="chart-card">
            <DeviceGaugeChart
              :online="sensorStats.active"
              :total="sensorStats.total"
              height="200px"
              title="设备在线率"
            />
          </div>
          <div class="chart-card">
            <ProtocolPieChart
              :data="sensorTypeDistribution"
              height="200px"
              title="传感器类型分布"
            />
          </div>
        </div>

        <div class="col-header">
          <span>传感器列表</span>
          <span class="header-count">({{ sensors.length }})</span>
        </div>
        <div class="sensor-list">
          <div
            v-for="sensor in sensors"
            :key="sensor.id"
            class="sensor-item"
            :class="{
              selected: selectedSensorId === sensor.id,
              offline: sensor.status !== 'active',
            }"
            @click="selectSensor(sensor.id)"
          >
            <div class="sensor-info">
              <div class="sensor-name">{{ sensor.point_code }}</div>
              <div class="sensor-type">{{ sensor.sensor_type_name || '未知类型' }}</div>
            </div>
            <div class="sensor-status">
              <span class="status-dot" :class="sensor.status"></span>
              <span class="status-text">{{ sensor.status === 'active' ? '在线' : '离线' }}</span>
            </div>
          </div>
          <div v-if="sensors.length === 0 && !isLoading" class="empty-state">
            <i class="fa-solid fa-database"></i>
            <span>暂无传感器数据</span>
          </div>
          <div v-if="isLoading" class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
        </div>
      </div>

      <!-- Right: Logs -->
      <div class="layout-col right-col">
        <TerminalLog />
      </div>
    </div>
  </ModalBox>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ModalBox from '@/components/common/ModalBox.vue'
import TerminalLog from '@/components/business/TerminalLog.vue'
import { DeviceGaugeChart, ProtocolPieChart } from '@/components/charts'
import { useDeviceStore } from '@/stores/device'
import { useRealtimeStore } from '@/stores/realtime'
import * as adminApi from '@/api/admin'

const store = useDeviceStore()
const realtimeStore = useRealtimeStore()

// Real sensor data from database
const sensors = ref<adminApi.SensorAdmin[]>([])
const isLoading = ref(false)
const selectedSensorId = ref<number | null>(null)

// Computed stats from real sensor data
const sensorStats = computed(() => {
  const total = sensors.value.length
  const active = sensors.value.filter((s) => s.status === 'active').length
  const offline = sensors.value.filter((s) => s.status !== 'active').length
  return { total, active, offline }
})

// Sensor type distribution for pie chart
const sensorTypeDistribution = computed(() => {
  const countMap = new Map<string, number>()
  sensors.value.forEach((s) => {
    const typeName = s.sensor_type_name || '未知'
    countMap.set(typeName, (countMap.get(typeName) || 0) + 1)
  })
  return Array.from(countMap.entries()).map(([name, value]) => ({ name, value }))
})

function selectSensor(id: number) {
  selectedSensorId.value = id
  const sensor = sensors.value.find((s) => s.id === id)
  if (sensor) {
    store.selectDevice(sensor.point_code)
  }
}

async function loadSensors() {
  isLoading.value = true
  try {
    const response = await adminApi.fetchSensors({ page_size: 100 })
    sensors.value = response.items
    if (sensors.value.length > 0 && !selectedSensorId.value) {
      selectedSensorId.value = sensors.value[0].id
    }
  } catch (err) {
    console.error('Failed to fetch sensors:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  // Fetch real sensor data from database
  loadSensors()
  // Also fetch IoT devices for backward compatibility
  store.fetchDevices()
  // Start log simulation
  store.startSimulation()
  // Connect WebSocket
  realtimeStore.connect()
})

onUnmounted(() => {
  store.stopSimulation()
})
</script>

<style scoped lang="scss">
.device-layout {
  display: flex;
  height: calc(100vh - 200px);
  min-height: 500px;
  gap: 20px;
}

.layout-col {
  display: flex;
  flex-direction: column;
}

.left-col {
  width: 380px;
  border-right: 1px solid $border-subtle;
  padding-right: 20px;
}

.right-col {
  flex: 1;
  min-width: 0;
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  font-family: 'JetBrains Mono', monospace;
}

.stat-label {
  font-size: 11px;
  color: $text-sub;
  margin-top: 4px;
}

.text-cyan {
  color: $neon-cyan;
}

.text-green {
  color: $success-green;
}

.text-yellow {
  color: $warn-yellow;
}

.charts-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.chart-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 10px;
  color: $text-main;

  .header-count {
    font-weight: normal;
    color: $text-sub;
    font-size: 12px;
  }
}

.sensor-list {
  flex: 1;
  overflow-y: auto;
  @include custom-scrollbar;
}

.sensor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.selected {
    background: rgba($neon-cyan, 0.1);
    border-color: rgba($neon-cyan, 0.3);
  }

  &.offline {
    opacity: 0.6;
  }
}

.sensor-info {
  flex: 1;
  min-width: 0;
}

.sensor-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-main;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sensor-type {
  font-size: 11px;
  color: $text-sub;
  margin-top: 2px;
}

.sensor-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $text-sub;

  &.active {
    background: $success-green;
    box-shadow: 0 0 6px rgba($success-green, 0.5);
  }

  &.offline,
  &.deleted {
    background: $text-sub;
  }
}

.status-text {
  font-size: 11px;
  color: $text-sub;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: $text-sub;
  gap: 12px;

  i {
    font-size: 24px;
    opacity: 0.5;
  }
}
</style>
