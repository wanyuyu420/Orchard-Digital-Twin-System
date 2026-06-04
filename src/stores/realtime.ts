/**
 * Realtime data store for WebSocket-streamed sensor data.
 * Maintains sliding windows of data for charts.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  realtimeWs,
  type WebSocketMessage,
  type SensorUpdate,
  type AlertMessage,
} from '@/api/websocket'

const MAX_HISTORY_POINTS = 50

export interface RealtimeDataPoint {
  value: number
  timestamp: Date
}

export interface SensorHistory {
  sensor_id: number
  station_name: string
  metric: string
  unit: string | null
  history: RealtimeDataPoint[]
}

export const useRealtimeStore = defineStore('realtime', () => {
  // Connection status
  const isConnected = ref(false)
  const lastHeartbeat = ref<Date | null>(null)

  // Sensor data with history
  const sensorHistories = ref<Map<string, SensorHistory>>(new Map())

  // Recent alerts
  const recentAlerts = ref<AlertMessage[]>([])
  const maxAlerts = 20

  // Computed: latest water level readings
  const waterLevelHistory = computed(() => {
    const result: SensorHistory[] = []
    sensorHistories.value.forEach((sensor) => {
      if (sensor.metric === 'water_level') {
        result.push(sensor)
      }
    })
    return result
  })

  // Computed: latest rainfall readings
  const rainfallHistory = computed(() => {
    const result: SensorHistory[] = []
    sensorHistories.value.forEach((sensor) => {
      if (sensor.metric === 'rainfall') {
        result.push(sensor)
      }
    })
    return result
  })

  // Computed: latest flow rate readings
  const flowRateHistory = computed(() => {
    const result: SensorHistory[] = []
    sensorHistories.value.forEach((sensor) => {
      if (sensor.metric === 'flow_rate') {
        result.push(sensor)
      }
    })
    return result
  })

  // Computed: latest velocity readings
  const velocityHistory = computed(() => {
    const result: SensorHistory[] = []
    sensorHistories.value.forEach((sensor) => {
      if (sensor.metric === 'velocity') {
        result.push(sensor)
      }
    })
    return result
  })

  // Computed: aggregated water level data for chart (average across stations)
  const waterLevelChartData = computed(() => {
    const histories = waterLevelHistory.value
    if (histories.length === 0) return []

    // Get timestamps from first sensor with data
    const firstWithData = histories.find((h) => h.history.length > 0)
    if (!firstWithData) return []

    return firstWithData.history.map((point, idx) => {
      // Average across all sensors at same index
      let sum = 0
      let count = 0
      histories.forEach((h) => {
        if (h.history[idx]) {
          sum += h.history[idx].value
          count++
        }
      })
      return {
        time: point.timestamp,
        value: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      }
    })
  })

  // Computed: rainfall data grouped by station for bar chart
  const rainfallChartData = computed(() => {
    return rainfallHistory.value.map((sensor) => {
      const latest = sensor.history[sensor.history.length - 1]
      return {
        station: sensor.station_name,
        value: latest?.value ?? 0,
        unit: sensor.unit,
      }
    })
  })

  // Computed: flow rate chart data (aggregated from all hydrological stations)
  const flowRateChartData = computed(() => {
    const histories = flowRateHistory.value
    if (histories.length === 0) return []

    const firstWithData = histories.find((h) => h.history.length > 0)
    if (!firstWithData) return []

    return firstWithData.history.map((point, idx) => {
      let sum = 0
      let count = 0
      histories.forEach((h) => {
        if (h.history[idx]) {
          sum += h.history[idx].value
          count++
        }
      })
      return {
        time: point.timestamp,
        value: count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0,
      }
    })
  })

  // Handle incoming WebSocket messages
  function handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'connection':
        isConnected.value = true
        break

      case 'heartbeat':
        lastHeartbeat.value = new Date(message.timestamp)
        break

      case 'sensor_update':
        updateSensorData(message.data as SensorUpdate[])
        break

      case 'alert_new':
        addAlerts(message.data as AlertMessage[])
        break
    }
  }

  // Update sensor data with new readings
  function updateSensorData(updates: SensorUpdate[]) {
    updates.forEach((update) => {
      if (update.value === null) return

      const key = `${update.sensor_id}:${update.metric}`
      let sensorData = sensorHistories.value.get(key)

      if (!sensorData) {
        sensorData = {
          sensor_id: update.sensor_id,
          station_name: update.station_name,
          metric: update.metric,
          unit: update.unit,
          history: [],
        }
        sensorHistories.value.set(key, sensorData)
      }

      // Add new data point
      const timestamp = update.timestamp ? new Date(update.timestamp) : new Date()
      sensorData.history.push({
        value: update.value,
        timestamp,
      })

      // Keep sliding window
      if (sensorData.history.length > MAX_HISTORY_POINTS) {
        sensorData.history.shift()
      }
    })
  }

  // Add new alerts
  function addAlerts(alerts: AlertMessage[]) {
    alerts.forEach((alert) => {
      recentAlerts.value.unshift(alert)
    })

    // Keep limited number of alerts
    if (recentAlerts.value.length > maxAlerts) {
      recentAlerts.value = recentAlerts.value.slice(0, maxAlerts)
    }
  }

  // Connect to WebSocket
  let unsubscribe: (() => void) | null = null

  function connect() {
    if (unsubscribe) return

    unsubscribe = realtimeWs.subscribe(handleMessage)
    realtimeWs.connect()
  }

  function disconnect() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    realtimeWs.disconnect()
    isConnected.value = false
  }

  // Clear all data
  function clearData() {
    sensorHistories.value.clear()
    recentAlerts.value = []
  }

  return {
    // State
    isConnected,
    lastHeartbeat,
    sensorHistories,
    recentAlerts,

    // Computed
    waterLevelHistory,
    rainfallHistory,
    flowRateHistory,
    velocityHistory,
    waterLevelChartData,
    rainfallChartData,
    flowRateChartData,

    // Actions
    connect,
    disconnect,
    clearData,
  }
})
