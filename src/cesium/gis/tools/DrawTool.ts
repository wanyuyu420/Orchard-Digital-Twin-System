/**
 * DrawTool - 绘制工具类
 *
 * 基于 BaseTool 实现的统一绘制工具
 * 支持点、线、多边形、圆形、矩形等几何类型的绘制
 *
 * 设计理念：
 * - 参考 MeasureTool 的事件处理模式
 * - 统一的预览机制（CallbackProperty）
 * - 统一的完成/取消机制
 * - 支持多种几何类型切换
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions } from '../core/BaseTool'
import type { Coordinate } from '@/types/geometry'
import type { Feature } from '@/types/feature'

/**
 * 绘制几何类型
 */
export type DrawGeometryType = 'point' | 'line' | 'polygon' | 'circle' | 'rectangle'

/**
 * 线型类型
 */
export type LineType = 'solid' | 'dashed' | 'dotted'

/**
 * 绘制工具配置
 */
export interface DrawToolOptions extends BaseToolOptions {
  /** 绘制类型 */
  geometryType: DrawGeometryType

  /** 完成回调 */
  onComplete?: (feature: Feature) => void

  /** 取消回调 */
  onCancel?: () => void

  /** 样式配置 */
  style?: {
    fillColor?: string
    fillOpacity?: number
    strokeColor?: string
    strokeWidth?: number
    pointSize?: number
    pointColor?: string
    lineType?: LineType
  }
}

/**
 * 绘制工具类
 *
 * @example
 * ```ts
 * const drawTool = new DrawTool(viewer, {
 *   geometryType: 'polygon',
 *   onComplete: (feature) => {
 *     console.log('绘制完成:', feature)
 *   }
 * })
 * drawTool.activate()
 * ```
 */
export class DrawTool extends BaseTool {
  /** 绘制类型 */
  private geometryType: DrawGeometryType

  /** 完成回调 */
  private onComplete?: (feature: Feature) => void

  /** 取消回调 */
  private onCancel?: () => void

  /** 样式配置 */
  private style: Required<NonNullable<DrawToolOptions['style']>>

  /** 默认样式 */
  private static readonly DEFAULT_STYLE = {
    fillColor: '#3B82F6',
    fillOpacity: 0.3,
    strokeColor: '#22D3EE',
    strokeWidth: 3,
    pointSize: 10,
    pointColor: '#22D3EE',
    lineType: 'solid' as LineType
  }

  /** 当前绘制的顶点 */
  private vertices: Coordinate[] = []

  /** 预览实体集合 */
  private previewEntities: Cesium.Entity[] = []

  /** 点标记实体集合 */
  private markerEntities: Cesium.Entity[] = []

  /** 当前光标位置（绘制专用）*/
  private drawCursorPosition: Cesium.Cartesian3 | null = null

  /** 鼠标移动节流标记 */
  private lastMoveTime: number = 0
  private readonly MOVE_THROTTLE_MS = 50 // ~20fps - optimized for preview performance

