/** 果树POI信息 */
export interface FruitTreePoi {
  id: string
  name: string
  longitude: number
  latitude: number
  altitude?: number
  /** 品种 */
  variety: string
  /** 树龄 */
  treeAge: number
  /** 冠层高度 (m) */
  canopyHeight: number
  /** 冠层直径 (m) */
  canopyDiameter: number
  /** 冠层体积 (m³) */
  canopyVolume: number
  /** 叶面积指数 */
  leafAreaIndex: number
  /** NDVI值 */
  ndvi: number
  /** 健康状态: healthy/warning/critical */
  healthStatus: 'healthy' | 'warning' | 'critical'
  /** 所属园区ID */
  orchardId: string
  /** 所属园区名称 */
  orchardName: string
  /** 最后更新时间 */
  updatedAt: string
}

/** TSOM查询参数 */
export interface TsomQueryParams {
  /** 查询范围类型 */
  rangeType: 'rectangle' | 'circle' | 'polygon'
  /** 范围坐标 (GeoJSON Polygon或Circle坐标) */
  coordinates: number[][][] | number[]
  /** 查询半径 (仅circle类型, 单位: 米) */
  radius?: number
  /** 时间范围开始 */
  startDate?: string
  /** 时间范围结束 */
  endDate?: string
  /** 品种筛选 */
  varieties?: string[]
  /** 健康状态筛选 */
  healthStatuses?: string[]
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
  totalArea: number
  averageNdvi: number
  averageLai: number
  averageCanopyHeight: number
  averageCanopyVolume: number
  healthyCount: number
  warningCount: number
  criticalCount: number
  varietyDistribution: Record<string, number>
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
  /** 施肥颜色渲染参数 */
  renderParams: RenderParams
}

/** 颜色渲染参数 */
export interface RenderParams {
  /** 颜色方案 */
  colorScheme: 'ndvi' | 'lai' | 'canopyHeight' | 'health' | 'fertilization'
  /** 最小NDVI阈值 */
  ndviMin: number
  /** 最大NDVI阈值 */
  ndviMax: number
  /** LAI范围 */
  laiMin: number
  laiMax: number
  /** 冠层高度范围 (m) */
  canopyHeightMin: number
  canopyHeightMax: number
  /** 透明度 */
  opacity: number
  /** 是否显示等值线 */
  showContour: boolean
  /** 等值线间距 */
  contourInterval: number
}

/** 默认渲染参数 */
export const DEFAULT_RENDER_PARAMS: RenderParams = {
  colorScheme: 'ndvi',
  ndviMin: 0.2,
  ndviMax: 0.9,
  laiMin: 0.5,
  laiMax: 6.0,
  canopyHeightMin: 0.5,
  canopyHeightMax: 5.0,
  opacity: 0.8,
  showContour: false,
  contourInterval: 0.1,
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
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  /** 上传时间 */
  uploadedAt: string
  /** 分析结果列表 */
  analysisResults: AnalysisResult[]
  /** 子级文件列表 (后端分析后返回) */
  childFiles: UploadedFile[]
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
