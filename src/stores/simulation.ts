import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SimulationState, SimEngine, HecRasScenarioListItem, HecRasScenarioConfig } from '@/types/simulation'
import {
  getFloodEvents,
  getModelProducts,
  getWaterLevels,
  type FloodEvent,
  type ModelProduct,
  type WaterLevel,
} from '@/api/sensors'

export interface SimulationResult {
  floodArea: number | null // km² for flood/hydro
  displacement: number | null // mm for dam
  peakFlow: number | null // m³/s
  maxWaterLevel: number | null // m
}

export const useSimulationStore = defineStore('simulation', () => {
  const state = ref<SimulationState>({
    engine: 'flood',
    flow: 2500,
    roughness: 0.035,
    waterHeight: 165.5,
    temperature: 24.5,
    agingFactor: 0.01,
    isPlaying: false,
    progress: 0, // Start at beginning
  })

  // Playback timer
  let playbackInterval: ReturnType<typeof setInterval> | null = null
  const PLAYBACK_SPEED = 50 // ms per tick
  const PROGRESS_PER_TICK = 0.5 // progress increment per tick

  // Backend data
  const floodEvents = ref<FloodEvent[]>([])
  const modelProducts = ref<ModelProduct[]>([])
  const waterLevels = ref<WaterLevel[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Selected event for simulation
  const selectedEventId = ref<string | null>(null)

  // Current flood area from visualization layer (updated by FloodLayer)
  const currentFloodArea = ref<number | null>(null)

  // Computed: current selected flood event
  const selectedEvent = computed(() => {
    return floodEvents.value.find((e) => e.id === selectedEventId.value) || null
  })

  // Computed: simulation result based on engine and data
  const result = computed<SimulationResult>(() => {
    if (state.value.engine === 'dam') {
      // HST-Stat regression: simplified formula
      // δ = a*H + b*T + c*θ (H=水位, T=温度, θ=时效)
      const H = state.value.waterHeight
      const T = state.value.temperature
      const theta = state.value.agingFactor
      // Simplified coefficients
      const displacement = 0.015 * H + 0.08 * T + 50 * theta
      return {
        floodArea: null,
        displacement: Math.round(displacement * 100) / 100,
        peakFlow: null,
        maxWaterLevel: H,
      }
    } else {
      // Flood/Hydro simulation
      // If we have real-time flood area from visualization, use it
      if (currentFloodArea.value !== null) {
        return {
          floodArea: currentFloodArea.value,
          displacement: null,
          peakFlow: state.value.flow,
          maxWaterLevel: waterLevels.value[0]?.latest_level || 165.5,
        }
      }
      // Otherwise use event data or fallback calculation
      const event = selectedEvent.value
      if (event) {
        // Use real event data
        return {
          floodArea: event.affectedArea,
          displacement: null,
          peakFlow: state.value.flow,
          maxWaterLevel: waterLevels.value[0]?.latest_level || 165.5,
        }
      }
      // Fallback: calculate from parameters
      // Simplified Manning's equation approximation
      const Q = state.value.flow
      const n = state.value.roughness
      const area = Q * n * 0.05 + 50 // Simplified
      return {
        floodArea: Math.round(area * 10) / 10,
        displacement: null,
        peakFlow: Q,
        maxWaterLevel: waterLevels.value[0]?.latest_level || 165.5,
      }
    }
  })

  // Fetch flood events from backend
  async function fetchFloodEvents() {
    try {
      floodEvents.value = await getFloodEvents()
      if (floodEvents.value.length > 0 && !selectedEventId.value) {
        selectedEventId.value = floodEvents.value[0].id
      }
    } catch (err) {
      console.error('Failed to fetch flood events:', err)
    }
  }

  // Fetch model products from backend
  async function fetchModelProducts() {
    try {
      modelProducts.value = await getModelProducts()
    } catch (err) {
      console.error('Failed to fetch model products:', err)
    }
  }

  // Fetch water levels for reference
  async function fetchWaterLevels() {
    try {
      waterLevels.value = await getWaterLevels()
      // Update initial water height from real data
      if (waterLevels.value.length > 0 && waterLevels.value[0].latest_level) {
        state.value.waterHeight = waterLevels.value[0].latest_level
      }
    } catch (err) {
      console.error('Failed to fetch water levels:', err)
    }
  }

  // Fetch all simulation-related data
  async function fetchData() {
    isLoading.value = true
    error.value = null
    try {
      await Promise.all([fetchFloodEvents(), fetchModelProducts(), fetchWaterLevels()])
    } catch (err) {
      error.value = 'Failed to load simulation data'
      console.error(err)
    } finally {
      isLoading.value = false
    }
  }

  function setEngine(engine: SimEngine) {
    state.value.engine = engine
  }

  function selectEvent(eventId: string) {
    selectedEventId.value = eventId
    // Update flow from event if available
    const event = floodEvents.value.find((e) => e.id === eventId)
    if (event) {
      // Adjust flow based on severity
      const flowMap = { mild: 1500, medium: 3000, severe: 5000 }
      state.value.flow = flowMap[event.severity] || 2500
    }
  }

  function togglePlay() {
    state.value.isPlaying = !state.value.isPlaying
    if (state.value.isPlaying) {
      startPlayback()
    } else {
      stopPlayback()
    }
  }

  function startPlayback() {
    if (playbackInterval) return
    // Reset to start if at end
    if (state.value.progress >= 100) {
      state.value.progress = 0
    }
    playbackInterval = setInterval(() => {
      state.value.progress += PROGRESS_PER_TICK
      if (state.value.progress >= 100) {
        state.value.progress = 100
        stopPlayback()
        state.value.isPlaying = false
      }
    }, PLAYBACK_SPEED)
  }

  function stopPlayback() {
    if (playbackInterval) {
      clearInterval(playbackInterval)
      playbackInterval = null
    }
  }

  function setProgress(val: number) {
    state.value.progress = Math.max(0, Math.min(100, val))
  }

  // Set current flood area from external source (FloodLayer)
  function setFloodArea(area: number | null) {
    currentFloodArea.value = area
  }

  // ============ HEC-RAS State ============

  const hecRasScenarios = ref<HecRasScenarioListItem[]>([])
  const selectedHecRasId = ref<number | null>(null)
  const hecRasStats = ref<any[]>([])
  const selectedHecRasScenario = ref<HecRasScenarioConfig | null>(null)

  // Fetch HEC-RAS scenarios from API
  async function fetchHecRasScenarios() {
    try {
      const response = await fetch('/api/v1/hec-ras/scenarios')
      if (!response.ok) throw new Error('Failed to fetch HEC-RAS scenarios')
      hecRasScenarios.value = await response.json()
      
      // Auto-select first scenario if none selected, and load its stats
      if (hecRasScenarios.value.length > 0 && !selectedHecRasId.value) {
        const firstId = hecRasScenarios.value[0].id
        selectedHecRasId.value = firstId
        await loadHecRasStats(firstId)
      }
    } catch (err) {
      console.error('Failed to fetch HEC-RAS scenarios:', err)
    }
  }

  // Load HEC-RAS stats for a scenario
  const hecRasOutflow = ref<any[]>([])
  
  async function loadHecRasStats(scenarioId: number) {
    // Clear previous data immediately to prevent stale data display
    hecRasStats.value = []
    hecRasOutflow.value = []
    
    try {
      // First get scenario details
      const response = await fetch(`/api/v1/hec-ras/scenarios/${scenarioId}`)
      if (!response.ok) throw new Error('Failed to fetch scenario details')
      
      const scenario = await response.json()
      selectedHecRasScenario.value = scenario
      
      // Then load stats JSON
      if (scenario.stats_path) {
        const statsResponse = await fetch(scenario.stats_path)
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          hecRasStats.value = statsData.data || statsData || []
        }
      }
      
      // Load outflow.json for KB scenario (cumulative outflow)
      if (scenario.code === 'kb') {
        const outflowPath = scenario.stats_path.replace('stats.json', 'outflow.json')
        try {
          const outflowResponse = await fetch(outflowPath)
          if (outflowResponse.ok) {
            const outflowData = await outflowResponse.json()
            hecRasOutflow.value = outflowData.data || outflowData || []
          }
        } catch (e) {
          console.warn('Outflow data not available')
        }
      } else {
        hecRasOutflow.value = []
      }
    } catch (err) {
      console.error('Failed to load HEC-RAS stats:', err)
    }
  }

  // Select HEC-RAS scenario
  function selectHecRasScenario(id: number) {
    selectedHecRasId.value = id
    loadHecRasStats(id)
    // Reset progress when switching scenarios
    state.value.progress = 0
  }

  return {
    state,
    floodEvents,
    modelProducts,
    waterLevels,
    selectedEventId,
    selectedEvent,
    result,
    isLoading,
    error,
    fetchData,
    setEngine,
    selectEvent,
    togglePlay,
    setProgress,
    setFloodArea,
    // HEC-RAS
    hecRasScenarios,
    selectedHecRasId,
    hecRasStats,
    hecRasOutflow,
    selectedHecRasScenario,
    fetchHecRasScenarios,
    loadHecRasStats,
    selectHecRasScenario,
  }
})

