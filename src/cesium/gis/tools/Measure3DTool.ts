/**
 * Measure3DTool - 3D 测量工具
 *
 * 基于 BaseTool 实现的 3D 测量工具
 * 支持地形模式、自定义高度模式和相对高度模式
 *
 * 使用场景：
 * - 大坝建筑高度测量
 * - 水位变化测量
 * - 斜坡距离测量
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions, type ToolType } from '../core/BaseTool'
import type { Coordinate } from '@/types/geometry'
import { TOOL_COLORS, POINT_STYLES, createGlowLineMaterial } from '../utils/toolStyles'
import { useGISStore } from '@/stores/gis'

/**
 * 高度模式
 */
export type HeightMode = 'terrain' | 'custom' | 'relative'

/**
 * 3D 测量点
 */
export interface Measure3DPoint {
  /** 经纬度坐标 */
  coordinate: Coordinate
  /** Cartesian3 位置 */
  position: Cesium.Cartesian3
  /** 高程（米） */
  elevation: number
  /** 高度模式 */
  heightMode: HeightMode
}

/**
 * 3D 测量结果
 */
export interface Measure3DResult {
  /** 唯一ID */
  id: string
  /** 起点 */
  startPoint: Measure3DPoint
  /** 终点 */
  endPoint: Measure3DPoint
  /** 空间直线距离（斜距） */
  slopeDistance: number
  /** 水平距离 */
  horizontalDistance: number
  /** 垂直距离 */
  verticalDistance: number
  /** 高程差（终点 - 起点） */
  elevationDifference: number
  /** 坡度（角度） */
  slopeAngle: number
  /** 坡度（百分比） */
  slopePercent: number
  /** 测量时间 */
  createdAt: Date
}

/**
 * 3D测量工具配置
 */
export interface Measure3DToolOptions extends BaseToolOptions {
  /** 默认高度模式 */
  heightMode?: HeightMode

  /** 自定义高度值（米） */
  customHeight?: number

  /** 完成回调 */
  onComplete?: (result: Measure3DResult) => void

  /** 取消回调 */
  onCancel?: () => void

  /** 高度模式变化回调 */
  onHeightModeChange?: (mode: HeightMode) => void

  /** 样式配置 */
  style?: {
    lineColor?: string
    lineWidth?: number
    pointColor?: string
    labelColor?: string
  }
}

/**
 * 3D 测量工具类
 *
 * @example
 * ```ts
 * const measure3d = new Measure3DTool(viewer, {
 *   heightMode: 'terrain',
 *   onComplete: (result) => {
 *     console.log('斜距:', result.slopeDistance)
 *     console.log('坡度:', result.slopeAngle, '°')
 *   }
 * })
 * measure3d.activate()
 * ```
 */
export class Measure3DTool extends BaseTool {
  /** 当前高度模式 */
  private heightMode: HeightMode

  /** 自定义高度（米） */
  private customHeight: number

  /** 完成回调 */
  private onComplete?: (result: Measure3DResult) => void

  /** 取消回调 */
  private onCancel?: () => void

  /** 高度模式变化回调 */
  private onHeightModeChange?: (mode: HeightMode) => void

  /** 样式配置 */
  private style: Required<NonNullable<Measure3DToolOptions['style']>>

  /** 默认样式 */
  private static readonly DEFAULT_STYLE = {
    lineColor: TOOL_COLORS.measure3d.fill,
    lineWidth: 4,
    pointColor: POINT_STYLES.vertex.color,
    labelColor: TOOL_COLORS.common.white,
  }

  /** 测量点 */
  private points: Measure3DPoint[] = []

  /** 第一个点的高度（用于相对模式） */
  private referenceHeight: number | null = null

  /** 预览实体 */
  private previewEntities: Cesium.Entity[] = []

  /** 结果实体 */
  private resultEntities: Cesium.Entity[] = []

  /** 点标记实体 */
  private markerEntities: Cesium.Entity[] = []

  /** 当前光标位置 */
  private cursorPosition: Cesium.Cartesian3 | null = null

  /** 鼠标移动节流 */
  private lastMoveTime: number = 0
  private readonly MOVE_THROTTLE_MS = 50

