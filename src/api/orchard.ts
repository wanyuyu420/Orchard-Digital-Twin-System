import { apiClient } from './client'
import { normalizeToClosedRing, growthIndexToHealth } from '@/utils/spatial'
import { fromArrayBuffer } from 'geotiff'
import proj4 from 'proj4'
import type {
  FruitTreePoi,
  TsomQueryParams,
  TsomQueryResult,
  FertilizationPlan,
  AnalysisResult,
  RenderParams,
  GeoServerLayer,
  InterpretTask,
} from '@/types/orchard'

/** 根据POI ID获取果树详细信息 */
export function getFruitTreeById(id: string) {
  return apiClient.get<FruitTreePoi>(`/orchard/trees/${id}`)
}

/**
 * TSOM空间查询 - 根据绘制范围查询果树POI
 *
 * 走后端已有的 /orange/spatial-diagnose 接口：
 * 只发送闭合平铺坐标环 {coordinates: [[lng,lat],...]}，
 * rangeType/radius/日期/健康过滤等字段后端不接收，一律不发送。
 */
export async function queryTsom(params: TsomQueryParams): Promise<{ data: TsomQueryResult }> {
  const payload = {
    coordinates: normalizeToClosedRing({
      type: params.rangeType,
      coordinates: params.coordinates,
      radius: params.radius,
    }),
  }
  // GeoScene FeatureServer 空间查询较慢，覆盖默认 5s 超时
  const res = await apiClient.post<DiagnoseResult>(
    '/orange/spatial-diagnose',
    payload,
    { timeout: 30000 },
  )
  return { data: mapDiagnoseToTsomResult(params, res.data) }
}

/**
 * 精确查询 - 全量果树按条件过滤（不需要绘制范围）
 *
 * 走后端 /orange/trees/filter：全量扫描 FeatureServer 后按健康状态过滤，
 * 时间字段在 FeatureServer 中不存在，不参与过滤。响应与拉框一致（DiagnoseResult），
 * 复用 mapDiagnoseToTsomResult 映射。GeoScene 全量扫描较慢，覆盖默认 5s 超时。
 */
export async function queryTreesByFilter(params: TsomQueryParams): Promise<{ data: TsomQueryResult }> {
  const payload = {
    healthStatuses: params.healthStatuses,
    startDate: params.startDate,
    endDate: params.endDate,
  }
  const res = await apiClient.post<DiagnoseResult>(
    '/orange/trees/filter',
    payload,
    { timeout: 90000 },
  )
  return { data: mapDiagnoseToTsomResult(params, res.data) }
}

/**
 * 历史老树 - 大屏开屏拉取全部历史老树坐标与属性
 *
 * 走后端 /orange/historical-trees：GeoScene FeatureServer 中 batch_id='historical_zone'
 * 的全量坐标 + 长势/施肥属性，用于在地图上铺设可拾取点。
 */
export async function getHistoricalTrees(): Promise<{ data: HistoricalTreesResponse }> {
  // GeoScene 全量查询较慢，覆盖默认 5s 超时
  const res = await apiClient.get<HistoricalTreesResponse>(
    '/orange/historical-trees',
    { timeout: 60000 },
  )
  return { data: res.data }
}

/** 获取园区统计数据 */
export function getOrchardStatistics(orchardId: string) {
  return apiClient.get(`/orchard/${orchardId}/statistics`)
}

/** 获取所有园区列表 */
export function getOrchardList() {
  return apiClient.get('/orchard/list')
}

/** 获取指定园区的所有果树 */
export function getOrchardTrees(orchardId: string, page = 1, pageSize = 100) {
  return apiClient.get(`/orchard/${orchardId}/trees`, { params: { page, page_size: pageSize } })
}

/** 获取分析结果 */
export function getAnalysisResult(analysisId: string) {
  return apiClient.get<AnalysisResult>(`/analysis/${analysisId}`)
}

/** 获取分析结果列表 */
export function getAnalysisResults(params?: { type?: string; status?: string }) {
  return apiClient.get<AnalysisResult[]>('/analysis/list', { params })
}

/** 获取施肥方案 */
export function getFertilizationPlan(planId: string) {
  return apiClient.get<FertilizationPlan>(`/fertilization/${planId}`)
}

/** 获取施肥方案列表 */
export function getFertilizationPlans(orchardId?: string) {
  return apiClient.get<FertilizationPlan[]>('/fertilization/list', {
    params: orchardId ? { orchard_id: orchardId } : {},
  })
}

/** 保存/更新颜色渲染参数 */
export function saveRenderParams(params: RenderParams) {
  return apiClient.post('/render/params', params)
}

/** 获取当前渲染参数 */
export function getRenderParams() {
  return apiClient.get<RenderParams>('/render/params')
}

/** 获取GeoServer图层配置 */
export function getGeoserverLayers() {
  return apiClient.get<GeoServerLayer[]>('/geoserver/layers')
}

/** TIF 上传响应（POST /orange/upload-tif） */
export interface TifUploadResponse {
  success: boolean
  message: string
  file_path: string
  spatial_info: {
    crs: string
    transform: number[]
  }
  task_id: string
}

/** 推理任务状态（GET /orange/upload-and-interpret/{task_id}） */
export interface TaskStatus {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  total_trees: number
  fresh_trees: any[]
  progress: number // 0.0 ~ 1.0
}

/** 上传 TIF - 触发 YOLO+SAM 推理任务，返回 task_id */
export function uploadFile(file: File): Promise<{ data: TifUploadResponse }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/orange/upload-tif', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10分钟超时（上传+首响应可能较慢）
  })
}

