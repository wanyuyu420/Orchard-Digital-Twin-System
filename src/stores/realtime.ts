/**
 * Realtime data store for WebSocket-streamed sensor data.
 * Maintains sliding windows of data for charts.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
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

    // Actions
    connect,
    disconnect,
    clearData,
  }
})
