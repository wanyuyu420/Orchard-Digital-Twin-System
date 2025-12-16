// GIS 要素类型定义

import type { Coordinate } from './geometry'
// Imported for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Coordinate3D, Coordinate2D } from './geometry'
import type { FeatureStyle, FeatureType, LineType } from './draw'
import type { BaseGraphic } from '@/cesium/gis/core/BaseGraphic'

/**
 * 基础要素接口
 */
export interface BaseFeature {
  id: string
  type: FeatureType
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  style: FeatureStyle
  properties: Record<string, any>
  visible: boolean
}

/**
 * 点要素
 */
export interface PointFeature extends BaseFeature {
  type: 'point'
  position: Coordinate
  icon?: string
  label?: string
}

/**
 * 线要素
 */
export interface LineFeature extends BaseFeature {
  type: 'line'
  vertices: Coordinate[]
  length: number // 米
  lineType: LineType
}

/**
 * 多边形要素
 */
export interface PolygonFeature extends BaseFeature {
  type: 'polygon'
  vertices: Coordinate[]
  area: number // 平方米
  perimeter?: number // 周长（米）
}

/**
 * 圆形要素
 */
export interface CircleFeature extends BaseFeature {
  type: 'circle'
  center: Coordinate
  radius: number // 米
  area: number // 平方米
}

/**
 * 矩形要素
 */
export interface RectangleFeature extends BaseFeature {
  type: 'rectangle'
  southwest: Coordinate // 西南角
  northeast: Coordinate // 东北角
  width: number // 宽度（米）
  height: number // 高度（米）
  area: number // 平方米
}

/**
 * 距离测量要素（兼容现有）
 */
export interface DistanceFeature extends BaseFeature {
  type: 'distance'
  startPoint: Coordinate
  endPoint: Coordinate
  distance: number // 米
}

/**
 * 面积测量要素（兼容现有）
 */
export interface AreaFeature extends BaseFeature {
  type: 'area'
  vertices: Coordinate[]
  area: number // 平方米
}

/**
 * 要素联合类型
 */
export type Feature =
  | PointFeature
  | LineFeature
  | PolygonFeature
  | CircleFeature
  | RectangleFeature
  | DistanceFeature
  | AreaFeature

/**
 * 要素集合
 */
export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
  metadata?: {
    created: Date
    modified: Date
    author?: string
    description?: string
  }
}

/**
 * GeoJSON 兼容几何类型
 */
export type GeoJSONGeometryType =
  | 'Point'
  | 'LineString'
  | 'Polygon'
  | 'MultiPoint'
  | 'MultiLineString'
  | 'MultiPolygon'

/**
 * GeoJSON 要素
 */
export interface GeoJSONFeature {
  type: 'Feature'
  id?: string | number
  geometry: {
    type: GeoJSONGeometryType
    coordinates: number[] | number[][] | number[][][]
  }
  properties: {
    name?: string
    description?: string
    type?: FeatureType
    style?: FeatureStyle
    [key: string]: any
  }
}

/**
 * GeoJSON 要素集合
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  crs?: {
    type: string
    properties: {
      name: string
    }
  }
}

/**
 * 历史记录条目
 */
export interface HistoryEntry {
  id: string
  action: 'add' | 'update' | 'delete' | 'style' | 'move'
  timestamp: Date
  featureId: string
  beforeState?: Partial<Feature>
  afterState?: Partial<Feature>
}

/**
 * 历史栈
 */
export interface HistoryStack {
  entries: HistoryEntry[]
  currentIndex: number
  maxSize: number
}

/**
 * 选择状态
 */
export interface SelectionState {
  selectedIds: Set<string>
  highlightedId: string | null
}

/**
 * 编辑状态
 */
export interface EditState {
  featureId: string | null
  editableVertices: Coordinate[]
  isDragging: boolean
  draggedVertexIndex: number | null
}

/**
 * 要素与 Graphic 的映射
 * 用于在 Feature 数据模型和 Cesium Entity 之间建立关联
 */
export interface FeatureGraphicMap {
  /** 要素ID */
  featureId: string

  /** 对应的 Graphic 实例 */
  graphic: BaseGraphic

  /** 要素数据 */
  feature: Feature
}

/**
 * 要素过滤条件
 */
export interface FeatureFilter {
  /** 按类型过滤 */
  types?: FeatureType[]

  /** 按可见性过滤 */
  visible?: boolean

  /** 按创建时间范围过滤 */
  createdAfter?: Date
  createdBefore?: Date

  /** 按名称搜索（模糊匹配）*/
  nameContains?: string

  /** 按属性过滤 */
  properties?: Record<string, any>
}

/**
 * 要素排序选项
 */
export interface FeatureSortOptions {
  /** 排序字段 */
  field: 'name' | 'createdAt' | 'updatedAt' | 'type'

  /** 排序方向 */
  order: 'asc' | 'desc'
}
