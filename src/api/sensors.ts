import apiClient from './client'

export interface IotDevice {
  id: number
  device_id: string
  name: string
  protocol: string
  station_id: string | null
  metrics: Record<string, any>
  freq_sec: number
  status: 'online' | 'offline'
  is_simulated: boolean
}

export const getIotDevices = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<IotDevice[]>('/iot_devices', { params })
  return response.data
}

export interface WaterLevel {
  sensor_id: number
  station_name: string
  latest_level: number | null
  unit: string
  time: string | null
  is_simulated: boolean
}

export const getWaterLevels = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<WaterLevel[]>('/water_levels', { params })
  return response.data
}

export interface Rainfall {
  sensor_id: number
  station_name: string
  latest_rainfall: number | null
  unit: string
  time: string | null
  is_simulated: boolean
}

export const getRainfallData = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<Rainfall[]>('/rainfall_data', { params })
  return response.data
}

// ============ Metric Latest (Generic) ============

export interface MetricLatest {
  sensor_id: number
  station_name: string
  metric: string
  value: number | null
  unit: string
  time: string | null
  is_simulated: boolean
}

export const getPorePressures = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<MetricLatest[]>('/pore_pressures', { params })
  return response.data
}

export const getStressData = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<MetricLatest[]>('/stress_data', { params })
  return response.data
}

// ============ Products ============

export interface ModelProduct {
  id: number
  domain: string
  name: string
  version: string
  valid_from: string | null
  valid_to: string | null
  product_type: string
  path: string | null
  meta: Record<string, any> | null
  is_simulated: boolean
}

export const getModelProducts = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<ModelProduct[]>('/model_products', { params })
  return response.data
}

export interface RasterProduct {
  id: number
  domain: string
  name: string
  product_type: string
  path: string | null
  time_start: string | null
  time_end: string | null
  crs: string | null
  resolution: string | null
  meta: Record<string, any> | null
  is_simulated: boolean
}

export const getRasterProducts = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<RasterProduct[]>('/raster_products', { params })
  return response.data
}

export interface VectorProduct {
  id: number
  domain: string
  name: string
  product_type: string
  path: string | null
  time_start: string | null
  time_end: string | null
  srid: number | null
  meta: Record<string, any> | null
  is_simulated: boolean
}

export const getVectorProducts = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<VectorProduct[]>('/vector_products', { params })
  return response.data
}

// ============ Stats & Warnings ============

export interface Stats {
  online_devices: number
  total_devices: number
  today_alerts: number
  reservoir_capacity_percent: number
  average_rainfall_mm: number
}

export const getStats = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<Stats>('/stats', { params })
  return response.data
}

export interface Warning {
  sensor_id: number | null
  metric: string
  level: string
  message: string
  time: string | null
  is_simulated: boolean
}

export const getWarnings = async (isSimulated?: boolean) => {
  const params = isSimulated !== undefined ? { is_simulated: isSimulated } : {}
  const response = await apiClient.get<Warning[]>('/warnings', { params })
  return response.data
}

// ============ Flood Events ============

export interface FloodEvent {
  id: string
  name: string
  severity: 'mild' | 'medium' | 'severe'
  level: 'blue' | 'yellow' | 'orange' | 'red'
  status: 'active' | 'resolved'
  start: string
  end: string
  region: string
  basin: string
  center: { lng: number; lat: number }
  affectedArea: number
  description: string
  products: {
    inundationGeoJson: string
    waterSurfaceTileset: string
    rainGrid: string
    timeSteps: number
  }
}

export const getFloodEvents = async () => {
  const response = await apiClient.get<FloodEvent[]>('/events')
  return response.data
}

// ============ Rain Grid Frames ============

export interface RainFrame {
  id: string
  time: string
  grid: string
  coverage: string
}

export const getRainFrames = async () => {
  const response = await apiClient.get<RainFrame[]>('/rain_frames')
  return response.data
}
