/**
 * Volume Calculation Utilities
 *
 * Core algorithms extracted from cesium_dev_kit
 * Source: https://github.com/dengxiaoning/cesium_dev_kit
 * Commit: f4cb88e082e478756adf7ec216e84d87c4830709
 * Date: 2025-09-29
 * License: MIT
 *
 * Copyright (c) cesium_dev_kit contributors
 * Adapted to TypeScript for Water Digital Twin Platform
 */

import * as Cesium from 'cesium'

export interface VolumeResult {
  volume: number // 总体积（立方米）
  area: number // 底面积（平方米）
  maxHeight: number // 最大高程
  minHeight: number // 最小高程
  triangleCount: number // 三角形数量
}

/**
 * 计算三角形的面积（使用海伦公式）
 * @param pos1 - 三角形顶点1
 * @param pos2 - 三角形顶点2
 * @param pos3 - 三角形顶点3
 * @returns 面积（平方米）
 */
export function computeAreaOfTriangle(
  pos1: Cesium.Cartesian3,
  pos2: Cesium.Cartesian3,
  pos3: Cesium.Cartesian3
): number {
  const a = Cesium.Cartesian3.distance(pos1, pos2)
  const b = Cesium.Cartesian3.distance(pos2, pos3)
  const c = Cesium.Cartesian3.distance(pos3, pos1)

  const S = (a + b + c) / 2

  return Math.sqrt(S * (S - a) * (S - b) * (S - c))
}

/**
 * 计算多边形的重心点（用于标签显示位置）
 * @param positions - 多边形顶点数组
 * @returns 重心的经纬度坐标
 */
export function computeCentroidOfPolygon(positions: Cesium.Cartesian3[]): Cesium.Cartographic {
  const x: number[] = []
  const y: number[] = []

  for (let i = 0; i < positions.length; i++) {
    const cartographic = Cesium.Cartographic.fromCartesian(positions[i])
    x.push(cartographic.longitude)
    y.push(cartographic.latitude)
  }

  let x0 = 0.0,
    y0 = 0.0,
    x1 = 0.0,
    y1 = 0.0
  let signedArea = 0.0
  let a = 0.0
  let centroidx = 0.0,
    centroidy = 0.0

  for (let i = 0; i < positions.length; i++) {
    x0 = x[i]
    y0 = y[i]

    if (i === positions.length - 1) {
      x1 = x[0]
      y1 = y[0]
    } else {
      x1 = x[i + 1]
      y1 = y[i + 1]
    }

    a = x0 * y1 - x1 * y0
    signedArea += a
    centroidx += (x0 + x1) * a
    centroidy += (y0 + y1) * a
  }

  signedArea *= 0.5
  centroidx /= 6.0 * signedArea
  centroidy /= 6.0 * signedArea

  return new Cesium.Cartographic(centroidx, centroidy)
}

/**
 * 计算多边形与地形之间的体积（方量分析）
 *
 * 算法原理：
 * 1. 将多边形分解为三角形网格（使用Cesium.PolygonGeometry）
 * 2. 对每个三角形的顶点采样地形高程
 * 3. 计算每个三角柱的体积：V = (底面积 × (h1 + h2 + h3)) / 3
 * 4. 累加所有三角柱的体积
 *
 * @param viewer - Cesium Viewer实例
 * @param positions - 多边形顶点数组（Cartesian3）
 * @param baseHeight - 基准高度（默认0），用于计算填挖方量
 * @returns 体积计算结果
 */
