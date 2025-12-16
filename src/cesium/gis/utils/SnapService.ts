/**
 * SnapService - 吸附服务
 *
 * 提供绘制时的顶点和边缘吸附功能
 * 在屏幕空间中检测最近的吸附目标
 */

import * as Cesium from 'cesium'

export interface SnapTarget {
  /** 吸附类型 */
  type: 'vertex' | 'edge'
  /** 吸附位置 (Cartesian3) */
  position: Cesium.Cartesian3
  /** 来源要素ID */
  featureId: string
  /** 屏幕距离 (pixels) */
  screenDistance: number
  /** 顶点索引 (仅 vertex 类型) */
  vertexIndex?: number
  /** 边缘索引 (仅 edge 类型) */
  edgeIndex?: number
}

export interface SnapOptions {
  /** 是否启用吸附 */
  enabled: boolean
  /** 吸附容差 (像素) */
  tolerance: number
  /** 是否吸附到顶点 */
  snapToVertex: boolean
  /** 是否吸附到边缘 */
  snapToEdge: boolean
  /** 排除的要素ID列表 */
  excludeFeatureIds?: string[]
}

const DEFAULT_OPTIONS: SnapOptions = {
  enabled: true,
  tolerance: 10,
  snapToVertex: true,
  snapToEdge: true,
  excludeFeatureIds: [],
}

/**
 * 吸附服务类
 */
export class SnapService {
  private viewer: Cesium.Viewer
  private options: SnapOptions

  /** 已注册的要素顶点 (featureId -> positions[]) */
  private featureVertices: Map<string, Cesium.Cartesian3[]> = new Map()

  constructor(viewer: Cesium.Viewer, options: Partial<SnapOptions> = {}) {
    this.viewer = viewer
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * 更新选项
   */
  setOptions(options: Partial<SnapOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 注册要素顶点用于吸附
   */
  registerFeature(featureId: string, positions: Cesium.Cartesian3[]): void {
    if (positions.length > 0) {
      this.featureVertices.set(featureId, [...positions])
    }
  }

  /**
   * 注销要素
   */
  unregisterFeature(featureId: string): void {
    this.featureVertices.delete(featureId)
  }

  /**
   * 清空所有注册的要素
   */
  clear(): void {
    this.featureVertices.clear()
  }

  /**
   * 从 GIS Store 同步所有要素
   */
  syncFromStore(graphics: Map<string, any>): void {
    this.clear()
    graphics.forEach((graphic, featureId) => {
      const positions = graphic.getPositions?.()
      if (positions && positions.length > 0) {
        this.registerFeature(featureId, positions)
      }
    })
  }

  /**
   * 查找吸附目标
   * @param screenPosition - 屏幕坐标
   * @returns 最近的吸附目标，或 null
   */
  findSnapTarget(screenPosition: Cesium.Cartesian2): SnapTarget | null {
    if (!this.options.enabled) return null

    const excludeIds = new Set(this.options.excludeFeatureIds || [])
    let bestTarget: SnapTarget | null = null
    let bestDistance = this.options.tolerance

    // 遍历所有注册的要素
    this.featureVertices.forEach((positions, featureId) => {
      if (excludeIds.has(featureId)) return

      // 检测顶点吸附
      if (this.options.snapToVertex) {
        positions.forEach((position, vertexIndex) => {
          const screenPos = this.worldToScreen(position)
          if (!screenPos) return

          const distance = Cesium.Cartesian2.distance(screenPosition, screenPos)
          if (distance < bestDistance) {
            bestDistance = distance
            bestTarget = {
              type: 'vertex',
              position: position.clone(),
              featureId,
              screenDistance: distance,
              vertexIndex,
            }
          }
        })
      }

      // 检测边缘吸附
      if (this.options.snapToEdge && positions.length >= 2) {
        for (let i = 0; i < positions.length - 1; i++) {
          const edgeResult = this.findEdgeSnapPoint(screenPosition, positions[i], positions[i + 1])

          if (edgeResult && edgeResult.distance < bestDistance) {
            // 优先顶点吸附，边缘吸附需要更近
            const edgeThreshold = bestTarget?.type === 'vertex' ? bestDistance * 0.7 : bestDistance

            if (edgeResult.distance < edgeThreshold) {
              bestDistance = edgeResult.distance
              bestTarget = {
                type: 'edge',
                position: edgeResult.position,
                featureId,
                screenDistance: edgeResult.distance,
                edgeIndex: i,
              }
            }
          }
        }
      }
    })

    return bestTarget
  }

  /**
   * 世界坐标转屏幕坐标
   */
  private worldToScreen(position: Cesium.Cartesian3): Cesium.Cartesian2 | null {
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(this.viewer.scene, position)
    return screenPos || null
  }

  /**
   * 查找点到边缘的最近吸附点
   */
  private findEdgeSnapPoint(
    screenPoint: Cesium.Cartesian2,
    edgeStart: Cesium.Cartesian3,
    edgeEnd: Cesium.Cartesian3
  ): { position: Cesium.Cartesian3; distance: number } | null {
    const screenStart = this.worldToScreen(edgeStart)
    const screenEnd = this.worldToScreen(edgeEnd)

    if (!screenStart || !screenEnd) return null

    // 计算点到线段的最近点 (屏幕空间)
    const projection = this.projectPointToLineSegment(screenPoint, screenStart, screenEnd)

    if (!projection) return null

    // 将屏幕坐标投影点转换回世界坐标
    // 使用参数 t 在 3D 空间中插值
    const worldPosition = Cesium.Cartesian3.lerp(
      edgeStart,
      edgeEnd,
      projection.t,
      new Cesium.Cartesian3()
    )

    return {
      position: worldPosition,
      distance: projection.distance,
    }
  }

  /**
   * 点到线段的投影
   * @returns { point: 投影点, t: 参数 [0,1], distance: 距离 }
   */
  private projectPointToLineSegment(
    point: Cesium.Cartesian2,
    lineStart: Cesium.Cartesian2,
    lineEnd: Cesium.Cartesian2
  ): { point: Cesium.Cartesian2; t: number; distance: number } | null {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const lengthSq = dx * dx + dy * dy

    if (lengthSq === 0) return null

    // 计算参数 t (0 = start, 1 = end)
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq

    // 限制在线段范围内
    t = Math.max(0, Math.min(1, t))

    // 计算投影点
    const projX = lineStart.x + t * dx
    const projY = lineStart.y + t * dy

    const projPoint = new Cesium.Cartesian2(projX, projY)
    const distance = Cesium.Cartesian2.distance(point, projPoint)

    return { point: projPoint, t, distance }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.clear()
  }
}
