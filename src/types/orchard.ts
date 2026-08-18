/** 果树POI信息 */
export interface FruitTreePoi {
  id: string
  name: string
  longitude: number
  latitude: number
  altitude?: number
  /** 冠层高度 (m) */
  canopyHeight: number
  /** 冠层直径 (m) */
  canopyDiameter: number
  /** 冠层体积 (m³) */
  canopyVolume: number
  /** 健康状态: healthy/warning/critical */
  healthStatus: 'healthy' | 'warning' | 'critical'
  /** 所属园区ID */
  orchardId: string
  /** 所属园区名称 */
  orchardName: string
}

/** TSOM查询参数 */
export interface TsomQueryParams {
  /** 查询范围类型（精确查询不按空间范围过滤时可省略） */
  rangeType?: 'rectangle' | 'circle' | 'polygon'
  /** 范围坐标 (GeoJSON Polygon或Circle坐标) */
  coordinates?: number[][][] | number[]
  /** 查询半径 (仅circle类型, 单位: 米) */
  radius?: number
  /** 时间范围开始 */
  startDate?: string
  /** 时间范围结束 */
  endDate?: string
  /** 健康状态筛选 */
  healthStatuses?: string[]
  /** 批次过滤：地1='historical_zone'，地2='orange_tree'，不传则查全量 */
  batchId?: string
}

/** TSOM查询结果 */
export interface TsomQueryResult {
  id: string
  queryParams: TsomQueryParams
  totalTrees: number
  pois: FruitTreePoi[]
  statistics: OrchardStatistics
  executedAt: string
}

/** 园区统计数据 */
export interface OrchardStatistics {
  /** 平均长势/健康指数（UI 标签显示为平均NDVI） */
  averageNdvi: number
  totalArea: number
  averageCanopyHeight: number
  averageCanopyVolume: number
  healthyCount: number
  warningCount: number
  criticalCount: number
}

/** 施肥方案 */
export interface FertilizationPlan {
  id: string
  name: string
  orchardId: string
  /** 关联的分析结果ID */
  analysisId: string
  /** 肥料类型 */
  fertilizerType: string
  /** 施肥量 (kg/亩) */
  amountPerMu: number
  /** 施肥区域 (GeoJSON) */
  areaGeoJson: any
  /** 建议施肥时间 */
  recommendedDate: string
  /** 创建时间 */
  createdAt: string
  /** 施肥状态 */
  status: 'draft' | 'executing' | 'completed'
}

/** 分析结果 */
export interface AnalysisResult {
  id: string
  name: string
  /** 分析类型 */
  type: 'canopy' | 'ndvi' | 'lai' | 'health' | 'yield'
  /** 关联的文件ID */
  fileId: string
  /** 执行时间 */
  executedAt: string
  /** 状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 结果数据 */
  data?: any
  /** 关联的施肥方案 */
  fertilizationPlan?: FertilizationPlan
}

/** 上传文件信息 */
export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  uploadProgress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  /** 上传时间 */
  uploadedAt: string
  /** 分析结果列表 */
  analysisResults: AnalysisResult[]
  /** 子级文件列表 (后端分析后返回) */
  childFiles: UploadedFile[]
  /** 后端推理任务 ID（POST /orange/upload-tif 返回），用于轮询任务进度 */
  taskId?: string
  /** 任务状态消息（推理中/失败原因等） */
  message?: string
  /** 检测到的果树数量（任务完成时） */
  totalTrees?: number
}

/** GeoServer图层配置 */
export interface GeoServerLayer {
  name: string
  title: string
  workspace: string
  type: 'wms' | 'wfs' | 'wmts'
  url: string
  visible: boolean
  opacity: number
  zIndex: number
}

/** 模块菜单项 */
export interface ModuleMenuItem {
  id: string
  label: string
  icon: string
  children?: ModuleMenuItem[]
}

/** 查询窗口层级 */
export type QueryLevel = 'menu' | 'query' | 'result' | 'detail'

