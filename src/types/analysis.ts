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
  /** 淹没面积 (平方千米) - TODO: 需实现计算 */
  floodArea?: number
  /** 淹没体积 (立方米) - TODO: 需实现计算 */
  floodVolume?: number
  /** 分析模式 */
  mode: 'polygon' | 'tileset' | 'terrain'
  /** Tileset路径 (tileset模式) */
  tilesetUrl?: string
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
