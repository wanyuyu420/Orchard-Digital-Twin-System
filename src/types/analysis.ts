/**
 * 3D分析工具类型定义
 *
 * 为各类分析工具提供精确的TypeScript类型定义
 */

import type * as Cesium from 'cesium'

/**
 * 分析工具类型
 */
export type AnalysisToolType = 'volume' | 'measure3d' | 'profile' | 'flood'

/**
 * 方量两期差异：直方图 bin
 */
export interface VolumeDiffHistogramBin {
  start: number
  end: number
  center: number
  count: number
}

/**
 * 方量两期差异：附加元信息
 */
export interface VolumeTwoPhaseDiffMeta {
  requestedSpacingMeters: number
  effectiveSpacingMeters: number
  cellArea: number
  sampleCount: number
  minDiff: number
  maxDiff: number
  meanDiff: number
  histogram: VolumeDiffHistogramBin[]
}

/** 两期差异：单个基本单元（网格采样点）的变化信息（轻量版，便于展示/导出） */
export interface VolumeTwoPhaseDiffSample {
  /** 局部 ENU X（m），相对 AOI 中心 */
  x: number
  /** 局部 ENU Y（m），相对 AOI 中心 */
  y: number
  /** 二期 - 一期（m） */
  diff: number
  /** 一期高程（m） */
  heightA: number
  /** 二期高程（m） */
  heightB: number
}

/**
 * 方量分析结果数据
 */
export interface VolumeAnalysisData {
  /** 总体积 (立方米) */
  volume: number
  /** 填方体积 (立方米) */
  fillVolume: number
  /** 挖方体积 (立方米) */
  cutVolume: number
  /** 分析区域面积 (平方米) */
  area: number
  /** 三角形数量 */
  triangleCount: number
  /** 最高点高程 (米) */
  maxHeight: number
  /** 最低点高程 (米) */
  minHeight: number
  /** 基准高程 (米) */
  baseHeight: number

  /** 计算模式（向后兼容：不填默认为 single） */
  diffMode?: 'single' | 'two_phase'
  /** 净方量（填-挖，立方米；two_phase 时更有意义） */
  netVolume?: number
  /** 绝对方量（填+挖，立方米；two_phase 时更有意义） */
  absVolume?: number
  /** 两期差异元数据（仅在 two_phase 模式下提供） */
  diff?: VolumeTwoPhaseDiffMeta

  /** 两期差异采样点（可选：用于投影图/导出；可能较大） */
  diffSamples?: VolumeTwoPhaseDiffSample[]

  /** AOI 元信息（用于结果展示/导出，不参与计算） */
  aoi?: {
    mode: 'fixture' | 'manual'
    vertexCount: number
  }
}

/**
 * 3D测量结果数据
 */
export interface Measure3DAnalysisData {
  /** 空间距离 (米) */
  spaceDistance: number
  /** 水平距离 (米) */
  horizontalDistance: number
  /** 垂直高差 (米) */
  verticalDistance: number
  /** 起点经度 */
  startLon: number
  /** 起点纬度 */
  startLat: number
  /** 起点高程 (米) */
  startHeight: number
  /** 终点经度 */
  endLon: number
  /** 终点纬度 */
  endLat: number
  /** 终点高程 (米) */
  endHeight: number
}

/**
 * 剖面分析结果数据
 */
export interface ProfileAnalysisData {
  /** 剖面总长度 (米) */
  totalLength: number
  /** 最高点高程 (米) */
  maxElevation: number
  /** 最低点高程 (米) */
  minElevation: number
  /** 平均高程 (米) */
  avgElevation: number
  /** 爬升总量 (米) */
  totalAscent: number
  /** 下降总量 (米) */
  totalDescent: number
  /** 最大坡度 (度) */
  maxSlope: number
  /** 采样点数量 */
  sampleCount: number
  /** 采样点数据 (可选，用于图表绘制) */
  samples?: Array<{
    distance: number
    elevation: number
  }>
}

/**
 * 淹没分析结果数据
 */
export interface FloodAnalysisData {
  /** 水位高度 (米) */
  waterLevel: number
  /** 淹没面积（平方米） */
  floodArea?: number
  /** 淹没体积（立方米） */
  floodVolume?: number
  /** 分析模式 */
  mode: 'polygon' | 'tileset' | 'terrain'
  /** Tileset路径 (tileset模式) */
  tilesetUrl?: string

  /** 计算方法（便于 UI 标注/调试） */
  calculationMethod?: 'simple' | 'terrain_grid'
  /** 计算状态 */
  calculationStatus?: 'idle' | 'sampling' | 'ready' | 'failed'
  /** 失败原因（可选，用于提示用户） */
  errorMessage?: string
  /** 网格采样间距（米，地表局部 ENU 平面近似） */
  gridSpacingMeters?: number
  /** 实际采用的网格间距（可能因点数上限自动放大） */
  effectiveGridSpacingMeters?: number
  /** 采样点数量（网格点） */
  sampleCount?: number
  /** 单元格面积（平方米） */
  cellArea?: number
  /** 采样到的地形最小/最大高程（米） */
  minTerrainHeight?: number
  maxTerrainHeight?: number
}

/**
 * 分析数据联合类型
 */
export type AnalysisData =
  | VolumeAnalysisData
  | Measure3DAnalysisData
  | ProfileAnalysisData
  | FloodAnalysisData

/**
 * 分析结果接口 (泛型版本)
 */
export interface AnalysisResult<T extends AnalysisData = AnalysisData> {
  /** 唯一标识符 */
  id: string
  /** 工具类型 */
  type: AnalysisToolType
  /** 显示名称 */
  name: string
  /** 创建时间戳 */
  timestamp: number
  /** 分析数据 */
  data: T
  /** 定位位置 (用于flyTo) */
  position?: Cesium.Cartesian3
  /** 自定义名称 (用户可编辑) */
  customName?: string
  /** 备注说明 */
  notes?: string
  /** 标签 */
  tags?: string[]
}

/**
 * 具体类型的分析结果
 */
export type VolumeAnalysisResult = AnalysisResult<VolumeAnalysisData>
export type Measure3DAnalysisResult = AnalysisResult<Measure3DAnalysisData>
export type ProfileAnalysisResult = AnalysisResult<ProfileAnalysisData>
export type FloodAnalysisResult = AnalysisResult<FloodAnalysisData>
