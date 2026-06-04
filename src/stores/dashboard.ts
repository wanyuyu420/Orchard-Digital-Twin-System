import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getWaterLevels,
  getRainfallData,
  getStats,
  getWarnings,
  getPorePressures,
  getStressData,
  type WaterLevel,
  type Rainfall,
  type Stats,
  type Warning,
  type MetricLatest,
} from '@/api/sensors'

export const useDashboardStore = defineStore('dashboard', () => {
  // Raw data from API
  const waterLevels = ref<WaterLevel[]>([])
  const rainfall = ref<Rainfall[]>([])
  const porePressures = ref<MetricLatest[]>([])
  const stressData = ref<MetricLatest[]>([])
  const warnings = ref<Warning[]>([])
  const stats = ref<Stats | null>(null)

  // Loading state
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Derived stats (fallback if API doesn't return)
  const reservoirLevel = ref(165.5)
  const storagePercent = ref(76)
  const totalRainfall = ref(0)

  // Computed: total devices from stats
  const totalDevices = computed(() => stats.value?.total_devices || 0)
  const onlineDevices = computed(() => stats.value?.online_devices || 0)
  const todayAlerts = computed(() => stats.value?.today_alerts || warnings.value.length)

  // Computed: primary water level (first reservoir)
  const primaryWaterLevel = computed(() => {
    const reservoir = waterLevels.value.find((w) => w.station_name.startsWith('res_'))
    return reservoir?.latest_level || reservoirLevel.value
  })

  // Computed: average rainfall
  const averageRainfall = computed(() => {
    if (stats.value?.average_rainfall_mm) return stats.value.average_rainfall_mm
    const values = rainfall.value
      .map((r) => r.latest_rainfall)
      .filter((v): v is number => v !== null)
    return values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
      : 0
  })

  // Computed: latest pore pressure reading
  const latestPorePressure = computed(() => {
    if (porePressures.value.length === 0) return null
    return porePressures.value[0]
  })

  // Computed: active warnings count by level
  const warningsByLevel = computed(() => {
    const result = { Yellow: 0, Orange: 0, Red: 0 }
    warnings.value.forEach((w) => {
      if (w.level in result) {
        result[w.level as keyof typeof result]++
      }
    })
    return result
  })

  async function fetchData() {
    isLoading.value = true
    error.value = null

    try {
      const [wlData, rainData, statsData, warningsData, poreData, stressResult] = await Promise.all(
        [
          getWaterLevels(),
          getRainfallData(),
          getStats().catch(() => null),
          getWarnings().catch(() => []),
          getPorePressures().catch(() => []),
          getStressData().catch(() => []),
        ]
      )

      waterLevels.value = wlData
      rainfall.value = rainData
      stats.value = statsData
      warnings.value = warningsData
      porePressures.value = poreData
      stressData.value = stressResult

      // Update derived stats from real data
      if (wlData.length > 0 && wlData[0].latest_level) {
        reservoirLevel.value = wlData[0].latest_level
        // Calculate storage percent based on max level (varies by reservoir)
        const maxLevel = 2000 // Default max
        storagePercent.value = Math.min(100, Math.round((reservoirLevel.value / maxLevel) * 100))
      }

      // Update rainfall
      const rainValues = rainData
        .map((r) => r.latest_rainfall)
        .filter((v): v is number => v !== null)
      if (rainValues.length > 0) {
        totalRainfall.value = rainValues.reduce((a, b) => a + b, 0) / rainValues.length
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      error.value = 'Failed to load dashboard data'
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Raw data
    waterLevels,
    rainfall,
    porePressures,
    stressData,
    warnings,
    stats,
    // Loading state
    isLoading,
    error,
    // Derived values
    reservoirLevel,
    storagePercent,
    totalRainfall,
    // Computed
    totalDevices,
    onlineDevices,
    todayAlerts,
    primaryWaterLevel,
    averageRainfall,
    latestPorePressure,
    warningsByLevel,
    // Actions
    fetchData,
  }
})