/** 查询推理任务状态（轮询用） */
export function getTaskStatus(taskId: string) {
  return apiClient.get<TaskStatus>(`/orange/upload-and-interpret/${taskId}`)
}

/** 下载分析结果文件 */
export function downloadAnalysisFile(fileId: string) {
  return apiClient.get(`/download/${fileId}`, { responseType: 'blob' })
}

/** 获取冠层图表统计数据 */
export function getChartStatistics() {
  return apiClient.get('/orchard/chart-data')
}

// ── 上传 TIF 分割（地2 切换）──────────────────────────────

/**
 * 上传 TIF 并触发后端 YOLO+SAM 后台分割（异步，不阻塞）。
 * 对应后端 POST /orange/upload-and-interpret，返回任务信息（含 task_id）。
 */
export function uploadTifAndInterpret(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<InterpretTask> {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient
    .post<InterpretTask>('/orange/upload-and-interpret', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10 分钟超时（大 TIF 上传较慢）
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    .then((res) => res.data)
}

/** 轮询后端分割任务状态，对应 GET /orange/upload-and-interpret/{task_id} */
export function getInterpretTask(taskId: string): Promise<InterpretTask> {
  return apiClient.get<InterpretTask>(`/orange/upload-and-interpret/${taskId}`).then((res) => res.data)
}

/**
 * 从用户上传的 TIF 文件读取 WGS84 边界 [west, south, east, north]。
 * 只解析文件头（IFD/GeoKeys），不读像素，大文件也很快，不会卡死浏览器。
 * 投影栅格（如 UTM）会自动转成 WGS84 经纬度；无地理参考或解析失败返回 null。
 */
export async function readTifBounds(
  file: File,
): Promise<[number, number, number, number] | null> {
  try {
    const buf = await file.arrayBuffer()
    const tiff = await fromArrayBuffer(buf)
    const image = await tiff.getImage()
    const bbox = image.getBoundingBox() // [minx, miny, maxx, maxy]，投影栅格为原生坐标
    const geoKeys: any = image.getGeoKeys?.() ?? {}
    tiff.close()

    if (!bbox || bbox.some((v) => !isFinite(v))) return null

    let west = bbox[0]
    let south = bbox[1]
    let east = bbox[2]
    let north = bbox[3]

    // 投影坐标系（如 UTM）→ WGS84 经纬度
    const epsg = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || 0
    const projStr = epsgToProj4(epsg)
    if (projStr && epsg !== 4326) {
      ;[west, south] = proj4(projStr, 'WGS84', [bbox[0], bbox[1]])
      ;[east, north] = proj4(projStr, 'WGS84', [bbox[2], bbox[3]])
    }

    const result: [number, number, number, number] = [west, south, east, north]
    return result.some((v) => !isFinite(v)) ? null : result
  } catch (e) {
    console.warn('[readTifBounds] Failed to parse TIF bounds:', e)
    return null
  }
}

function epsgToProj4(epsg: number): string | null {
  // UTM 北半球
  if (epsg >= 32601 && epsg <= 32660) {
    return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`
  }
  // UTM 南半球
  if (epsg >= 32701 && epsg <= 32760) {
    return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`
  }
  return null
}

// ── /orange/spatial-diagnose 响应映射 ──────────────────────────────

/** 后端 DiagnoseResultSchema / OrangeTreeOut 响应形状 */
interface DiagnoseResult {
  total_count: number
  avg_height: number | null
  avg_area: number | null
  avg_growth_index: number | null
  fertilizer_recommendation: {
    light_level_count: number
    medium_level_count: number
    heavy_level_count: number
  }
  trees: Array<{
    id: number
    batch_id: string
    lng: number
    lat: number
    height_m?: number | null
    crown_diameter?: number | null
    volume_m3?: number | null
    growth_index?: number | null
    area_m2?: number | null
  }>
}

/** 历史老树接口响应（trees 与 DiagnoseResult.trees 同形状） */
export interface HistoricalTreesResponse {
  total: number
  trees: DiagnoseResult['trees']
}

/** 把后端诊断结果映射为前端 TsomQueryResult，保持 UI 契约不变 */
function mapDiagnoseToTsomResult(params: TsomQueryParams, d: DiagnoseResult): TsomQueryResult {
  const pois: FruitTreePoi[] = d.trees.map((t) => ({
    id: String(t.id),
    name: t.batch_id || `树${t.id}`,
    longitude: t.lng,
    latitude: t.lat,
    altitude: undefined,
    canopyHeight: t.height_m ?? 0, // ?? 0 防止 DetailPanel .toFixed 崩溃
    canopyDiameter: t.crown_diameter ?? 0,
    canopyVolume: t.volume_m3 ?? 0,
    healthStatus: growthIndexToHealth(t.growth_index),
    orchardId: '',
    orchardName: '',
  }))

  const counts = { healthy: 0, warning: 0, critical: 0 }
  for (const t of d.trees) {
    counts[growthIndexToHealth(t.growth_index)]++
  }

  const volumes = d.trees.map((t) => t.volume_m3 ?? 0)
  const areas = d.trees.map((t) => t.area_m2 ?? 0)

  return {
    id: 'q-' + Date.now().toString(36),
    queryParams: params,
    totalTrees: d.total_count,
    pois,
    statistics: {
      averageNdvi: d.avg_growth_index ?? 0,
      totalArea: areas.reduce((a, b) => a + b, 0),
      averageCanopyHeight: d.avg_height ?? 0,
      averageCanopyVolume: volumes.length
        ? volumes.reduce((a, b) => a + b, 0) / volumes.length
        : 0,
      healthyCount: counts.healthy,
      warningCount: counts.warning,
      criticalCount: counts.critical,
    },
    executedAt: new Date().toISOString(),
  }
}
