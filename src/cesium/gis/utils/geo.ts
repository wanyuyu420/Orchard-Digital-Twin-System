/**
 * Geo Utilities - 通用地理计算函数
 *
 * 提取自各个工具类的公共计算逻辑，统一管理
 * 避免代码重复，提高可维护性
 */

import * as Cesium from 'cesium'
import type { Coordinate } from '@/types/geometry'

// ==================== 坐标转换 ====================

/**
 * Cartesian3 转经纬度坐标
 * @param cartesian - Cesium Cartesian3 坐标
 * @returns Coordinate 对象 {longitude, latitude, height}
 */
export function cartesianToCoordinate(cartesian: Cesium.Cartesian3): Coordinate {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height,
  }
}

/**
 * 经纬度坐标转 Cartesian3
 * @param coord - Coordinate 对象
 * @returns Cesium Cartesian3 坐标
 */
export function coordinateToCartesian(coord: Coordinate): Cesium.Cartesian3 {
  const height = 'height' in coord ? coord.height : 0
  return Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, height)
}

/**
 * 批量转换 Coordinate 数组为 Cartesian3 数组
 * @param coords - Coordinate 数组
 * @returns Cartesian3 数组
 */
export function coordinatesToCartesians(coords: Coordinate[]): Cesium.Cartesian3[] {
  return coords.map((c) => coordinateToCartesian(c))
}

/**
 * 批量转换 Cartesian3 数组为 Coordinate 数组
 * @param cartesians - Cartesian3 数组
 * @returns Coordinate 数组
 */
export function cartesiansToCoordinates(cartesians: Cesium.Cartesian3[]): Coordinate[] {
  return cartesians.map((c) => cartesianToCoordinate(c))
}

// ==================== 几何计算 ====================

/**
 * 计算多边形质心（重心）
 * @param positions - 顶点位置数组
 * @returns 质心位置
 */
export function calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
  if (positions.length === 0) return Cesium.Cartesian3.ZERO

  let x = 0,
    y = 0,
    z = 0
  for (const pos of positions) {
    x += pos.x
    y += pos.y
    z += pos.z
  }
  return new Cesium.Cartesian3(x / positions.length, y / positions.length, z / positions.length)
}

/**
 * 计算两点之间的距离（米）
 * @param pos1 - 起点
 * @param pos2 - 终点
 * @returns 距离（米）
 */
export function calculateDistance(pos1: Cesium.Cartesian3, pos2: Cesium.Cartesian3): number {
  return Cesium.Cartesian3.distance(pos1, pos2)
}

/**
 * 计算路径总长度（米）
 * @param positions - 路径顶点数组
 * @returns 总长度（米）
 */
export function calculatePathDistance(positions: Cesium.Cartesian3[]): number {
  let distance = 0
  for (let i = 1; i < positions.length; i++) {
    distance += Cesium.Cartesian3.distance(positions[i - 1], positions[i])
  }
  return distance
}

/**
 * 计算多边形周长（米）
 * @param positions - 顶点位置数组
 * @returns 周长（米）
 */
export function calculatePolygonPerimeter(positions: Cesium.Cartesian3[]): number {
  if (positions.length < 2) return 0

  let perimeter = 0
  for (let i = 0; i < positions.length; i++) {
    const nextIndex = (i + 1) % positions.length
    perimeter += Cesium.Cartesian3.distance(positions[i], positions[nextIndex])
  }
  return perimeter
}

/**
 * 计算多边形面积（平方米）
 * 使用球面多边形面积公式 (Girard's theorem approximation)
 * @param positions - 顶点位置数组
 * @returns 面积（平方米）
 */
export function calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
  if (positions.length < 3) return 0

  // 转换为经纬度
  const coordinates = positions.map((pos) => {
    const carto = Cesium.Cartographic.fromCartesian(pos)
    return { lon: carto.longitude, lat: carto.latitude }
  })

  // 使用球面多边形面积公式
  const earthRadius = 6371000 // 地球平均半径（米）
  let area = 0

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    area +=
      (coordinates[j].lon - coordinates[i].lon) *
      (2 + Math.sin(coordinates[i].lat) + Math.sin(coordinates[j].lat))
  }

  return Math.abs((area * earthRadius * earthRadius) / 2)
}

