/**
 * VolumeTool - 体积计算工具
 *
 * 基于 BaseTool 实现的方量分析工具
 * 用户绘制多边形定义分析区域，计算该区域与地形之间的体积
 *
 * 使用场景：
 * - 水库库容计算
 * - 土方量（挖填方）计算
 * - 洪水淹没体积估算
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions, type ToolType } from '../core/BaseTool'
import { computeCutVolume, type VolumeResult } from '../utils/volume'
import type { Coordinate } from '@/types/geometry'
import {
  TOOL_COLORS,
  POINT_STYLES,
  createGlowLineMaterial,
  createLabelEntity,
  createHintLabel,
  createPointMarker,
} from '../utils/toolStyles'
import { useGISStore } from '@/stores/gis'

/**
 * 体积分析结果
 */
export interface VolumeAnalysisResult extends VolumeResult {
  /** 基准高程 */
  baseHeight: number
  /** 分析多边形顶点 */
  positions: Cesium.Cartesian3[]
  /** 计算时间 */
  calculatedAt: Date
}

/**
 * 体积工具配置
 */
export interface VolumeToolOptions extends BaseToolOptions {
  /** 基准高程（默认0） */
  baseHeight?: number

  /** 完成回调 */
  onComplete?: (result: VolumeAnalysisResult) => void

  /** 取消回调 */
  onCancel?: () => void

  /** 样式配置 */
  style?: {
    fillColor?: string
    fillOpacity?: number
    strokeColor?: string
    strokeWidth?: number
    pointColor?: string
  }
}

/**
 * 体积计算工具类
 *
 * @example
 * ```ts
 * const volumeTool = new VolumeTool(viewer, {
 *   baseHeight: 0,
 *   onComplete: (result) => {
 *     console.log('体积:', formatVolume(result.volume))
 *   }
 * })
 * volumeTool.activate()
 * ```
 */
export class VolumeTool extends BaseTool {
  /** 基准高程 */
  private baseHeight: number

  /** 完成回调 */
  private onComplete?: (result: VolumeAnalysisResult) => void

  /** 取消回调 */
  private onCancel?: () => void

  /** 样式配置 */
  private style: Required<NonNullable<VolumeToolOptions['style']>>

  /** 默认样式 */
  private static readonly DEFAULT_STYLE = {
    fillColor: TOOL_COLORS.volume.fill,
    fillOpacity: 0.3,
    strokeColor: TOOL_COLORS.volume.stroke,
    strokeWidth: 4,
    pointColor: POINT_STYLES.vertex.color,
  }

  /** 当前绘制的顶点（Coordinate格式） */
  private vertices: Coordinate[] = []

  /** 当前绘制的顶点（Cartesian3格式） */
  private positions: Cesium.Cartesian3[] = []

  /** 预览实体集合 */
  private previewEntities: Cesium.Entity[] = []

  /** 结果可视化实体集合 */
  private resultEntities: Cesium.Entity[] = []

  /** 点标记实体集合 */
  private markerEntities: Cesium.Entity[] = []

  /** 当前光标位置 */
  private cursorPosition: Cesium.Cartesian3 | null = null

  /** 鼠标移动节流标记 */
  private lastMoveTime: number = 0
  private readonly MOVE_THROTTLE_MS = 50

  /** 上次预览时的顶点数量 */
  private lastPreviewVerticesCount: number = 0

  /** 是否正在计算 */
  private isCalculating: boolean = false

