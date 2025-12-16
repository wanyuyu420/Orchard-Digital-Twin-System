/**
 * Admin API client for data management
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginationParams {
  page?: number
  page_size?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  is_simulated?: boolean
}

// ============ Sensors ============

export interface SensorAdmin {
  id: number
  point_code: string
  status: string
  section_id: number
  section_name: string | null
  sensor_type_id: number
  sensor_type_name: string | null
  install_date: string | null
  is_simulated: boolean
}

export interface SensorCreate {
  point_code: string
  section_id: number
  sensor_type_id: number
  status?: string
  is_simulated?: boolean
}

export interface SensorUpdate {
  point_code?: string
  status?: string
}

export async function fetchSensors(
  params: PaginationParams & { status?: string; sensor_type_id?: number }
): Promise<PaginatedResponse<SensorAdmin>> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.search) query.set('search', params.search)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_order) query.set('sort_order', params.sort_order)
  if (params.status) query.set('status', params.status)
  if (params.sensor_type_id) query.set('sensor_type_id', String(params.sensor_type_id))
  if (params.is_simulated !== undefined) query.set('is_simulated', String(params.is_simulated))

  const res = await fetch(`${API_BASE}/api/v1/admin/sensors?${query}`)
  if (!res.ok) throw new Error('Failed to fetch sensors')
  return res.json()
}

export async function createSensor(data: SensorCreate): Promise<SensorAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sensors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create sensor')
  return res.json()
}

export async function updateSensor(id: number, data: SensorUpdate): Promise<SensorAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sensors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update sensor')
  return res.json()
}

export async function deleteSensor(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sensors/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete sensor')
}

// ============ Readings ============

export interface ReadingAdmin {
  id: number
  sensor_id: number
  sensor_name: string | null
  metric_id: number
  metric_key: string | null
  reading_time: string
  value_num: number | null
  unit: string | null
  quality_flag: string
  is_simulated: boolean
}

export async function fetchReadings(
  params: PaginationParams & {
    sensor_id?: number
    metric_key?: string
    start_time?: string
    end_time?: string
    quality_flag?: string
  }
): Promise<PaginatedResponse<ReadingAdmin>> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_order) query.set('sort_order', params.sort_order)
  if (params.sensor_id) query.set('sensor_id', String(params.sensor_id))
  if (params.metric_key) query.set('metric_key', params.metric_key)
  if (params.start_time) query.set('start_time', params.start_time)
  if (params.end_time) query.set('end_time', params.end_time)
  if (params.quality_flag) query.set('quality_flag', params.quality_flag)
  if (params.is_simulated !== undefined) query.set('is_simulated', String(params.is_simulated))

  const res = await fetch(`${API_BASE}/api/v1/admin/readings?${query}`)
  if (!res.ok) throw new Error('Failed to fetch readings')
  return res.json()
}

export async function deleteReading(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/readings/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete reading')
}

// ============ Hydrological Stations ============

export interface StationAdmin {
  id: number
  station_code: string
  station_name: string
  river_name: string | null
  basin_name: string | null
  facility_id: number
  facility_name: string | null
  is_simulated: boolean
}

export interface StationCreate {
  station_code: string
  station_name: string
  facility_id: number
  river_name?: string
  basin_name?: string
  is_simulated?: boolean
}

export interface StationUpdate {
  station_name?: string
  river_name?: string
  basin_name?: string
}

export async function fetchStations(
  params: PaginationParams
): Promise<PaginatedResponse<StationAdmin>> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.search) query.set('search', params.search)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_order) query.set('sort_order', params.sort_order)
  if (params.is_simulated !== undefined) query.set('is_simulated', String(params.is_simulated))

  const res = await fetch(`${API_BASE}/api/v1/admin/hydrological_stations?${query}`)
  if (!res.ok) throw new Error('Failed to fetch stations')
  return res.json()
}

export async function createStation(data: StationCreate): Promise<StationAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/hydrological_stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create station')
  return res.json()
}

export async function updateStation(id: number, data: StationUpdate): Promise<StationAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/hydrological_stations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update station')
  return res.json()
}

export async function deleteStation(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/hydrological_stations/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete station')
}

// ============ Facilities ============

export interface FacilityAdmin {
  id: number
  code: string
  name: string
  facility_type: string | null
  location_desc: string | null
  is_simulated: boolean
  section_count: number
}

export interface FacilityCreate {
  code: string
  name: string
  facility_type?: string
  location_desc?: string
  is_simulated?: boolean
}

export interface FacilityUpdate {
  name?: string
  facility_type?: string
  location_desc?: string
}

export async function fetchFacilities(
  params: PaginationParams & { facility_type?: string }
): Promise<PaginatedResponse<FacilityAdmin>> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.search) query.set('search', params.search)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_order) query.set('sort_order', params.sort_order)
  if (params.facility_type) query.set('facility_type', params.facility_type)
  if (params.is_simulated !== undefined) query.set('is_simulated', String(params.is_simulated))

  const res = await fetch(`${API_BASE}/api/v1/admin/facilities?${query}`)
  if (!res.ok) throw new Error('Failed to fetch facilities')
  return res.json()
}

export async function createFacility(data: FacilityCreate): Promise<FacilityAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/facilities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create facility')
  return res.json()
}

export async function updateFacility(id: number, data: FacilityUpdate): Promise<FacilityAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/facilities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update facility')
  return res.json()
}

export async function deleteFacility(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/facilities/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete facility')
}

// ============ Sections ============

export interface SectionAdmin {
  id: number
  code: string
  name: string
  facility_id: number
  facility_name: string | null
  section_type: string | null
  chainage: string | null
  is_simulated: boolean
  sensor_count: number
}

export interface SectionCreate {
  code: string
  name: string
  facility_id: number
  section_type?: string
  chainage?: string
  is_simulated?: boolean
}

export interface SectionUpdate {
  name?: string
  section_type?: string
  chainage?: string
}

export async function fetchSections(
  params: PaginationParams & { facility_id?: number; section_type?: string }
): Promise<PaginatedResponse<SectionAdmin>> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.search) query.set('search', params.search)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_order) query.set('sort_order', params.sort_order)
  if (params.facility_id) query.set('facility_id', String(params.facility_id))
  if (params.section_type) query.set('section_type', params.section_type)
  if (params.is_simulated !== undefined) query.set('is_simulated', String(params.is_simulated))

  const res = await fetch(`${API_BASE}/api/v1/admin/sections?${query}`)
  if (!res.ok) throw new Error('Failed to fetch sections')
  return res.json()
}

export async function createSection(data: SectionCreate): Promise<SectionAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create section')
  return res.json()
}

export async function updateSection(id: number, data: SectionUpdate): Promise<SectionAdmin> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update section')
  return res.json()
}

export async function deleteSection(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sections/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete section')
}

// ============ Sensor Types (lookup) ============

export interface SensorType {
  id: number
  code: string
  name: string
  unit: string | null
}

export async function fetchSensorTypes(): Promise<SensorType[]> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sensor_types`)
  if (!res.ok) throw new Error('Failed to fetch sensor types')
  return res.json()
}
