import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getIotDevices } from '@/api/sensors'

export interface Device {
  id: string
  name: string
  status: 'online' | 'offline'
  type: string // Mapped from protocol
  latency: number
}

export interface LogEntry {
  id: number
  type: 'RX' | 'TX' | 'SYS' | 'ERR' | 'DATA'
  content: string
  timestamp: string
}

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const selectedId = ref<string>('')
  const logs = ref<LogEntry[]>([])

  // Computed: online/offline device counts
  const onlineCount = computed(() => devices.value.filter((d) => d.status === 'online').length)
  const offlineCount = computed(() => devices.value.filter((d) => d.status === 'offline').length)
  const totalCount = computed(() => devices.value.length)

  // Computed: protocol distribution for pie chart
  const protocolDistribution = computed(() => {
    const countMap = new Map<string, number>()
    devices.value.forEach((d) => {
      const proto = d.type || 'Unknown'
      countMap.set(proto, (countMap.get(proto) || 0) + 1)
    })
    return Array.from(countMap.entries()).map(([name, value]) => ({ name, value }))
  })

  // Fetch devices from API
  async function fetchDevices() {
    isLoading.value = true
    error.value = null
    try {
      const apiDevices = await getIotDevices() // Fetches both real and simulated
      devices.value = apiDevices.map((d) => ({
        id: d.device_id,
        name: d.name,
        status: d.status,
        type: d.protocol,
        latency: Math.floor(Math.random() * 100) + 20, // Mock latency for now
      }))

      if (devices.value.length > 0 && !selectedId.value) {
        selectedId.value = devices.value[0].id
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err)
      error.value = 'Failed to load devices'
      // Fallback to empty or cached if needed
    } finally {
      isLoading.value = false
    }
  }

  function selectDevice(id: string) {
    selectedId.value = id
    addLog('SYS', `Switched monitoring to device: ${id}`)
  }

  function addLog(type: LogEntry['type'], content: string) {
    const now = new Date()
    logs.value.push({
      id: Date.now(),
      type,
      content,
      timestamp:
        now.toLocaleTimeString('zh-CN', { hour12: false }) +
        '.' +
        now.getMilliseconds().toString().padStart(3, '0'),
    })

    if (logs.value.length > 100) {
      logs.value.shift()
    }
  }

  // Simulate incoming traffic (Client-side simulation for visualization)
  let interval: any
  function startSimulation() {
    if (devices.value.length === 0) fetchDevices()

    if (interval) return
    interval = setInterval(() => {
      const r = Math.random()
      if (r > 0.9) {
        addLog('ERR', 'Heartbeat timeout detected')
      } else if (r > 0.6) {
        addLog('RX', '68 04 00 04 68 11 22 33 44 16')
        setTimeout(() => {
          addLog('DATA', 'WaterLevel: 24.55m, Rain: 0.5mm')
        }, 200)
      } else if (r > 0.8) {
        addLog('SYS', 'Connecting to MQTT broker... OK')
      }
    }, 2000)
  }

  function stopSimulation() {
    clearInterval(interval)
    interval = null
  }

  return {
    devices,
    selectedId,
    logs,
    isLoading,
    error,
    onlineCount,
    offlineCount,
    totalCount,
    protocolDistribution,
    fetchDevices,
    selectDevice,
    startSimulation,
    stopSimulation,
  }
})
