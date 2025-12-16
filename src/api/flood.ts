/**
 * Flood Visualization API Client
 */
import apiClient from './client'

// ============ Flood Scenarios ============

export interface FloodFrame {
  id: number
  time_step: number
  water_level: number
  area_km2: number
  polygons: GeoJSON.MultiPolygon | null
}

export interface FloodScenario {
  id: number
  code: string
  name: string
  region_extent: number | null
  description: string | null
  created_at: string
  frame_count: number
}

export interface FloodScenarioDetail extends FloodScenario {
  region_center_lng: number | null
  region_center_lat: number | null
  frames: FloodFrame[]
}

/**
 * Get list of all flood scenarios
 */
export const getFloodScenarios = async (): Promise<FloodScenario[]> => {
  const response = await apiClient.get<FloodScenario[]>('/v1/flood/scenarios')
  return response.data
}

/**
 * Get detailed flood scenario with all frames
 */
export const getFloodScenarioDetail = async (scenarioId: number): Promise<FloodScenarioDetail> => {
  const response = await apiClient.get<FloodScenarioDetail>(`/v1/flood/scenarios/${scenarioId}`)
  return response.data
}

/**
 * Get interpolated flood frame at specific progress
 */
export const getFloodFrame = async (scenarioId: number, progress: number): Promise<FloodFrame> => {
  const response = await apiClient.get<FloodFrame>(`/v1/flood/scenarios/${scenarioId}/frame`, {
    params: { progress },
  })
  return response.data
}