/**
 * 计算三角形面积（使用海伦公式）
 * @param pos1 - 三角形顶点1
 * @param pos2 - 三角形顶点2
 * @param pos3 - 三角形顶点3
 * @returns 面积（平方米）
 */
export function calculateTriangleArea(
  pos1: Cesium.Cartesian3,
  pos2: Cesium.Cartesian3,
  pos3: Cesium.Cartesian3
): number {
  const a = Cesium.Cartesian3.distance(pos1, pos2)
  const b = Cesium.Cartesian3.distance(pos2, pos3)
  const c = Cesium.Cartesian3.distance(pos3, pos1)

  const s = (a + b + c) / 2
  const areaSquared = s * (s - a) * (s - b) * (s - c)

  return areaSquared > 0 ? Math.sqrt(areaSquared) : 0
}

/**
 * 计算两点之间的中点
 * @param pos1 - 起点
 * @param pos2 - 终点
 * @returns 中点位置
 */
export function calculateMidpoint(
  pos1: Cesium.Cartesian3,
  pos2: Cesium.Cartesian3
): Cesium.Cartesian3 {
  return Cesium.Cartesian3.midpoint(pos1, pos2, new Cesium.Cartesian3())
}

/**
 * 计算坡度信息
 * @param horizontalDistance - 水平距离（米）
 * @param verticalDistance - 垂直距离（米）
 * @returns 坡度信息 { angle: 角度, percent: 百分比 }
 */
export function calculateSlope(
  horizontalDistance: number,
  verticalDistance: number
): { angle: number; percent: number } {
  const angle = Math.atan2(verticalDistance, horizontalDistance) * (180 / Math.PI)
  const percent = horizontalDistance > 0 ? (verticalDistance / horizontalDistance) * 100 : 0

  return {
    angle: Math.abs(angle),
    percent: isFinite(percent) ? Math.abs(percent) : 0,
  }
}

// ==================== 格式化函数 ====================

/**
 * 格式化距离显示
 * @param meters - 距离（米）
 * @returns 格式化后的字符串
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(1)} m`
}

/**
 * 格式化面积显示
 * @param squareMeters - 面积（平方米）
 * @returns 格式化后的字符串
 */
export function formatArea(squareMeters: number): string {
  if (squareMeters >= 1000000) {
    return `${(squareMeters / 1000000).toFixed(2)} km²`
  } else if (squareMeters >= 10000) {
    return `${(squareMeters / 10000).toFixed(2)} 公顷`
  }
  return `${squareMeters.toFixed(0)} m²`
}

/**
 * 格式化体积显示
 * @param cubicMeters - 体积（立方米）
 * @returns 格式化后的字符串
 */
export function formatVolume(cubicMeters: number): string {
  if (cubicMeters < 1) {
    return `${(cubicMeters * 1000).toFixed(2)} L`
  } else if (cubicMeters < 1000) {
    return `${cubicMeters.toFixed(2)} m³`
  } else if (cubicMeters < 1000000) {
    return `${(cubicMeters / 1000).toFixed(2)} × 10³ m³`
  } else {
    return `${(cubicMeters / 1000000).toFixed(2)} × 10⁶ m³`
  }
}

/**
 * 格式化高程显示
 * @param meters - 高程（米）
 * @returns 格式化后的字符串
 */
export function formatElevation(meters: number): string {
  return `${meters.toFixed(1)} m`
}

/**
 * 格式化坡度显示
 * @param degrees - 坡度角（度）
 * @returns 格式化后的字符串
 */
export function formatSlopeAngle(degrees: number): string {
  return `${degrees.toFixed(1)}°`
}

/**
 * 格式化坡度百分比
 * @param percent - 坡度百分比
 * @returns 格式化后的字符串
 */
export function formatSlopePercent(percent: number): string {
  return `${percent.toFixed(1)}%`
}

// ==================== ID 生成 ====================

/**
 * 生成唯一 ID
 * @param prefix - ID 前缀
 * @returns 唯一 ID 字符串
 */
export function generateId(prefix: string = 'gis'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
