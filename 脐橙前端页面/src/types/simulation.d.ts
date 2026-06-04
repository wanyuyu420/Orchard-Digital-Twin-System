export type SimEngine = 'flood' | 'hydro' | 'dam'

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