  /** 键盘监听器 */
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null

  /** 按键状态 */
  private shiftPressed: boolean = false
  private ctrlPressed: boolean = false
  private altPressed: boolean = false

  /** 最新测量结果 */
  private lastResult: Measure3DResult | null = null

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: Measure3DToolOptions = {}) {
    super(viewer, { ...options, type: 'measure-3d' as ToolType })
    this.heightMode = options.heightMode ?? 'terrain'
    this.customHeight = options.customHeight ?? 0
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel
    this.onHeightModeChange = options.onHeightModeChange
    this.style = { ...Measure3DTool.DEFAULT_STYLE, ...options.style }
  }

  /**
   * 设置事件处理器
   */
  protected setupEventHandlers(): void {
    // 左键点击
    this.handler.setInputAction(
      (click: any) => this.handleLeftClick(click.position),
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    )

    // 右键取消
    this.handler.setInputAction(
      () => this.handleRightClick(),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK
    )

    // 鼠标移动
    this.handler.setInputAction(
      (movement: any) => this.handleMouseMove(movement.endPosition),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    )

    // 键盘事件
    this.setupKeyboardHandlers()
  }

  /**
   * 移除事件处理器
   */
  protected removeEventHandlers(): void {
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.removeKeyboardHandlers()
  }

  /**
   * 设置键盘监听
   */
  private setupKeyboardHandlers(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        this.shiftPressed = true
        this.updateHeightModeFromKeys()
      }
      if (e.key === 'Control') {
        this.ctrlPressed = true
        this.updateHeightModeFromKeys()
      }
      if (e.key === 'Alt') {
        this.altPressed = true
        this.updateHeightModeFromKeys()
      }
    }

    this.keyupHandler = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        this.shiftPressed = false
        this.updateHeightModeFromKeys()
      }
      if (e.key === 'Control') {
        this.ctrlPressed = false
        this.updateHeightModeFromKeys()
      }
      if (e.key === 'Alt') {
        this.altPressed = false
        this.updateHeightModeFromKeys()
      }
    }

    document.addEventListener('keydown', this.keydownHandler)
    document.addEventListener('keyup', this.keyupHandler)
  }

  /**
   * 移除键盘监听
   */
  private removeKeyboardHandlers(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler)
      this.keydownHandler = null
    }
    if (this.keyupHandler) {
      document.removeEventListener('keyup', this.keyupHandler)
      this.keyupHandler = null
    }
  }

  /**
   * 根据按键更新高度模式
   */
  private updateHeightModeFromKeys(): void {
    let newMode: HeightMode = 'terrain'

    if (this.shiftPressed) {
      newMode = 'terrain'
    } else if (this.ctrlPressed) {
      newMode = 'custom'
    } else if (this.altPressed) {
      newMode = 'relative'
    }

    if (newMode !== this.heightMode) {
      this.heightMode = newMode
      this.onHeightModeChange?.(newMode)
    }
  }

  /**
   * 激活钩子
   */
  protected onActivate(): void {
    this.setCursor('crosshair')
  }

  /**
   * 停用钩子
   */
  protected onDeactivate(): void {
    this.resetCursor()
    this.clearPreview()
    this.shiftPressed = false
    this.ctrlPressed = false
    this.altPressed = false
  }

  /**
   * 处理左键点击
   */
  private async handleLeftClick(screenPosition: Cesium.Cartesian2): Promise<void> {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    // 获取地形高程
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    let elevation = cartographic.height

    // 根据高度模式调整高程
    if (this.heightMode === 'custom') {
      elevation = this.customHeight
    } else if (this.heightMode === 'relative' && this.referenceHeight !== null) {
      // 相对第一个点的高度
      elevation = this.referenceHeight
    }

    // 创建测量点
    const point: Measure3DPoint = {
      coordinate: {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: elevation,
      },
      position: Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        elevation
      ),
      elevation,
      heightMode: this.heightMode,
    }

    this.points.push(point)
    this.addMarker(point.position, this.points.length === 1 ? '起点' : '终点')

    // 第一个点设置参考高度
    if (this.points.length === 1) {
      this.referenceHeight = elevation
    }

    // 两点完成测量
    if (this.points.length === 2) {
      this.completeMeasurement()
    }
  }

  /**
   * 处理右键点击
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    const now = Date.now()
    if (now - this.lastMoveTime < this.MOVE_THROTTLE_MS) return
    this.lastMoveTime = now

    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    this.cursorPosition = cartesian
    this.updatePreview()
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    if (!this.cursorPosition || this.points.length === 0) return

    this.clearPreviewEntities()

    const startPos = this.points[0].position

    // 根据高度模式调整终点高度
    const cartographic = Cesium.Cartographic.fromCartesian(this.cursorPosition)
    let endElevation = cartographic.height

    if (this.heightMode === 'custom') {
      endElevation = this.customHeight
    } else if (this.heightMode === 'relative' && this.referenceHeight !== null) {
      endElevation = this.referenceHeight
    }

    const endPos = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      endElevation
    )

    // 斜距线（主测量线）
    const mainLine = this.viewer.entities.add({
      polyline: {
        positions: [startPos, endPos],
        width: this.style.lineWidth,
        material: createGlowLineMaterial(this.style.lineColor, 0.3),
      },
    })
    this.previewEntities.push(mainLine)

    // 水平投影线
    const startGround = Cesium.Cartesian3.fromRadians(
      Cesium.Cartographic.fromCartesian(startPos).longitude,
      Cesium.Cartographic.fromCartesian(startPos).latitude,
      0
    )
    const endGround = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      0
    )
    const horizontalLine = this.viewer.entities.add({
      polyline: {
        positions: [startGround, endGround],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.GREEN.withAlpha(0.7),
          dashLength: 8,
        }),
        clampToGround: true,
      },
    })
    this.previewEntities.push(horizontalLine)

    // 垂直线
    const verticalLine = this.viewer.entities.add({
      polyline: {
        positions: [endGround, endPos],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.RED.withAlpha(0.7),
          dashLength: 8,
        }),
      },
    })
    this.previewEntities.push(verticalLine)

    // 计算实时数据
    const slopeDistance = Cesium.Cartesian3.distance(startPos, endPos)
    const horizontalDistance = Cesium.Cartesian3.distance(startGround, endGround)
    const verticalDistance = Math.abs(this.points[0].elevation - endElevation)

    // 信息标签
    const midPoint = Cesium.Cartesian3.midpoint(startPos, endPos, new Cesium.Cartesian3())
    const infoLabel = this.viewer.entities.add({
      position: midPoint,
      label: {
        text: [
          `┌ 模式: ${this.getHeightModeLabel()}`,
          `├ 斜距: ${this.formatDistance(slopeDistance)}`,
          `├ 水平: ${this.formatDistance(horizontalDistance)}`,
          `└ 垂直: ${this.formatDistance(verticalDistance)}`,
        ].join('\n'),
        font: '13px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(20, -40),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.8)'),
      },
    })
    this.previewEntities.push(infoLabel)
  }

  /**
   * 完成测量
   */
  private completeMeasurement(): void {
    if (this.points.length !== 2) return

    this.clearPreviewEntities()

    const startPoint = this.points[0]
    const endPoint = this.points[1]

    // 计算各种距离
    const slopeDistance = Cesium.Cartesian3.distance(startPoint.position, endPoint.position)

    const startGround = Cesium.Cartesian3.fromDegrees(
      startPoint.coordinate.longitude,
      startPoint.coordinate.latitude,
      0
    )
    const endGround = Cesium.Cartesian3.fromDegrees(
      endPoint.coordinate.longitude,
      endPoint.coordinate.latitude,
      0
    )
    const horizontalDistance = Cesium.Cartesian3.distance(startGround, endGround)
    const elevationDifference = endPoint.elevation - startPoint.elevation
    const verticalDistance = Math.abs(elevationDifference)

    // 计算坡度
    const slopeAngle = Math.atan2(verticalDistance, horizontalDistance) * (180 / Math.PI)
    const slopePercent = (verticalDistance / horizontalDistance) * 100

    const result: Measure3DResult = {
      id: this.generateId(),
      startPoint,
      endPoint,
      slopeDistance,
      horizontalDistance,
      verticalDistance,
      elevationDifference,
      slopeAngle,
      slopePercent: isFinite(slopePercent) ? slopePercent : 0,
      createdAt: new Date(),
    }

    this.lastResult = result

    // 显示结果可视化
    this.showResultVisualization(result)

    // 回调
    this.onComplete?.(result)

    // 重置准备下一次测量
    this.reset()
  }

  /**
   * 显示结果可视化
   */
  private showResultVisualization(result: Measure3DResult): void {
    // 主测量线
    const mainLine = this.viewer.entities.add({
      polyline: {
        positions: [result.startPoint.position, result.endPoint.position],
        width: this.style.lineWidth + 1,
        material: Cesium.Color.fromCssColorString(this.style.lineColor),
      },
    })
    this.resultEntities.push(mainLine)

    // 起点标记
    const startMarker = this.viewer.entities.add({
      position: result.startPoint.position,
      point: {
        pixelSize: 12,
        color: Cesium.Color.GREEN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `起点 (${result.startPoint.elevation.toFixed(1)}m)`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -25),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    this.resultEntities.push(startMarker)

    // 终点标记
    const endMarker = this.viewer.entities.add({
      position: result.endPoint.position,
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `终点 (${result.endPoint.elevation.toFixed(1)}m)`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -25),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    this.resultEntities.push(endMarker)

    // 添加分析结果到store
    const gisStore = useGISStore()
    const midPoint = Cesium.Cartesian3.midpoint(
      result.startPoint.position,
      result.endPoint.position,
      new Cesium.Cartesian3()
    )
    gisStore.addAnalysisResult({
      type: 'measure3d',
      name: `3D测量 #${gisStore.analysisResults.length + 1}`,
      data: result,
      position: midPoint,
    })
  }

  /**
   * 获取高度模式标签
   */
  private getHeightModeLabel(): string {
    switch (this.heightMode) {
      case 'terrain':
        return '地形'
      case 'custom':
        return `自定义 (${this.customHeight}m)`
      case 'relative':
        return '相对'
    }
  }

  /**
   * 格式化距离
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters.toFixed(2)} m`
    }
    return `${(meters / 1000).toFixed(3)} km`
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `measure3d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * 添加点标记
   */
  private addMarker(position: Cesium.Cartesian3, label: string): void {
    const marker = this.viewer.entities.add({
      position,
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(this.style.pointColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: label,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(15, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    this.markerEntities.push(marker)
  }

  /**
   * 取消
   */
  private cancel(): void {
    this.clearPreview()
    this.onCancel?.()
    this.reset()
  }

  /**
   * 重置
   */
  private reset(): void {
    this.points = []
    this.referenceHeight = null
    this.cursorPosition = null
    this.markerEntities.forEach((e) => this.viewer.entities.remove(e))
    this.markerEntities = []
  }

  /**
   * 清除预览实体
   */
  private clearPreviewEntities(): void {
    this.previewEntities.forEach((e) => this.viewer.entities.remove(e))
    this.previewEntities = []
  }

  /**
   * 清除预览
   */
  private clearPreview(): void {
    this.clearPreviewEntities()
    this.markerEntities.forEach((e) => this.viewer.entities.remove(e))
    this.markerEntities = []
  }

  /**
   * 清除结果
   */
  public clearResult(): void {
    this.resultEntities.forEach((e) => this.viewer.entities.remove(e))
    this.resultEntities = []
    this.lastResult = null
  }

  /**
   * 获取最新结果
   */
  public getLastResult(): Measure3DResult | null {
    return this.lastResult
  }

  /**
   * 设置高度模式
   */
  public setHeightMode(mode: HeightMode): void {
    this.heightMode = mode
    this.onHeightModeChange?.(mode)
  }

  /**
   * 获取高度模式
   */
  public getHeightMode(): HeightMode {
    return this.heightMode
  }

  /**
   * 设置自定义高度
   */
  public setCustomHeight(height: number): void {
    this.customHeight = height
  }

  /**
   * 获取自定义高度
   */
  public getCustomHeight(): number {
    return this.customHeight
  }

  /**
   * 销毁
   */
  public destroy(): void {
    this.clearPreview()
    this.clearResult()
    super.destroy()
  }
}