  /** 最新分析结果 */
  private lastResult: VolumeAnalysisResult | null = null

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: VolumeToolOptions = {}) {
    super(viewer, { ...options, type: 'custom' as ToolType })
    this.baseHeight = options.baseHeight ?? 0
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel
    this.style = { ...VolumeTool.DEFAULT_STYLE, ...options.style }
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

    // 右键点击 - 取消
    this.handler.setInputAction(
      () => this.handleRightClick(),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK
    )

    // 鼠标移动 - 实时预览
    this.handler.setInputAction(
      (movement: any) => this.handleMouseMove(movement.endPosition),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    )

    // 双击 - 完成绘制
    this.handler.setInputAction(
      (click: any) => this.handleDoubleClick(click.position),
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    )
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
   * 激活时的钩子
   */
  protected onActivate(): void {
    this.setCursor('crosshair')
  }

  /**
   * 停用时的钩子
   */
  protected onDeactivate(): void {
    this.resetCursor()
    this.clearPreview()
  }

  /**
   * 处理左键点击 - 添加顶点
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    const coord = this.cartesianToCoordinate(cartesian)
    this.vertices.push(coord)
    this.positions.push(cartesian)
    this.addMarker(cartesian)
  }

  /**
   * 处理右键点击 - 取消绘制
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理双击 - 完成绘制并计算体积
   */
  private handleDoubleClick(_screenPosition: Cesium.Cartesian2): void {
    if (this.positions.length >= 3) {
      this.completeDrawingAndCalculate()
    }
  }

  /**
   * 处理鼠标移动 - 更新预览
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
   * 更新实时预览
   */
  private updatePreview(): void {
    if (!this.cursorPosition || this.positions.length === 0) return

    const needsRecreate = this.positions.length !== this.lastPreviewVerticesCount

    if (needsRecreate) {
      this.clearPreviewEntities()
      this.lastPreviewVerticesCount = this.positions.length
      this.createPolygonPreview()
    }
  }

  /**
   * 创建多边形预览
   */
  private createPolygonPreview(): void {
    if (this.positions.length < 1) return

    const staticPositions = [...this.positions]

    // 多边形填充预览
    if (this.positions.length >= 2) {
      const previewPolygon = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            if (!this.cursorPosition) return new Cesium.PolygonHierarchy(staticPositions)
            return new Cesium.PolygonHierarchy([...staticPositions, this.cursorPosition])
          }, false),
          material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(
            this.style.fillOpacity
          ),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (!this.cursorPosition) return staticPositions
            return [...staticPositions, this.cursorPosition, staticPositions[0]]
          }, false),
          width: this.style.strokeWidth,
          material: createGlowLineMaterial(this.style.strokeColor, 0.25),
          clampToGround: true,
        },
      })
      this.previewEntities.push(previewPolygon)
    }

    // 提示标签
    const infoLabel = this.viewer.entities.add(
      createLabelEntity(
        new Cesium.CallbackProperty(() => {
          const count = this.positions.length
          if (count < 3) {
            return createHintLabel('点击添加顶点', count) + '\n(需要至少3个点)'
          }
          return createHintLabel('方量分析区域', count)
        }, false),
        new Cesium.CallbackProperty(
          () => this.cursorPosition || this.positions[this.positions.length - 1],
          false
        ),
        'hint'
      )
    )
    this.previewEntities.push(infoLabel)
  }

  /**
   * 完成绘制并计算体积
   */
  private async completeDrawingAndCalculate(): Promise<void> {
    if (this.positions.length < 3 || this.isCalculating) return

    this.isCalculating = true
    this.clearPreviewEntities()

    try {
      // 计算体积
      const volumeResult = computeCutVolume(this.viewer, this.positions, this.baseHeight)

      const result: VolumeAnalysisResult = {
        ...volumeResult,
        baseHeight: this.baseHeight,
        positions: [...this.positions],
        calculatedAt: new Date(),
      }

      this.lastResult = result

      // 显示结果可视化
      this.showResultVisualization(result)

      // 回调
      this.onComplete?.(result)
    } catch (error) {
      console.error('Volume calculation failed:', error)
      // 可以添加错误提示UI
    } finally {
      this.isCalculating = false
      this.reset()
    }
  }

  /**
   * 显示结果可视化
   */
  private showResultVisualization(result: VolumeAnalysisResult): void {
    // 分析区域多边形（保留显示）
    const analysisPolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(result.positions),
        material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.style.strokeColor),
        outlineWidth: 2,
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    })
    this.resultEntities.push(analysisPolygon)

    // 基准面可视化（半透明平面）
    const basePolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(result.positions),
        height: result.baseHeight,
        material: Cesium.Color.BLUE.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.BLUE.withAlpha(0.5),
        outlineWidth: 1,
      },
    })
    this.resultEntities.push(basePolygon)

    // 添加分析结果到store（面板式管理）
    const gisStore = useGISStore()
    const centroid = this.calculateCentroid(result.positions)
    gisStore.addAnalysisResult({
      type: 'volume',
      name: `方量分析 #${gisStore.analysisResults.length + 1}`,
      data: result,
      position: centroid,
    })
  }

  /**
   * 计算多边形质心
   */
  private calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
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
   * 添加顶点标记
   */
  private addMarker(position: Cesium.Cartesian3): void {
    const marker = this.viewer.entities.add(createPointMarker(position, 'vertex'))
    this.markerEntities.push(marker)
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
    this.positions = []
    this.cursorPosition = null
    this.lastPreviewVerticesCount = 0
    // 清除标记但保留结果可视化
    this.markerEntities.forEach((entity) => this.viewer.entities.remove(entity))
    this.markerEntities = []
  }

  /**
   * 清除预览实体
   */
  private clearPreviewEntities(): void {
    this.previewEntities.forEach((entity) => this.viewer.entities.remove(entity))
    this.previewEntities = []
  }

  /**
   * 清除所有预览和标记
   */
  private clearPreview(): void {
    this.clearPreviewEntities()
    this.markerEntities.forEach((entity) => this.viewer.entities.remove(entity))
    this.markerEntities = []
  }

  /**
   * 清除结果可视化
   */
  public clearResult(): void {
    this.resultEntities.forEach((entity) => this.viewer.entities.remove(entity))
    this.resultEntities = []
    this.lastResult = null
  }

  /**
   * 获取最新分析结果
   */
  public getLastResult(): VolumeAnalysisResult | null {
    return this.lastResult
  }

  /**
   * 设置基准高程
   */
  public setBaseHeight(height: number): void {
    this.baseHeight = height
  }

  /**
   * 获取基准高程
   */
  public getBaseHeight(): number {
    return this.baseHeight
  }

  /**
   * 笛卡尔坐标转经纬度
   */
  private cartesianToCoordinate(cartesian: Cesium.Cartesian3): Coordinate {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }
  }

  /**
   * 销毁工具
   */
  public destroy(): void {
    this.clearPreview()
    this.clearResult()
    super.destroy()
  }
}
