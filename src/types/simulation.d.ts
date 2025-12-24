export type SimEngine = 'flood' | 'hydro' | 'dam' | 'hec-ras'

export interface SimulationState {
  engine: SimEngine
  // Flood / Hydro Params
  flow: number // m³/s
  roughness: number // n

  // Dam Safety Params
  waterHeight: number // m
  temperature: number // °C
  agingFactor: number // theta

  // Playback
  isPlaying: boolean
  progress: number // 0-100
}

// HEC-RAS specific types
export interface HecRasExtent {
  west: number
  south: number
  east: number
  north: number
}

export interface HecRasCameraConfig {
  height: number
  heading: number
  pitch: number
}

export interface HecRasLegendConfig {
  title: string | null
  min: number | null
  max: number | null
}

export interface HecRasScenarioConfig {
  id: number
  code: string
  name: string
  description: string | null
  extent: HecRasExtent
  camera: HecRasCameraConfig
  framesPath: string
  statsPath: string | null
  totalFrames: number
  frameExtension: string
  legend: HecRasLegendConfig
  isEnabled: boolean
}

export interface HecRasScenarioListItem {
  id: number
  code: string
  name: string
  totalFrames: number
  isEnabled: boolean
}
