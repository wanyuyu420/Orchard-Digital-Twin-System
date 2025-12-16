/**
 * MeasureTool - 测量工具类
 *
 * 基于 BaseTool 重新实现的测量工具
 * 支持距离测量和面积测量
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions } from '../core/BaseTool'
import type { Coordinate } from '@/types/geometry'
import type { Measurement, MeasureToolType } from '@/types/measure'

/**
 * 测量工具配置
 */
export interface MeasureToolOptions extends BaseToolOptions {
  /** 测量类型 */
  measureType: MeasureToolType

  /** 完成回调 */
  onComplete?: (measurement: Measurement) => void

  /** 取消回调 */
  onCancel?: () => void
}

/**
 * 测量工具类
 */
export class MeasureTool extends BaseTool {
  /** 测量类型 */
  private measureType: MeasureToolType

  /** 测量点集合 */
  private points: Cesium.Cartesian3[] = []

  /** 预览实体集合 */
  private previewEntities: Cesium.Entity[] = []

  /** 点标记实体集合 */
  private markerEntities: Cesium.Entity[] = []

  /** 完成回调 */
  private onComplete?: (measurement: Measurement) => void

  /** 取消回调 */
  private onCancel?: () => void

  /** 鼠标移动处理节流时间戳 */
  private lastMoveTime: number = 0

