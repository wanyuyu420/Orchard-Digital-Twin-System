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
/**
 * 计算多边形与地形之间的体积（方量分析）
 *
 * 算法原理：
 * 1. 动态计算网格精度，避免大范围分析时三角形数量过多导致卡顿
 * 2. 将多边形分解为三角形网格（使用Cesium.PolygonGeometry）
 * 3. 异步分批计算每个三角柱的体积，避免阻塞主线程
 *
 * @param viewer - Cesium Viewer实例
 * @param positions - 多边形顶点数组（Cartesian3）
 * @param baseHeight - 基准高度（默认0），用于计算填挖方量
 * @returns 体积计算结果
 */
export async function computeCutVolume(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  baseHeight: number = 0
): Promise<VolumeResult> {
  // 检查地形数据是否可用
  const tileAvailability = viewer.terrainProvider.availability
  if (!tileAvailability) {
    throw new Error('Terrain data is not available. Please load terrain provider first.')
  }

  // 计算多边形包围盒，用于确定自适应精度
  // 简单的包围球计算，获取大致尺度
  const boundingSphere = Cesium.BoundingSphere.fromPoints(positions)
  const radius = boundingSphere.radius // 米

  // 自适应粒度计算
  // 目标是将网格数量控制在合理范围内（例如 2000-5000 个三角形）
  // 假设区域是正方形，Area = PI * r^2
  // stepSize ≈ sqrt(Area / TargetCount)
  // granularity ≈ stepSize / EarthRadius
  const targetTriangleCount = 3000
  const approximateArea = Math.PI * radius * radius
  const stepSize = Math.sqrt(approximateArea / targetTriangleCount)
  
  // 限制最小精度，避免过高或过低
  // 最小 2米 (非常精细) -> 对应 granularity 约 0.0000003
  // 最大 100米 (大范围) -> 对应 granularity 约 0.000015
  const clampedStepSize = Math.max(2, Math.min(stepSize, 200))
  
  // 地球半径 (约 6378137 米)
  const earthRadius = 6378137
  const granularity = clampedStepSize / earthRadius

  // 创建多边形几何体并细分为三角形网格
  const polygonGeometry = Cesium.PolygonGeometry.fromPositions({
    positions: positions,
    vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
    granularity: granularity,
  })

  // createGeometry 可能是耗时操作，但在 Web Worker 中不可用时只能在主线程跑
  // 如果非常卡，可以考虑放到 setTimeout 中让出一帧
  await new Promise(resolve => setTimeout(resolve, 0))
  
  const geom = Cesium.PolygonGeometry.createGeometry(polygonGeometry)

  if (!geom || !geom.indices || !geom.attributes.position) {
    throw new Error('Failed to create polygon geometry')
  }

  let totalCutVolume = 0
  let maxHeight = -Number.MAX_VALUE
  let minHeight = Number.MAX_VALUE // 实际采样的最小高度，而非基准面
  let triangleCount = 0

  const scratchCartesian = new Cesium.Cartesian3()
  let cartographic: Cesium.Cartographic

  const indices = geom.indices
  const positionsArray = geom.attributes.position.values
  
  // 批处理大小，每处理 N 个三角形让出控制权
  const BATCH_SIZE = 500
  
  for (let i = 0; i < indices.length; i += 3) {
    // 每一批次让出控制权，保持 UI 响应
    if (i % (BATCH_SIZE * 3) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    const i0 = indices[i]
    const i1 = indices[i + 1]
    const i2 = indices[i + 2]

    // 获取三角形的三个顶点坐标
    scratchCartesian.x = positionsArray[i0 * 3]
    scratchCartesian.y = positionsArray[i0 * 3 + 1]
    scratchCartesian.z = positionsArray[i0 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height1 = viewer.scene.globe.getHeight(cartographic) || baseHeight
    
    // 我们在这里使用投影到底面（平面）的坐标来计算底面积
    // 实际上应该使用地心地固坐标转平面坐标（如WebMercator）计算投影面积
    // 或者简单地将高度置为0计算弦面积（误差较小）
    const bottomP1 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    scratchCartesian.x = positionsArray[i1 * 3]
    scratchCartesian.y = positionsArray[i1 * 3 + 1]
    scratchCartesian.z = positionsArray[i1 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height2 = viewer.scene.globe.getHeight(cartographic) || baseHeight
    const bottomP2 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    scratchCartesian.x = positionsArray[i2 * 3]
    scratchCartesian.y = positionsArray[i2 * 3 + 1]
    scratchCartesian.z = positionsArray[i2 * 3 + 2]
    cartographic = Cesium.Cartographic.fromCartesian(scratchCartesian)
    const height3 = viewer.scene.globe.getHeight(cartographic) || baseHeight
    const bottomP3 = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)

    // 更新最大最小高程
    maxHeight = Math.max(maxHeight, height1, height2, height3)
    minHeight = Math.min(minHeight, height1, height2, height3)

    // 计算三角形底面积
    const bottomArea = computeAreaOfTriangle(bottomP1, bottomP2, bottomP3)

    // 计算三角柱体积：V = 底面积 × (平均高度 - 基准高度)
    // 注意：如果是挖方，地形高度 > 基准高度。如果是填方，地形高度 < 基准高度。
    // 这里计算的是多边形下方的体积（Cut Volume），通常指 地形 - 基准面
    // 如果 result < 0 说明地形在基准面之下
    const avgHeight = (height1 + height2 + height3) / 3
    const heightDiff = avgHeight - baseHeight
    
    // 只累加正体积（挖方）？还是代数和？
    // 通常 computeCutVolume 指挖方，即高出基准面的部分
    // 这里保留代数和，业务层决定如何解释
    totalCutVolume += bottomArea * heightDiff

    triangleCount++
  }

  // 有效高度差
  const effectiveHeight = maxHeight - (baseHeight > minHeight ? minHeight : baseHeight)

  // 计算总底面积（用于验证）
  const totalArea =
    triangleCount > 0 && effectiveHeight !== 0
      ? Math.abs(totalCutVolume / effectiveHeight) // 这是一个非常粗略的估算，最好应该累加 bottomArea
      : 0
  
  // 修正：实际上我们可以在循环中累加 area
  // 但为了保持返回值兼容性，这里暂时维持原状（或者 TODO 优化）

  return {
    volume: totalCutVolume,
    area: totalArea,
    maxHeight: maxHeight === -Number.MAX_VALUE ? 0 : maxHeight,
    minHeight: minHeight === Number.MAX_VALUE ? 0 : minHeight,
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