  /** 上次预览时的顶点数量(用于检测是否需要重新创建预览) */
  private lastPreviewVerticesCount: number = 0

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: DrawToolOptions) {
    super(viewer, options)
    this.geometryType = options.geometryType
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel
    this.style = { ...DrawTool.DEFAULT_STYLE, ...options.style }
  }

  /**
   * 设置事件处理器
   * @protected
   */
  protected setupEventHandlers(): void {
    // 左键点击 - 添加顶点
    this.handler.setInputAction(
      (click: any) => this.handleLeftClick(click.position),
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    )

    // 右键点击 - 取消绘制
    this.handler.setInputAction(
      () => this.handleRightClick(),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK
    )

    // 鼠标移动 - 实时预览
    this.handler.setInputAction(
      (movement: any) => this.handleMouseMove(movement.endPosition),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    )

    // 双击 - 完成多边形/线绘制
    if (this.geometryType === 'polygon' || this.geometryType === 'line') {
      this.handler.setInputAction(
        (click: any) => this.handleDoubleClick(click.position),
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      )
    }
  }

  /**
   * 移除事件处理器
   * @protected
   */
  protected removeEventHandlers(): void {
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  }

  /**
   * 处理左键点击
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    const coord = this.cartesianToCoordinate(cartesian)

    // 根据几何类型处理点击
    switch (this.geometryType) {
      case 'point':
        this.handlePointClick(coord, cartesian)
        break
      case 'line':
      case 'polygon':
        this.handleLinePolygonClick(coord, cartesian)
        break
      case 'circle':
        this.handleCircleClick(coord, cartesian)
        break
      case 'rectangle':
        this.handleRectangleClick(coord, cartesian)
        break
    }
  }

  /**
   * 处理右键点击 - 取消绘制
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理双击 - 完成多边形/线绘制
   */
  private handleDoubleClick(screenPosition: Cesium.Cartesian2): void {
    if (this.geometryType === 'polygon' && this.vertices.length >= 3) {
      this.completePolygonDrawing()
    } else if (this.geometryType === 'line' && this.vertices.length >= 2) {
      this.completeLineDrawing()
    }
  }

  /**
   * 处理鼠标移动 - 更新预览
   */
  private handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    // 节流处理
    const now = Date.now()
    if (now - this.lastMoveTime < this.MOVE_THROTTLE_MS) return
    this.lastMoveTime = now

    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    this.drawCursorPosition = cartesian
    this.updatePreview()
  }

  /**
   * 点绘制处理
   */
  private handlePointClick(coord: Coordinate, cartesian: Cesium.Cartesian3): void {
    // 点绘制只需一次点击即完成
    const feature: Feature = {
      id: this.generateId(),
      type: 'point',
      name: '点标注',
      geometry: {
        type: 'Point',
        coordinates: [coord.longitude, coord.latitude, coord.height || 0] // GeoJSON array format
      },
      style: {
        fillColor: this.style.pointColor,
        pointSize: this.style.pointSize
      },
      properties: {},
      visible: true,
      createdAt: new Date()
    }

    this.complete(feature)
  }

  /**
   * 线/多边形绘制处理
   */
  private handleLinePolygonClick(coord: Coordinate, cartesian: Cesium.Cartesian3): void {
    this.vertices.push(coord)
    this.addMarker(cartesian)
  }

  /**
   * 圆形绘制处理
   */
  private handleCircleClick(coord: Coordinate, cartesian: Cesium.Cartesian3): void {
    if (this.vertices.length === 0) {
      // 第一次点击 - 设置圆心
      this.vertices.push(coord)
      this.addMarker(cartesian)
    } else {
      // 第二次点击 - 完成圆形
      this.completeCircleDrawing()
    }
  }

  /**
   * 矩形绘制处理
   */
  private handleRectangleClick(coord: Coordinate, cartesian: Cesium.Cartesian3): void {
    if (this.vertices.length === 0) {
      // 第一次点击 - 设置起点
      this.vertices.push(coord)
      this.addMarker(cartesian)
    } else {
      // 第二次点击 - 完成矩形
      this.completeRectangleDrawing()
    }
  }

  /**
   * 更新实时预览 (优化: 只在必要时重新创建实体)
   */
  private updatePreview(): void {
    if (!this.drawCursorPosition) return

    // 检查是否需要重新创建预览实体
    // 只在顶点数量变化时才重新创建,否则 CallbackProperty 会自动更新
    const needsRecreate = this.vertices.length !== this.lastPreviewVerticesCount

    if (needsRecreate) {
      // 顶点数量变化,需要清除旧预览并重新创建
      this.clearPreviewEntities()
      this.lastPreviewVerticesCount = this.vertices.length

      // Create preview based on geometry type
      switch (this.geometryType) {
        case 'line':
          this.updateLinePreview()
          break
        case 'polygon':
          this.updatePolygonPreview()
          break
        case 'circle':
          this.updateCirclePreview()
          break
        case 'rectangle':
          this.updateRectanglePreview()
          break
        // Point doesn't need preview
      }
    }
    // 如果不需要重新创建,drawCursorPosition 的更新会自动触发 CallbackProperty 回调
  }

  /**
   * 更新线预览 (使用 CallbackProperty 优化性能)
   */
  private updateLinePreview(): void {
    if (this.vertices.length === 0 || !this.drawCursorPosition) return

    const lastVertex = this.vertices[this.vertices.length - 1]
    const lastCartesian = Cesium.Cartesian3.fromDegrees(
      lastVertex.longitude,
      lastVertex.latitude,
      lastVertex.height || 0
    )

    // 计算已完成线段的总长度
    const completedLength = this.calculateCompletedLineLength()

    // 使用 CallbackProperty 动态更新位置
    const strokeColor = Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.5)
    const previewLine = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          return this.drawCursorPosition ? [lastCartesian, this.drawCursorPosition] : []
        }, false),
        width: this.style.strokeWidth,
        material: this.createLineMaterial(strokeColor, this.style.lineType),
        clampToGround: true
      }
    })
    this.previewEntities.push(previewLine)

    // 实时长度标签 - 显示当前段长度和总长度
    const lengthLabel = this.viewer.entities.add({
      position: new Cesium.CallbackProperty(() => this.drawCursorPosition || lastCartesian, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          if (!this.drawCursorPosition) return ''
          const segmentLength = Cesium.Cartesian3.distance(lastCartesian, this.drawCursorPosition)
          const totalLength = completedLength + segmentLength
          const segmentText = this.formatLength(segmentLength)
          const totalText = this.formatLength(totalLength)
          return this.vertices.length > 1
            ? `当前: ${segmentText}\n总计: ${totalText}`
            : segmentText
        }, false),
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(15, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)')
      }
    })
    this.previewEntities.push(lengthLabel)

    // 完整线预览(仅在有多个顶点时)
    if (this.vertices.length >= 2) {
      const staticPositions = this.vertices.map(v =>
        Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, v.height || 0)
      )

      const completeStrokeColor = Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.3)
      const completeLine = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return this.drawCursorPosition ? [...staticPositions, this.drawCursorPosition] : staticPositions
          }, false),
          width: this.style.strokeWidth,
          material: this.createLineMaterial(completeStrokeColor, this.style.lineType),
          clampToGround: true
        }
      })
      this.previewEntities.push(completeLine)
    }
  }

  /**
   * 计算已完成线段的总长度
   */
  private calculateCompletedLineLength(): number {
    if (this.vertices.length < 2) return 0

    let totalLength = 0
    for (let i = 1; i < this.vertices.length; i++) {
      const p1 = Cesium.Cartesian3.fromDegrees(
        this.vertices[i - 1].longitude,
        this.vertices[i - 1].latitude,
        this.vertices[i - 1].height || 0
      )
      const p2 = Cesium.Cartesian3.fromDegrees(
        this.vertices[i].longitude,
        this.vertices[i].latitude,
        this.vertices[i].height || 0
      )
      totalLength += Cesium.Cartesian3.distance(p1, p2)
    }
    return totalLength
  }

  /**
   * 格式化长度显示
   */
  private formatLength(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`
    }
    return `${meters.toFixed(1)} m`
  }

  /**
   * 根据线型创建材质
   */
  private createLineMaterial(color: Cesium.Color, lineType: LineType): Cesium.Material | Cesium.MaterialProperty {
    switch (lineType) {
      case 'dashed':
        return new Cesium.PolylineDashMaterialProperty({
          color: color,
          dashLength: 16.0,
          dashPattern: parseInt('1111000011110000', 2) // 标准虚线
        })
      case 'dotted':
        return new Cesium.PolylineDashMaterialProperty({
          color: color,
          dashLength: 8.0,
          dashPattern: parseInt('1100110011001100', 2) // 点线
        })
      case 'solid':
      default:
        return color
    }
  }

  /**
   * 更新多边形预览 (使用 CallbackProperty 优化性能)
   */
  private updatePolygonPreview(): void {
    if (this.vertices.length < 2 || !this.drawCursorPosition) return

    const staticPositions = this.vertices.map(v =>
      Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, v.height || 0)
    )

    // 使用 CallbackProperty 动态更新多边形层级结构
    const previewPolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          if (!this.drawCursorPosition) return new Cesium.PolygonHierarchy(staticPositions)
          return new Cesium.PolygonHierarchy([...staticPositions, this.drawCursorPosition])
        }, false),
        material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(this.style.fillOpacity * 0.5),
        classificationType: Cesium.ClassificationType.TERRAIN
      },
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          return this.drawCursorPosition ? [...staticPositions, this.drawCursorPosition] : staticPositions
        }, false),
        width: this.style.strokeWidth,
        material: Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.7),
        clampToGround: true
      }
    })
    this.previewEntities.push(previewPolygon)

    // 实时面积/周长标签 (3个顶点以上才显示)
    if (this.vertices.length >= 2) {
      const measurementLabel = this.viewer.entities.add({
        position: new Cesium.CallbackProperty(() => {
          // 计算多边形质心作为标签位置
          const positions = this.drawCursorPosition
            ? [...staticPositions, this.drawCursorPosition]
            : staticPositions
          return this.calculateCentroid(positions)
        }, false),
        label: {
          text: new Cesium.CallbackProperty(() => {
            if (!this.drawCursorPosition) return ''
            const positions = [...staticPositions, this.drawCursorPosition]

            // 计算周长
            const perimeter = this.calculatePolygonPerimeter(positions)

            // 只有3个点以上才计算面积
            if (positions.length >= 3) {
              const area = this.calculatePolygonArea(positions)
              return `面积: ${this.formatArea(area)}\n周长: ${this.formatLength(perimeter)}`
            }
            return `周长: ${this.formatLength(perimeter)}`
          }, false),
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)')
        }
      })
      this.previewEntities.push(measurementLabel)
    }

    // 闭合预览线 - 显示到第一个点的闭合线
    if (this.vertices.length >= 2) {
      const firstVertex = this.vertices[0]
      const firstCartesian = Cesium.Cartesian3.fromDegrees(
        firstVertex.longitude,
        firstVertex.latitude,
        firstVertex.height || 0
      )

      const closingLine = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return this.drawCursorPosition ? [this.drawCursorPosition, firstCartesian] : []
          }, false),
          width: this.style.strokeWidth,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.5),
            dashLength: 8.0
          }),
          clampToGround: true
        }
      })
      this.previewEntities.push(closingLine)
    }
  }

  /**
   * 计算多边形质心
   */
  private calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    if (positions.length === 0) return Cesium.Cartesian3.ZERO

    let x = 0, y = 0, z = 0
    for (const pos of positions) {
      x += pos.x
      y += pos.y
      z += pos.z
    }
    return new Cesium.Cartesian3(x / positions.length, y / positions.length, z / positions.length)
  }

  /**
   * 计算多边形周长
   */
  private calculatePolygonPerimeter(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 2) return 0

    let perimeter = 0
    for (let i = 0; i < positions.length; i++) {
      const nextIndex = (i + 1) % positions.length
      perimeter += Cesium.Cartesian3.distance(positions[i], positions[nextIndex])
    }
    return perimeter
  }

  /**
   * 计算多边形面积 (使用球面多边形面积公式)
   */
  private calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    // 转换为经纬度
    const coordinates = positions.map(pos => {
      const carto = Cesium.Cartographic.fromCartesian(pos)
      return { lon: carto.longitude, lat: carto.latitude }
    })

    // 使用球面多边形面积公式 (Girard's theorem approximation)
    const earthRadius = 6371000 // 地球平均半径 (米)
    let area = 0

    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length
      area += (coordinates[j].lon - coordinates[i].lon) *
              (2 + Math.sin(coordinates[i].lat) + Math.sin(coordinates[j].lat))
    }

    area = Math.abs(area * earthRadius * earthRadius / 2)
    return area
  }

  /**
   * 格式化面积显示
   */
  private formatArea(squareMeters: number): string {
    if (squareMeters >= 1000000) {
      return `${(squareMeters / 1000000).toFixed(2)} km²`
    } else if (squareMeters >= 10000) {
      return `${(squareMeters / 10000).toFixed(2)} 公顷`
    }
    return `${squareMeters.toFixed(0)} m²`
  }

  /**
   * 更新圆形预览 (使用 CallbackProperty 优化性能)
   */
  private updateCirclePreview(): void {
    if (this.vertices.length === 0 || !this.drawCursorPosition) return

    const center = this.vertices[0]
    const centerCartesian = Cesium.Cartesian3.fromDegrees(
      center.longitude,
      center.latitude,
      center.height || 0
    )

    // 使用 CallbackProperty 动态计算半径
    const previewCircle = this.viewer.entities.add({
      position: centerCartesian,
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => {
          return this.drawCursorPosition ? Cesium.Cartesian3.distance(centerCartesian, this.drawCursorPosition) : 0
        }, false),
        semiMinorAxis: new Cesium.CallbackProperty(() => {
          return this.drawCursorPosition ? Cesium.Cartesian3.distance(centerCartesian, this.drawCursorPosition) : 0
        }, false),
        material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(this.style.fillOpacity * 0.5),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.7),
        outlineWidth: this.style.strokeWidth,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
    this.previewEntities.push(previewCircle)

    // 动态半径和面积标签
    const radiusLabel = this.viewer.entities.add({
      position: new Cesium.CallbackProperty(() => this.drawCursorPosition || centerCartesian, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          if (!this.drawCursorPosition) return ''
          const radius = Cesium.Cartesian3.distance(centerCartesian, this.drawCursorPosition)
          const area = Math.PI * radius * radius
          return `半径: ${this.formatLength(radius)}\n面积: ${this.formatArea(area)}`
        }, false),
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(15, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)')
      }
    })
    this.previewEntities.push(radiusLabel)
  }

  /**
   * 更新矩形预览 (使用 CallbackProperty 优化性能)
   */
  private updateRectanglePreview(): void {
    if (this.vertices.length === 0 || !this.drawCursorPosition) return

    const corner1 = this.vertices[0]
    const corner1Carto = Cesium.Cartographic.fromDegrees(corner1.longitude, corner1.latitude)

    // 使用 CallbackProperty 动态计算矩形边界
    const previewRectangle = this.viewer.entities.add({
      rectangle: {
        coordinates: new Cesium.CallbackProperty(() => {
          if (!this.drawCursorPosition) return Cesium.Rectangle.fromDegrees(0, 0, 0, 0)

          const corner2Carto = Cesium.Cartographic.fromCartesian(this.drawCursorPosition)
          const west = Math.min(corner1Carto.longitude, corner2Carto.longitude)
          const east = Math.max(corner1Carto.longitude, corner2Carto.longitude)
          const south = Math.min(corner1Carto.latitude, corner2Carto.latitude)
          const north = Math.max(corner1Carto.latitude, corner2Carto.latitude)

          return Cesium.Rectangle.fromRadians(west, south, east, north)
        }, false),
        material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(this.style.fillOpacity * 0.5),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.style.strokeColor).withAlpha(0.7),
        outlineWidth: this.style.strokeWidth,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
    this.previewEntities.push(previewRectangle)

    // 动态尺寸和面积标签
    const dimensionsLabel = this.viewer.entities.add({
      position: new Cesium.CallbackProperty(() => {
        if (!this.drawCursorPosition) return Cesium.Cartesian3.fromDegrees(corner1.longitude, corner1.latitude)

        const corner2Carto = Cesium.Cartographic.fromCartesian(this.drawCursorPosition)
        const centerLon = (corner1Carto.longitude + corner2Carto.longitude) / 2
        const centerLat = (corner1Carto.latitude + corner2Carto.latitude) / 2
        return Cesium.Cartesian3.fromRadians(centerLon, centerLat, 0)
      }, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          if (!this.drawCursorPosition) return ''

          const corner2Carto = Cesium.Cartographic.fromCartesian(this.drawCursorPosition)
          const centerLon = (corner1Carto.longitude + corner2Carto.longitude) / 2
          const centerLat = (corner1Carto.latitude + corner2Carto.latitude) / 2

          const width = Cesium.Cartesian3.distance(
            Cesium.Cartesian3.fromRadians(Math.min(corner1Carto.longitude, corner2Carto.longitude), centerLat, 0),
            Cesium.Cartesian3.fromRadians(Math.max(corner1Carto.longitude, corner2Carto.longitude), centerLat, 0)
          )
          const height = Cesium.Cartesian3.distance(
            Cesium.Cartesian3.fromRadians(centerLon, Math.min(corner1Carto.latitude, corner2Carto.latitude), 0),
            Cesium.Cartesian3.fromRadians(centerLon, Math.max(corner1Carto.latitude, corner2Carto.latitude), 0)
          )

          const area = width * height
          return `${this.formatLength(width)} × ${this.formatLength(height)}\n面积: ${this.formatArea(area)}`
        }, false),
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)')
      }
    })
    this.previewEntities.push(dimensionsLabel)
  }

  /**
   * 清除预览实体（仅清除预览，不清除顶点标记）
   */
  private clearPreviewEntities(): void {
    this.previewEntities.forEach(entity => this.viewer.entities.remove(entity))
    this.previewEntities = []
  }

  /**
   * 完成线绘制
   */
  private completeLineDrawing(): void {
    if (this.vertices.length < 2) return

    const feature: Feature = {
      id: this.generateId(),
      type: 'line',
      name: '线绘制',
      geometry: {
        type: 'LineString',
        coordinates: this.vertices.map(v => [v.longitude, v.latitude, v.height || 0]) // GeoJSON array format
      },
      style: {
        strokeColor: this.style.strokeColor,
        strokeWidth: this.style.strokeWidth,
        lineType: this.style.lineType
      },
      properties: {
        length: this.calculateCompletedLineLength()
      },
      visible: true,
      createdAt: new Date()
    }

    this.complete(feature)
  }

  /**
   * 完成多边形绘制
   */
  private completePolygonDrawing(): void {
    if (this.vertices.length < 3) return

    // GeoJSON Polygon: array of rings, first ring is exterior
    const ring = this.vertices.map(v => [v.longitude, v.latitude, v.height || 0])

    const feature: Feature = {
      id: this.generateId(),
      type: 'polygon',
      name: '多边形',
      geometry: {
        type: 'Polygon',
        coordinates: [ring] // GeoJSON requires array of rings
      },
      style: {
        fillColor: this.style.fillColor,
        fillOpacity: this.style.fillOpacity,
        strokeColor: this.style.strokeColor,
        strokeWidth: this.style.strokeWidth
      },
      properties: {},
      visible: true,
      createdAt: new Date()
    }

    this.complete(feature)
  }

  /**
   * 完成圆形绘制
   */
  private completeCircleDrawing(): void {
    if (this.vertices.length < 1 || !this.drawCursorPosition) return

    const center = this.vertices[0]
    const cursorCoord = this.cartesianToCoordinate(this.drawCursorPosition)

    // Calculate radius using geodesic distance
    const centerCartesian = Cesium.Cartesian3.fromDegrees(
      center.longitude,
      center.latitude,
      center.height || 0
    )
    const radius = Cesium.Cartesian3.distance(centerCartesian, this.drawCursorPosition)

    const feature: Feature = {
      id: this.generateId(),
      type: 'circle',
      name: '圆形',
      geometry: {
        type: 'Point', // Circle is represented as center point
        coordinates: [center.longitude, center.latitude, center.height || 0]
      },
      style: {
        fillColor: this.style.fillColor,
        fillOpacity: this.style.fillOpacity,
        strokeColor: this.style.strokeColor,
        strokeWidth: this.style.strokeWidth
      },
      properties: {
        radius: radius,
        area: Math.PI * radius * radius
      },
      visible: true,
      createdAt: new Date()
    }

    this.complete(feature)
  }

  /**
   * 完成矩形绘制
   */
  private completeRectangleDrawing(): void {
    if (this.vertices.length < 1 || !this.drawCursorPosition) return

    const corner1 = this.vertices[0]
    const corner2 = this.cartesianToCoordinate(this.drawCursorPosition)

    // GeoJSON Polygon: rectangle as closed ring
    const west = Math.min(corner1.longitude, corner2.longitude)
    const east = Math.max(corner1.longitude, corner2.longitude)
    const south = Math.min(corner1.latitude, corner2.latitude)
    const north = Math.max(corner1.latitude, corner2.latitude)
    const height = corner1.height || 0

    const ring = [
      [west, south, height],
      [east, south, height],
      [east, north, height],
      [west, north, height],
      [west, south, height] // close the ring
    ]

    const feature: Feature = {
      id: this.generateId(),
      type: 'rectangle',
      name: '矩形',
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      },
      style: {
        fillColor: this.style.fillColor,
        fillOpacity: this.style.fillOpacity,
        strokeColor: this.style.strokeColor,
        strokeWidth: this.style.strokeWidth
      },
      properties: {
        west,
        east,
        south,
        north
      },
      visible: true,
      createdAt: new Date()
    }

    this.complete(feature)
  }

  /**
   * 添加顶点标记
   */
  private addMarker(position: Cesium.Cartesian3): void {
    const marker = this.viewer.entities.add({
      position,
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString(this.style.pointColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
    this.markerEntities.push(marker)
  }

  /**
   * 完成绘制
   */
  private complete(feature: Feature): void {
    this.clearPreview()
    this.onComplete?.(feature)
    this.reset()
  }

  /**
   * 取消绘制
   */
  private cancel(): void {
    this.clearPreview()
    this.onCancel?.()
    this.reset()
  }

  /**
   * 重置状态
   */
  private reset(): void {
    this.vertices = []
    this.drawCursorPosition = null
    this.lastPreviewVerticesCount = 0
  }

  /**
   * 清除预览实体
   */
  private clearPreview(): void {
    this.previewEntities.forEach(entity => this.viewer.entities.remove(entity))
    this.previewEntities = []

    this.markerEntities.forEach(entity => this.viewer.entities.remove(entity))
    this.markerEntities = []
  }

  /**
   * 拾取地形位置
   */
  protected pickPosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.scene.camera.getPickRay(screenPosition)
    if (!ray) return null
    return this.viewer.scene.globe.pick(ray, this.viewer.scene)
  }

  /**
   * 笛卡尔坐标转经纬度
   */
  private cartesianToCoordinate(cartesian: Cesium.Cartesian3): Coordinate {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `draw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 清理资源
   * @override
   */
  public destroy(): void {
    this.clearPreview()
    super.destroy()
  }
}