  /** 节流间隔（毫秒）*/
  private readonly MOVE_THROTTLE_MS = 16 // ~60fps

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: MeasureToolOptions) {
    super(viewer, {
      ...options,
      type: options.measureType === 'distance' ? 'measure-distance' : 'measure-area',
    })

    this.measureType = options.measureType
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel
  }

  /**
   * 设置事件处理器
   */
  protected setupEventHandlers(): void {
    // 左键单击
    this.handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      this.handleLeftClick(click.position)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    // 双击（仅面积测量）
    if (this.measureType === 'area') {
      this.handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        this.handleDoubleClick(click.position)
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    }

    // 右键取消
    this.handler.setInputAction(() => {
      this.handleRightClick()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    // 鼠标移动
    this.handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      this.handleMouseMove(movement.endPosition)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  }

  /**
   * 移除事件处理器
   */
  protected removeEventHandlers(): void {
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  }

  /**
   * 处理左键点击
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const position = this.pickPosition(screenPosition)
    if (!position) return

    this.points.push(position)

    // 添加点标记
    this.addMarker(position)

    if (this.measureType === 'distance') {
      this.handleDistanceClick()
    } else {
      this.handleAreaClick()
    }
  }

  /**
   * 处理双击（完成面积测量）
   */
  private handleDoubleClick(screenPosition: Cesium.Cartesian2): void {
    if (this.measureType !== 'area' || this.points.length < 2) return

    const position = this.pickPosition(screenPosition)
    if (position) {
      this.points.push(position)
      this.addMarker(position)
    }

    this.completeAreaMeasurement()
  }

  /**
   * 处理右键点击（取消）
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    // 节流处理
    const now = Date.now()
    if (now - this.lastMoveTime < this.MOVE_THROTTLE_MS) return
    this.lastMoveTime = now

    const position = this.pickPosition(screenPosition)
    if (!position) return

    this.currentCursorPosition = position

    // 更新预览
    if (this.points.length > 0) {
      this.updatePreview()
    }
  }

  /**
   * 距离测量点击处理
   */
  private handleDistanceClick(): void {
    if (this.points.length === 1) {
      // 第一次点击，显示提示
      this.setCursor('crosshair')
    } else if (this.points.length === 2) {
      // 第二次点击，完成测量
      this.completeDistanceMeasurement()
    }
  }

  /**
   * 面积测量点击处理
   */
  private handleAreaClick(): void {
    if (this.points.length === 1) {
      this.setCursor('crosshair')
    }
    // 继续添加点，等待双击或右键完成
  }

  /**
   * 完成距离测量
   */
  private completeDistanceMeasurement(): void {
    if (this.points.length !== 2) return

    const distance = this.calculateDistance(this.points[0], this.points[1])

    // 创建测量结果
    const measurement: Measurement = {
      id: this.generateMeasurementId(),
      type: 'distance',
      distance: distance,
      startPoint: this.cartesianToCoordinate(this.points[0]),
      endPoint: this.cartesianToCoordinate(this.points[1]),
      createdAt: new Date(),
    }

    // 创建永久显示的实体
    this.createDistanceEntities(measurement)

    // 清理预览
    this.clearPreview()
    this.resetPoints()

    // 触发回调
    if (this.onComplete) {
      this.onComplete(measurement)
    }

    this.resetCursor()
  }

  /**
   * 完成面积测量
   */
  private completeAreaMeasurement(): void {
    if (this.points.length < 3) return

    const area = this.calculateArea(this.points)

    // 创建测量结果
    const measurement: Measurement = {
      id: this.generateMeasurementId(),
      type: 'area',
      area: area,
      vertices: this.points.map((p) => this.cartesianToCoordinate(p)),
      createdAt: new Date(),
    }

    // 创建永久显示的实体
    this.createAreaEntities(measurement)

    // 清理预览
    this.clearPreview()
    this.resetPoints()

    // 触发回调
    if (this.onComplete) {
      this.onComplete(measurement)
    }

    this.resetCursor()
  }

  /**
   * 取消测量
   */
  private cancel(): void {
    this.clearPreview()
    this.clearMarkers()
    this.resetPoints()
    this.resetCursor()

    if (this.onCancel) {
      this.onCancel()
    }
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    if (!this.currentCursorPosition) return

    // 清除旧预览
    this.clearPreview()

    if (this.measureType === 'distance' && this.points.length === 1) {
      this.updateDistancePreview()
    } else if (this.measureType === 'area' && this.points.length >= 1) {
      this.updateAreaPreview()
    }
  }

  /**
   * 更新距离测量预览
   */
  private updateDistancePreview(): void {
    if (!this.currentCursorPosition || this.points.length !== 1) return

    const positions = [this.points[0], this.currentCursorPosition]
    const distance = this.calculateDistance(positions[0], positions[1])

    // 预览线
    const line = this.viewer.entities.add({
      polyline: {
        positions: positions,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.CYAN.withAlpha(0.7),
          dashLength: 16,
        }),
        clampToGround: true,
      },
    })
    this.previewEntities.push(line)

    // 预览标签
    const midpoint = Cesium.Cartesian3.midpoint(positions[0], positions[1], new Cesium.Cartesian3())
    const label = this.viewer.entities.add({
      position: midpoint,
      label: {
        text: this.formatDistance(distance),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    this.previewEntities.push(label)
  }

  /**
   * 更新面积测量预览
   */
  private updateAreaPreview(): void {
    if (!this.currentCursorPosition || this.points.length < 1) return

    const positions = [...this.points, this.currentCursorPosition]

    if (positions.length < 2) return

    // 预览线
    const line = this.viewer.entities.add({
      polyline: {
        positions: positions,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.YELLOW.withAlpha(0.7),
          dashLength: 16,
        }),
        clampToGround: true,
      },
    })
    this.previewEntities.push(line)

    // 如果有3个以上点，显示面积预览
    if (positions.length >= 3) {
      const polygon = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.YELLOW.withAlpha(0.3),
          outline: false,
          perPositionHeight: false,
        },
      })
      this.previewEntities.push(polygon)

      const area = this.calculateArea(positions)
      const centroid = this.calculateCentroid(positions)
      const label = this.viewer.entities.add({
        position: centroid,
        label: {
          text: this.formatArea(area),
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      this.previewEntities.push(label)
    }
  }

  /**
   * 创建距离测量实体
   */
  private createDistanceEntities(measurement: Measurement): void {
    // 类型守卫：确保是距离测量
    if (measurement.type !== 'distance') return
    if (!measurement.startPoint || !measurement.endPoint) return

    const pos1 = Cesium.Cartesian3.fromDegrees(
      measurement.startPoint.longitude,
      measurement.startPoint.latitude
    )
    const pos2 = Cesium.Cartesian3.fromDegrees(
      measurement.endPoint.longitude,
      measurement.endPoint.latitude
    )

    // 线
    this.viewer.entities.add({
      id: `${measurement.id}_line`,
      polyline: {
        positions: [pos1, pos2],
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.CYAN,
          dashLength: 16,
        }),
        clampToGround: true,
      },
    })

    // 标签
    const midpoint = Cesium.Cartesian3.midpoint(pos1, pos2, new Cesium.Cartesian3())
    this.viewer.entities.add({
      id: `${measurement.id}_label`,
      position: midpoint,
      label: {
        text: this.formatDistance(measurement.distance),
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  /**
   * 创建面积测量实体
   */
  private createAreaEntities(measurement: Measurement): void {
    // 类型守卫：确保是面积测量
    if (measurement.type !== 'area') return
    if (!measurement.vertices || measurement.vertices.length < 3) return

    const positions = measurement.vertices.map((v) =>
      Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude)
    )

    // 多边形
    this.viewer.entities.add({
      id: `${measurement.id}_polygon`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.YELLOW.withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.YELLOW,
        outlineWidth: 3,
        perPositionHeight: false,
      },
    })

    // 标签
    const centroid = this.calculateCentroid(positions)
    this.viewer.entities.add({
      id: `${measurement.id}_label`,
      position: centroid,
      label: {
        text: this.formatArea(measurement.area),
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  /**
   * 添加点标记
   */
  private addMarker(position: Cesium.Cartesian3): void {
    const marker = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: 8,
        color: this.measureType === 'distance' ? Cesium.Color.CYAN : Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    this.markerEntities.push(marker)
  }

  /**
   * 清除预览实体
   */
  private clearPreview(): void {
    this.previewEntities.forEach((entity) => {
      this.viewer.entities.remove(entity)
    })
    this.previewEntities = []
  }

  /**
   * 清除标记
   */
  private clearMarkers(): void {
    this.markerEntities.forEach((entity) => {
      this.viewer.entities.remove(entity)
    })
    this.markerEntities = []
  }

  /**
   * 重置点集合
   */
  private resetPoints(): void {
    this.points = []
    this.currentCursorPosition = null
  }

  /**
   * 计算距离（米）
   */
  private calculateDistance(pos1: Cesium.Cartesian3, pos2: Cesium.Cartesian3): number {
    return Cesium.Cartesian3.distance(pos1, pos2)
  }

  /**
   * 计算面积（平方米）
   */
  private calculateArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    // 使用 PolygonGeometry 计算精确面积
    const polygonGeometry = Cesium.PolygonGeometry.fromPositions({
      positions: positions,
      vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
    })

    const geometry = Cesium.PolygonGeometry.createGeometry(polygonGeometry)
    if (!geometry || !geometry.indices || !geometry.attributes.position) return 0

    // 通过三角形累加计算面积
    let area = 0
    const indices = geometry.indices
    const positionsArray = geometry.attributes.position.values

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3
      const i1 = indices[i + 1] * 3
      const i2 = indices[i + 2] * 3

      const p0 = new Cesium.Cartesian3(
        positionsArray[i0],
        positionsArray[i0 + 1],
        positionsArray[i0 + 2]
      )
      const p1 = new Cesium.Cartesian3(
        positionsArray[i1],
        positionsArray[i1 + 1],
        positionsArray[i1 + 2]
      )
      const p2 = new Cesium.Cartesian3(
        positionsArray[i2],
        positionsArray[i2 + 1],
        positionsArray[i2 + 2]
      )

      area += this.triangleArea(p0, p1, p2)
    }

    return area
  }

  /**
   * 计算三角形面积
   */
  private triangleArea(
    p0: Cesium.Cartesian3,
    p1: Cesium.Cartesian3,
    p2: Cesium.Cartesian3
  ): number {
    const a = Cesium.Cartesian3.distance(p0, p1)
    const b = Cesium.Cartesian3.distance(p1, p2)
    const c = Cesium.Cartesian3.distance(p2, p0)
    const s = (a + b + c) / 2
    return Math.sqrt(s * (s - a) * (s - b) * (s - c))
  }

  /**
   * 计算多边形重心
   */
  private calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    const sum = positions.reduce(
      (acc, pos) => Cesium.Cartesian3.add(acc, pos, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(0, 0, 0)
    )
    return Cesium.Cartesian3.divideByScalar(sum, positions.length, new Cesium.Cartesian3())
  }

  /**
   * Cartesian3 转 Coordinate
   */
  private cartesianToCoordinate(cartesian: Cesium.Cartesian3): Coordinate {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
    }
  }

  /**
   * 格式化距离
   */
  private formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${distance.toFixed(2)} m`
    } else {
      return `${(distance / 1000).toFixed(2)} km`
    }
  }

  /**
   * 格式化面积
   */
  private formatArea(area: number): string {
    if (area < 10000) {
      return `${area.toFixed(2)} m²`
    } else {
      return `${(area / 10000).toFixed(2)} 公顷`
    }
  }

  /**
   * 生成测量ID
   */
  private generateMeasurementId(): string {
    return `measure_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * 停用时清理
   */
  protected onDeactivate(): void {
    this.clearPreview()
    this.clearMarkers()
    this.resetPoints()
    this.resetCursor()
  }

  /**
   * 销毁时清理
   */
  protected onDestroy(): void {
    this.clearPreview()
    this.clearMarkers()
  }
}
