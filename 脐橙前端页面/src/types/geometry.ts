/**
 * Geometry Types - 几何类型定义
 *
 * 为 3D GIS 功能设计的类型系统
 * 核心设计：强制区分 2D/3D 坐标，为未来扩展做准备
 */

/**
 * 高程参考模式
 * 定义高度值的含义
 */
export enum HeightReference {
  /** 贴地模式 - 高度值被忽略，自动贴合地形表面 */
  CLAMP_TO_GROUND = 'CLAMP_TO_GROUND',

  /** 相对地面模式 - 高度值表示相对地面的高度 */
  RELATIVE_TO_GROUND = 'RELATIVE_TO_GROUND',

  /** 绝对高程模式 - 高度值表示相对 WGS84 椭球的高度 */
  ABSOLUTE = 'ABSOLUTE',
}

/**
 * 3D 坐标接口（强制包含高度）
 * 用于明确需要 3D 数据的场景
 */
export interface Coordinate3D {
  /** 经度（度）*/
  longitude: number

  /** 纬度（度）*/
  latitude: number

  /** 高度（米）- 必需字段 */
  height: number

  /** 高程参考模式 */
  heightReference: HeightReference
}

/**
 * 2D 坐标接口（向后兼容）
 * 用于只需要平面位置的场景
 */
export interface Coordinate2D {
  /** 经度（度）*/
  longitude: number

  /** 纬度（度）*/
  latitude: number
}

/**
 * 联合坐标类型
 * 允许同时接受 2D 和 3D 坐标
 */
export type Coordinate = Coordinate3D | Coordinate2D

/**
 * 类型守卫：判断坐标是否为 3D
 * @param coord - 待检查的坐标
 * @returns 如果是 3D 坐标返回 true
 *
 * @example
 * ```ts
 * const coord: Coordinate = { longitude: 120, latitude: 30, height: 100, heightReference: HeightReference.ABSOLUTE }
 * if (is3D(coord)) {
 *   console.log(coord.height) // TypeScript 知道 coord 是 Coordinate3D
 * }
 * ```
 */
export function is3D(coord: Coordinate): coord is Coordinate3D {
  return 'height' in coord && typeof coord.height === 'number' && 'heightReference' in coord
}

/**
 * 类型守卫：判断坐标是否为 2D
 * @param coord - 待检查的坐标
 * @returns 如果是 2D 坐标返回 true
 */
export function is2D(coord: Coordinate): coord is Coordinate2D {
  return !is3D(coord)
}

/**
 * 将 2D 坐标转换为 3D 坐标
 * @param coord - 2D 坐标
 * @param height - 高度值（米）
 * @param heightReference - 高程参考模式
 * @returns 3D 坐标
 */
export function to3D(
  coord: Coordinate2D,
  height: number = 0,
  heightReference: HeightReference = HeightReference.CLAMP_TO_GROUND
): Coordinate3D {
  return {
    longitude: coord.longitude,
    latitude: coord.latitude,
    height: height,
    heightReference: heightReference,
  }
}

/**
 * 将 3D 坐标降维为 2D 坐标（丢弃高度信息）
 * @param coord - 3D 坐标
 * @returns 2D 坐标
 */
export function to2D(coord: Coordinate3D): Coordinate2D {
  return {
    longitude: coord.longitude,
    latitude: coord.latitude,
  }
}

/**
 * 3D 包围盒
 */
export interface BoundingBox3D {
  /** 最小经度 */
  west: number
  /** 最大经度 */
  east: number
  /** 最小纬度 */
  south: number
  /** 最大纬度 */
  north: number
  /** 最小高度 */
  minHeight: number
  /** 最大高度 */
  maxHeight: number
}

/**
 * 3D 体积几何图形
 */
export interface Volume3D {
  /** 3D 图形类型 */
  type: '3d-box' | '3d-cylinder' | '3d-corridor' | '3d-pipe' | '3d-prism'

  /** 位置数组 */
  positions: Coordinate3D[]

  /** 尺寸参数 */
  dimensions: {
    /** 宽度（米）*/
    width?: number
    /** 高度（米）*/
    height?: number
    /** 半径（米）*/
    radius?: number
    /** 拉伸高度（米）*/
    extrudedHeight?: number
  }

  /** 体积（立方米）*/
  volume?: number

  /** 表面积（平方米）*/
  surfaceArea?: number
}

/**
 * 3D 测量结果
 * 包含水平距离、垂直距离、3D 直线距离等
 */
export interface Measurement3D {
  /** 测量ID */
  id: string

  /** 测量类型 */
  type: 'distance-3d' | 'area-3d' | 'volume' | 'profile' | 'slope'

  /** 起点 */
  startPoint?: Coordinate3D

  /** 终点 */
  endPoint?: Coordinate3D

  /** 多边形顶点（用于面积/体积测量）*/
  polygonPoints?: Coordinate3D[]

  /** 3D 直线距离（米）*/
  distance3D?: number

  /** 水平距离（米）*/
  distanceHorizontal?: number

  /** 垂直距离（米）*/
  distanceVertical?: number

  /** 坡度（度）*/
  slope?: number

  /** 坡向（度，0-360）*/
  aspect?: number

  /** 体积（立方米）*/
  volume?: number

  /** 面积（平方米）*/
  area?: number

  /** 创建时间 */
  createdAt: Date
}

/**
 * 地形剖面点
 */
export interface ProfilePoint extends Coordinate3D {
  /** 距离起点的累计距离（米）*/
  distance: number

  /** 坡度（度）*/
  slope?: number
}

/**
 * 地形剖面结果
 */
export interface TerrainProfile {
  /** 剖面ID */
  id: string

  /** 起点 */
  startPoint: Coordinate3D

  /** 终点 */
  endPoint: Coordinate3D

  /** 剖面点数组 */
  points: ProfilePoint[]

  /** 总长度（米）*/
  totalDistance: number

  /** 最大高程 */
  maxHeight: number

  /** 最小高程 */
  minHeight: number

  /** 高程差 */
  heightDifference: number

  /** 平均坡度（度）*/
  averageSlope: number
}