export function computeCutVolume(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  baseHeight: number = 0
): VolumeResult {
  // 检查地形数据是否可用
  const tileAvailability = viewer.terrainProvider.availability
  if (!tileAvailability) {
    throw new Error('Terrain data is not available. Please load terrain provider first.')
  }

  // 设置网格细分精度（granularity越小，三角形越密集，精度越高）
  const granularity = Math.PI / Math.pow(2, 11) / 64

  // 创建多边形几何体并细分为三角形网格
  const polygonGeometry = Cesium.PolygonGeometry.fromPositions({
    positions: positions,
    vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
    granularity: granularity,
  })

  const geom = Cesium.PolygonGeometry.createGeometry(polygonGeometry)

  if (!geom || !geom.indices || !geom.attributes.position) {
    throw new Error('Failed to create polygon geometry')
  }

  let totalCutVolume = 0
  let maxHeight = 0
  let minHeight = baseHeight
  let triangleCount = 0

  const scratchCartesian = new Cesium.Cartesian3()
  let cartographic: Cesium.Cartographic

  // 遍历所有三角形（indices每3个为一组，构成一个三角形）
  for (let i = 0; i < geom.indices.length; i += 3) {
    const i0 = geom.indices[i]
    const i1 = geom.indices[i + 1]
    const i2 = geom.indices[i + 2]

    const subTrianglePositions = geom.attributes.position.values

    // 获取三角形的三个顶点坐标
    scratchCartesian.x = subTrianglePositions[i0 * 3]
    scratchCartesian.y = subTrianglePositions[i0 * 3 + 1]
    scratchCartesian.z = subTrianglePositions[i0 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height1 = viewer.scene.globe.getHeight(cartographic) || 0
    const bottomP1 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    scratchCartesian.x = subTrianglePositions[i1 * 3]
    scratchCartesian.y = subTrianglePositions[i1 * 3 + 1]
    scratchCartesian.z = subTrianglePositions[i1 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height2 = viewer.scene.globe.getHeight(cartographic) || 0
    const bottomP2 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    scratchCartesian.x = subTrianglePositions[i2 * 3]
    scratchCartesian.y = subTrianglePositions[i2 * 3 + 1]
    scratchCartesian.z = subTrianglePositions[i2 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height3 = viewer.scene.globe.getHeight(cartographic) || 0
    const bottomP3 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    // 更新最大高程
    if (maxHeight < height1) maxHeight = height1
    if (maxHeight < height2) maxHeight = height2
    if (maxHeight < height3) maxHeight = height3

    // 计算三角形底面积
    const bottomArea = computeAreaOfTriangle(bottomP1, bottomP2, bottomP3)

    // 计算三角柱体积：V = 底面积 × 平均高度
    // (height1 + height2 + height3) / 3 是三个顶点高度的平均值
    const avgHeight = (height1 - minHeight + height2 - minHeight + height3 - minHeight) / 3
    totalCutVolume += bottomArea * avgHeight

    triangleCount++
  }

  // 计算总底面积（用于验证）
  const totalArea =
    triangleCount > 0
      ? totalCutVolume / (maxHeight - minHeight || 1) // 粗略估算
      : 0

  return {
    volume: totalCutVolume,
    area: totalArea,
    maxHeight: maxHeight,
    minHeight: minHeight,
    triangleCount: triangleCount,
  }
}

/**
 * 格式化体积显示文本
 * @param volume - 体积（立方米）
 * @returns 格式化后的文本
 */
export function formatVolume(volume: number): string {
  if (volume < 1) {
    return `${(volume * 1000).toFixed(2)} L`
  } else if (volume < 1000) {
    return `${volume.toFixed(2)} m³`
  } else if (volume < 1000000) {
    return `${(volume / 1000).toFixed(2)} × 10³ m³`
  } else {
    return `${(volume / 1000000).toFixed(2)} × 10⁶ m³`
  }
}

/**
 * 格式化面积显示文本
 * @param area - 面积（平方米）
 * @returns 格式化后的文本
 */
export function formatArea(area: number): string {
  if (area < 1) {
    return `${(area * 10000).toFixed(2)} cm²`
  } else if (area < 10000) {
    return `${area.toFixed(2)} m²`
  } else if (area < 1000000) {
    return `${(area / 10000).toFixed(2)} 公顷`
  } else {
    return `${(area / 1000000).toFixed(2)} km²`
  }
}
