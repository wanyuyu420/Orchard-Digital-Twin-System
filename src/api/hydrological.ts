/**
 * 水文站 API 客户端
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface HydrologicalStation {
  id: number
  station_code: string
  station_name: string
  river_name: string | null
  basin_name: string | null
  datum_elevation: number | null
  is_simulated: boolean
  latest_flow_rate: number | null
  latest_velocity: number | null
  latest_water_level: number | null
  latest_time: string | null
}

export interface FlowRateData {
  station_id: number
  station_code: string
  station_name: string
  latest_flow_rate: number | null
  latest_velocity: number | null
  latest_water_level: number | null
  unit: string | null
  time: string | null
  is_simulated: boolean
}

export interface StationReading {
  reading_time: string
  metric_key: string
  value: number | null
  unit: string | null
}

export interface StationReadingsResponse {
  station_id: number
  station_code: string
  station_name: string
  readings: StationReading[]
  total_count: number
}

/**
 * 获取水文站列表
 */
export async function fetchHydrologicalStations(
  isSimulated?: boolean
): Promise<HydrologicalStation[]> {
  const params = new URLSearchParams()
  if (isSimulated !== undefined) {
    params.set('is_simulated', String(isSimulated))
  }
  const url = `${API_BASE}/api/v1/hydrological_stations${params.toString() ? '?' + params : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch hydrological stations: ${response.statusText}`)
  }
  return response.json()
}

/**
 * 获取单个水文站详情
 */
export async function fetchHydrologicalStation(stationId: number): Promise<HydrologicalStation> {
  const response = await fetch(`${API_BASE}/api/v1/hydrological_stations/${stationId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch station: ${response.statusText}`)
  }
  return response.json()
}

/**
 * 获取站点历史读数
 */
export async function fetchStationReadings(
  stationId: number,
  options?: {
    startTime?: Date
    endTime?: Date
    metric?: string
    limit?: number
  }
): Promise<StationReadingsResponse> {
  const params = new URLSearchParams()
  if (options?.startTime) {
    params.set('start_time', options.startTime.toISOString())
  }
  if (options?.endTime) {
    params.set('end_time', options.endTime.toISOString())
  }
  if (options?.metric) {
    params.set('metric', options.metric)
  }
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }
  const url = `${API_BASE}/api/v1/hydrological_stations/${stationId}/readings${params.toString() ? '?' + params : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch readings: ${response.statusText}`)
  }
  return response.json()
}

/**
 * 获取所有站点最新流量数据
 */
export async function fetchFlowRates(isSimulated?: boolean): Promise<FlowRateData[]> {
  const params = new URLSearchParams()
  if (isSimulated !== undefined) {
    params.set('is_simulated', String(isSimulated))
  }
  const url = `${API_BASE}/api/v1/flow_rates${params.toString() ? '?' + params : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch flow rates: ${response.statusText}`)
  }
  return response.json()
}