// ---- 上传 TIF 分割（地2 切换） ----

/** 后端返回的单棵分割树冠（fresh_trees 元素） */
export interface FreshTree {
  id: string
  batch_id: string
  lng: number
  lat: number
  area_m2?: number | null
  height_m?: number | null
  crown_diameter?: number | null
  volume_m3?: number | null
  growth_index?: number | null
  compactness?: number | null
  shape_length?: number | null
  slope_degree?: number | null
  aspect?: number | null
  elevation_m?: number | null
  fertilizer_level?: number
  fertilizer_kg?: number
  growth_status?: string
  geometry?: any
}

/** 后端 /orange/upload-and-interpret/{task_id} 任务状态响应 */
export interface InterpretTask {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  total_trees: number
  fresh_trees: FreshTree[]
  progress: number
}

/** 前端侧边栏"上传地块"任务卡片 */
export interface UploadPlotTask {
  id: string
  taskId: string
  fileName: string
  fileSize: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  uploadProgress: number
  analysisProgress: number
  totalTrees: number
  freshTrees: FreshTree[]
  /** 上传 TIF 的 WGS84 边界 [west, south, east, north]，用于地2 DOM 底图贴位 */
  domRect: [number, number, number, number] | null
  createdAt: string
}

// ---- 冠层图表统计 ----

/** 图表分桶/分类项 */
export interface ChartDistributionItem {
  name: string
  value: number
}

/** 趋势数据点 */
export interface ChartTrendPoint {
  time: string
  value: number
}

/** 单个指标的图表数据 */
export interface ChartMetricData {
  key: 'canopyVolume' | 'canopyHeight' | 'canopyArea'
  label: string
  unit: string
  avg: number
  min_val: number
  max_val: number
  distribution: ChartDistributionItem[]
  pieData: ChartDistributionItem[]
  trend: ChartTrendPoint[]
}

/** 图表统计接口响应 */
export interface ChartStatistics {
  metrics: ChartMetricData[]
  timestamp: string
}

/** 图表视图类型 */
export type ChartViewType = 'bar' | 'pie' | 'line'

// ── 变量施肥推荐（后端 /orange/fertilizer-plan） ──────────────

/** 各生长指标权重（四项之和必须为 1，与后端 FertilizerWeights 对齐） */
export interface FertilizerWeights {
  growth_index: number
  size: number
  compactness: number
  slope: number
}

/** 变量施肥推荐请求（coordinates 为闭合经纬度环 [[lng,lat],...]） */
export interface FertilizerPlanRequest {
  coordinates: number[][]
  mode?: 'quantile' | 'fixed'
  weights?: Partial<FertilizerWeights>
  thresholds?: [number, number]
  apply?: boolean
}

/** 施肥等级三档统计 */
export interface FertilizerStat {
  light_level_count: number
  medium_level_count: number
  heavy_level_count: number
}

/** 单棵树施肥建议明细 */
export interface FertilizerPlanItem {
  id: number
  lng: number
  lat: number
  growth_index: number | null
  area_m2: number | null
  compactness: number | null
  slope_degree: number | null
  health_score: number
  size_score: number
  compact_score: number
  slope_score: number
  demand_score: number
  current_level: number
  recommended_level: number
}

/** 变量施肥推荐响应 */
export interface FertilizerPlanOut {
  total_trees: number
  mode: string
  weights: FertilizerWeights
  thresholds: number[] | null
  summary: FertilizerStat
  plan: FertilizerPlanItem[]
  applied: boolean
}

// ── 弱树告警（后端 /orange/alerts） ─────────────────────────

/** 弱树告警明细 */
export interface AlertTreeItem {
  id: number
  lng: number
  lat: number
  growth_index: number | null
  area_m2: number | null
  fertilizer_level: number
}

/** 弱树告警响应 */
export interface AlertsOut {
  total: number
  growth_threshold: number
  alerts: AlertTreeItem[]
}
