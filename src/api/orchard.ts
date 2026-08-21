import { apiClient } from './client'
import { normalizeToClosedRing, growthIndexToHealth } from '@/utils/spatial'
import { DOM_RECT } from '@/utils/orchardPreview'
import { fromArrayBuffer } from 'geotiff'
import proj4 from 'proj4'
import type {
  FruitTreePoi,
  TsomQueryParams,
  TsomQueryResult,
  AnalysisResult,
  GeoServerLayer,
  FertilizerPlanRequest,
  FertilizerPlanOut,
  AlertsOut,
  InterpretTask,
  BasemapCanopyMetric,
  BasemapCanopyOverview,
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
  // 空间查询必须带范围，调用方 setSelectionRange 始终提供 rangeType/coordinates
  const payload: any = {
    coordinates: normalizeToClosedRing({
      type: params.rangeType!,
      coordinates: params.coordinates!,
      radius: params.radius,
    }),
  }
  // 按批次过滤（地1='historical_zone'，地2='orange_tree'），不传则查全量
  if (params.batchId) payload.batch_id = params.batchId
  // GeoScene FeatureServer 空间查询较慢，覆盖默认 5s 超时。
  // 后端 spatial-diagnose 串行跑两次空间查询（query_stats + query_features），
  // 冷缓存/慢查询时单次可达 12s+，30s 不够 → 放宽到 90s
  const res = await apiClient.post<DiagnoseResult>(
    '/orange/spatial-diagnose',
    payload,
    { timeout: 90000 },
  )
  return { data: mapDiagnoseToTsomResult(params, res.data) }
}

/**
 * 精确查询 - 全量果树按条件过滤（不需要绘制范围）
 *
 * 走后端 /orange/trees/filter：扫描 FeatureServer 后按健康状态过滤。
 * 可传 treeId 只查某一棵（精确单树），否则查底图范围内全部树（bbox 限制）。
 * 响应与拉框一致（DiagnoseResult），复用 mapDiagnoseToTsomResult 映射。
 * GeoScene 全量扫描较慢，覆盖默认 5s 超时。
 */
export async function queryTreesByFilter(params: TsomQueryParams): Promise<{ data: TsomQueryResult }> {
  const payload: Record<string, unknown> = {
    healthStatuses: params.healthStatuses,
  }
  if (params.treeId) {
    // 精确单树：只查这一棵，不受底图范围限制
    payload.tree_id = params.treeId
  } else {
    // 只查底图（DOM 影像）范围内的树，排除底图外的树
    payload.bbox = [DOM_RECT.west, DOM_RECT.south, DOM_RECT.east, DOM_RECT.north]
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
/** 底图范围内可查询的果树总数（GeoScene returnCountOnly，果园态势驾驶舱用） */
export function getTreeCountByBbox(bbox: [number, number, number, number]) {
  return apiClient.get<{ count: number }>('/orange/trees/count', {
    params: { bbox: bbox.join(',') },
    // GeoScene 冷缓存 count 单次可达 12s+，30s 不够 → 放宽到 60s
    timeout: 60000,
  })
}

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

/** 变量施肥推荐 - 按框选区域计算每棵树推荐施肥等级 */
export function generateFertilizationPlan(payload: FertilizerPlanRequest) {
  return apiClient.post<FertilizerPlanOut>('/orange/fertilizer-plan', payload, {
    timeout: 60000, // GeoScene 空间查询较慢
  })
}

/**
 * 处方图导出 - GeoJSON/CSV 机具作业文件
 * csv 返回文件流（blob），geojson 返回 JSON 再转 blob 下载
 */
export function exportFertilizationPlan(payload: FertilizerPlanRequest, format: 'csv' | 'geojson') {
  return apiClient.post('/orange/fertilizer-plan/export', { ...payload, format }, {
    responseType: 'blob',
    timeout: 60000,
  })
}

/** 弱树告警 - 生长指数低于阈值的橙树 */
export function getTreeAlerts(params?: { growth_threshold?: number; limit?: number }) {
  // GeoScene 冷缓存首查可达 6s+，全局 5s 超时不够，单独放宽到 30s
  return apiClient.get<AlertsOut>('/orange/alerts', { params, timeout: 30000 })
}

/** 获取GeoServer图层配置 */
export function getGeoserverLayers() {
  return apiClient.get<GeoServerLayer[]>('/geoserver/layers')
}

/** 推理任务状态（POST /orange/upload-and-interpret 与 GET 轮询共用） */
export interface TaskStatus {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  total_trees: number
  fresh_trees: Array<{
    id: number
    lng: number
    lat: number
    growth_index?: number | null
    area_m2?: number | null
    height_m?: number | null
    crown_diameter?: number | null
    volume_m3?: number | null
    fertilizer_kg?: number | null
  }>
  progress: number // 0.0 ~ 1.0
}

/** 上传 TIF - 触发 YOLO+SAM 推理任务（upload-and-interpret），返回 task_id 供轮询 */
export function uploadFile(file: File): Promise<{ data: TaskStatus }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/orange/upload-and-interpret', formData, {
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

/**
 * 范围内树点冠层概览（树点数据，非 3D 树模型）。
 * 经 /orange/trees/filter(bbox) 查询 GeoScene FeatureServer 范围内的树点，
 * 再聚合冠层高度 / 冠层体积 / 冠幅面积（平均·最小·最大）。
 * bbox 缺省为地1 果园范围 DOM_RECT；上传文件后由调用方传入上传文件范围。
 * GeoScene 空间查询较慢，沿用精细查询 90s 超时。
 */
export async function fetchBasemapCanopyOverview(
  bbox: [number, number, number, number] = [
    DOM_RECT.west,
    DOM_RECT.south,
    DOM_RECT.east,
    DOM_RECT.north,
  ],
): Promise<BasemapCanopyOverview> {
  const res = await apiClient.post<DiagnoseResult>(
    '/orange/trees/filter',
    {
      // 只查范围内树点，排除范围外（与精细查询同口径）
      bbox,
    },
    { timeout: 90000 },
  )
  const trees = res.data.trees ?? []

  const readAll = (name: 'height_m' | 'volume_m3' | 'area_m2'): number[] =>
    trees.map((t) => t[name]).filter((v): v is number => typeof v === 'number' && isFinite(v))

  const specs: [BasemapCanopyMetric['key'], string, string, number[]][] = [
    ['canopyHeight', '冠层高度', 'm', readAll('height_m')],
    ['canopyVolume', '冠层体积', 'm³', readAll('volume_m3')],
    ['canopyArea', '冠幅面积', 'm²', readAll('area_m2')],
  ]

  const metrics: BasemapCanopyMetric[] = []
  for (const [key, label, unit, values] of specs) {
    if (!values.length) continue
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    metrics.push({
      key,
      label,
      unit,
      avg: +avg.toFixed(2),
      min: +Math.min(...values).toFixed(2),
      max: +Math.max(...values).toFixed(2),
      count: values.length,
    })
  }

  return { totalTrees: trees.length, metrics, timestamp: new Date().toISOString() }
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
