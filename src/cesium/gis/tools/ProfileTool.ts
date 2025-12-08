/**
 * ProfileTool - 地形剖面分析工具
 *
 * 基于 BaseTool 实现的剖面分析工具
 * 用户绘制线段，沿线采样地形高程，生成剖面图表
 *
 * 使用场景：
 * - 河道断面分析
 * - 坝址地形分析
 * - 输水线路规划
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions, type ToolType } from '../core/BaseTool'
import type { Coordinate } from '@/types/geometry'

/**
 * 剖面采样点
 */
export interface ProfileSample {
  /** 距离起点的距离（米） */
  distance: number
  /** 高程（米） */
  elevation: number
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** Cartesian3 位置 */
  position: Cesium.Cartesian3
}

/**
 * 剖面分析结果
 */
export interface ProfileAnalysisResult {
  /** 唯一ID */
  id: string
  /** 采样点数组 */
  samples: ProfileSample[]
  /** 路径总长度（米） */
  totalDistance: number
  /** 最高点高程 */
  maxElevation: number
  /** 最低点高程 */
  minElevation: number
  /** 平均高程 */
  avgElevation: number
  /** 累计爬升 */
  totalAscent: number
  /** 累计下降 */
  totalDescent: number
  /** 起点坐标 */
  startPoint: Coordinate
  /** 终点坐标 */
  endPoint: Coordinate
  /** 采样时间 */
  createdAt: Date
}

/**
 * 剖面工具配置
 */
export interface ProfileToolOptions extends BaseToolOptions {
  /** 采样间隔（米），默认 20 */
  sampleInterval?: number

  /** 最大采样点数，默认 500 */
  maxSamples?: number

  /** 完成回调 */
  onComplete?: (result: ProfileAnalysisResult) => void

  /** 进度回调 */
  onProgress?: (progress: number) => void

  /** 取消回调 */
  onCancel?: () => void

  /** 样式配置 */
  style?: {
    lineColor?: string
    lineWidth?: number
    pointColor?: string
  }
}

/**
 * 剖面分析工具类
 *
 * @example
 * ```ts
 * const profileTool = new ProfileTool(viewer, {
 *   sampleInterval: 10,
 *   onComplete: (result) => {
 *     console.log('采样点数:', result.samples.length)
 *   }
 * })
 * profileTool.activate()
 * ```
 */
export class ProfileTool extends BaseTool {
  /** 采样间隔（米） */
  private sampleInterval: number

  /** 最大采样点数 */
  private maxSamples: number

  /** 完成回调 */
  private onComplete?: (result: ProfileAnalysisResult) => void

  /** 进度回调 */
  private onProgress?: (progress: number) => void

  /** 取消回调 */
  private onCancel?: () => void

  /** 样式配置 */
  private style: Required<NonNullable<ProfileToolOptions['style']>>

  /** 默认样式 */
  private static readonly DEFAULT_STYLE = {
    lineColor: '#00FFFF',      // 青色 neon
    lineWidth: 3,
    pointColor: '#FFFF00'      // 黄色
  }

  /** 当前绘制的顶点 */
  private positions: Cesium.Cartesian3[] = []

  /** 预览实体集合 */
  private previewEntities: Cesium.Entity[] = []

  /** 结果可视化实体 */
  private resultEntities: Cesium.Entity[] = []

  /** 点标记实体 */
  private markerEntities: Cesium.Entity[] = []

  /** 当前光标位置 */
  private cursorPosition: Cesium.Cartesian3 | null = null

  /** 鼠标移动节流 */
  private lastMoveTime: number = 0
  private readonly MOVE_THROTTLE_MS = 50

  /** 上次预览顶点数 */
  private lastPreviewCount: number = 0

  /** 是否正在采样 */
  private isSampling: boolean = false

  /** 最新分析结果 */
  private lastResult: ProfileAnalysisResult | null = null

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: ProfileToolOptions = {}) {
    super(viewer, { ...options, type: 'custom' as ToolType })
    this.sampleInterval = options.sampleInterval ?? 20
    this.maxSamples = options.maxSamples ?? 500
    this.onComplete = options.onComplete
    this.onProgress = options.onProgress
    this.onCancel = options.onCancel
    this.style = { ...ProfileTool.DEFAULT_STYLE, ...options.style }
  }

  /**
   * 设置事件处理器
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

    // 鼠标移动 - 预览
    this.handler.setInputAction(
      (movement: any) => this.handleMouseMove(movement.endPosition),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    )

    // 双击 - 完成（多点剖面）
    this.handler.setInputAction(
      (click: any) => this.handleDoubleClick(click.position),
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    )
  }

  /**
   * 移除事件处理器
   */
  protected removeEventHandlers(): void {
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
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
  }

  /**
   * 处理左键点击
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    this.positions.push(cartesian)
    this.addMarker(cartesian)

    // 两点模式：第二个点完成剖面
    if (this.positions.length === 2) {
      this.completeProfile()
    }
  }

  /**
   * 处理右键点击
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理双击（多点剖面模式）
   */
  private handleDoubleClick(_screenPosition: Cesium.Cartesian2): void {
    if (this.positions.length >= 2) {
      this.completeProfile()
    }
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
    if (!this.cursorPosition || this.positions.length === 0) return

    const needsRecreate = this.positions.length !== this.lastPreviewCount
    if (needsRecreate) {
      this.clearPreviewEntities()
      this.lastPreviewCount = this.positions.length
      this.createLinePreview()
    }
  }

  /**
   * 创建线预览
   */
  private createLinePreview(): void {
    if (this.positions.length < 1) return

    const staticPositions = [...this.positions]

    // 预览线
    const previewLine = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          if (!this.cursorPosition) return staticPositions
          return [...staticPositions, this.cursorPosition]
        }, false),
        width: this.style.lineWidth,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(this.style.lineColor).withAlpha(0.7),
          dashLength: 16
        }),
        clampToGround: true
      }
    })
    this.previewEntities.push(previewLine)

    // 距离标签
    const distanceLabel = this.viewer.entities.add({
      position: new Cesium.CallbackProperty(() => 
        this.cursorPosition || staticPositions[staticPositions.length - 1], false
      ) as unknown as Cesium.PositionProperty,
      label: {
        text: new Cesium.CallbackProperty(() => {
          if (!this.cursorPosition || this.positions.length === 0) return ''
          const dist = this.calculatePathDistance([...this.positions, this.cursorPosition])
          return `📏 ${this.formatDistance(dist)}\n单击完成 / 右键取消`
        }, false),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(20, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      }
    })
    this.previewEntities.push(distanceLabel)
  }

  /**
   * 完成剖面分析
   */
  private async completeProfile(): Promise<void> {
    if (this.positions.length < 2 || this.isSampling) return

    this.isSampling = true
    this.clearPreviewEntities()

    try {
      // 采样地形
      const samples = await this.sampleTerrain(this.positions)

      // 计算统计信息
      const result = this.calculateResult(samples)
      this.lastResult = result

      // 显示结果可视化
      this.showResultVisualization(result)

      // 回调
      this.onComplete?.(result)

    } catch (error) {
      console.error('Profile sampling failed:', error)
    } finally {
      this.isSampling = false
      this.reset()
    }
  }

  /**
   * 沿路径采样地形高程
   */
  private async sampleTerrain(pathPositions: Cesium.Cartesian3[]): Promise<ProfileSample[]> {
    const totalDistance = this.calculatePathDistance(pathPositions)
    const numSamples = Math.min(
      Math.ceil(totalDistance / this.sampleInterval) + 1,
      this.maxSamples
    )

    // 沿路径插值采样点
    const samplePositions: Cesium.Cartographic[] = []
    const segmentDistances: number[] = []

    // 计算每段距离
    for (let i = 1; i < pathPositions.length; i++) {
      segmentDistances.push(Cesium.Cartesian3.distance(pathPositions[i - 1], pathPositions[i]))
    }

    // 沿路径等距采样
    for (let i = 0; i < numSamples; i++) {
      const progress = i / (numSamples - 1)
      const targetDistance = progress * totalDistance

      // 找到对应的线段和位置
      let accumulatedDistance = 0
      let segmentIndex = 0
      let localProgress = 0

      for (let j = 0; j < segmentDistances.length; j++) {
        if (accumulatedDistance + segmentDistances[j] >= targetDistance) {
          segmentIndex = j
          localProgress = (targetDistance - accumulatedDistance) / segmentDistances[j]
          break
        }
        accumulatedDistance += segmentDistances[j]
      }

      // 线性插值位置
      const start = pathPositions[segmentIndex]
      const end = pathPositions[segmentIndex + 1] || pathPositions[segmentIndex]
      const interpolated = Cesium.Cartesian3.lerp(start, end, localProgress, new Cesium.Cartesian3())
      const cartographic = Cesium.Cartographic.fromCartesian(interpolated)
      samplePositions.push(cartographic)

      // 进度回调
      this.onProgress?.(Math.round((i / numSamples) * 50))
    }

    // 使用 Cesium 地形采样
    const terrainProvider = this.viewer.terrainProvider
    let sampledPositions: Cesium.Cartographic[]

    try {
      sampledPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, samplePositions)
    } catch {
      // 如果地形采样失败，使用原始高度
      console.warn('Terrain sampling failed, using ellipsoid heights')
      sampledPositions = samplePositions
    }

    // 构建采样结果
    const samples: ProfileSample[] = []
    let cumulativeDistance = 0

    for (let i = 0; i < sampledPositions.length; i++) {
      const cartographic = sampledPositions[i]
      const position = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height
      )

      if (i > 0) {
        const prevPos = Cesium.Cartesian3.fromRadians(
          sampledPositions[i - 1].longitude,
          sampledPositions[i - 1].latitude,
          sampledPositions[i - 1].height
        )
        cumulativeDistance += Cesium.Cartesian3.distance(prevPos, position)
      }

      samples.push({
        distance: cumulativeDistance,
        elevation: cartographic.height,
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        position
      })

      // 进度回调
      this.onProgress?.(50 + Math.round((i / sampledPositions.length) * 50))
    }

    return samples
  }

  /**
   * 计算分析结果统计
   */
  private calculateResult(samples: ProfileSample[]): ProfileAnalysisResult {
    const elevations = samples.map(s => s.elevation)
    const maxElevation = Math.max(...elevations)
    const minElevation = Math.min(...elevations)
    const avgElevation = elevations.reduce((a, b) => a + b, 0) / elevations.length

    let totalAscent = 0
    let totalDescent = 0
    for (let i = 1; i < samples.length; i++) {
      const diff = samples[i].elevation - samples[i - 1].elevation
      if (diff > 0) totalAscent += diff
      else totalDescent += Math.abs(diff)
    }

    const firstSample = samples[0]
    const lastSample = samples[samples.length - 1]

    return {
      id: this.generateId(),
      samples,
      totalDistance: lastSample.distance,
      maxElevation,
      minElevation,
      avgElevation,
      totalAscent,
      totalDescent,
      startPoint: {
        longitude: firstSample.longitude,
        latitude: firstSample.latitude,
        height: firstSample.elevation
      },
      endPoint: {
        longitude: lastSample.longitude,
        latitude: lastSample.latitude,
        height: lastSample.elevation
      },
      createdAt: new Date()
    }
  }

  /**
   * 显示结果可视化
   */
  private showResultVisualization(result: ProfileAnalysisResult): void {
    // 剖面线
    const linePositions = result.samples.map(s => s.position)
    const profileLine = this.viewer.entities.add({
      polyline: {
        positions: linePositions,
        width: this.style.lineWidth + 1,
        material: Cesium.Color.fromCssColorString(this.style.lineColor),
        clampToGround: true
      }
    })
    this.resultEntities.push(profileLine)

    // 起终点标记
    const startMarker = this.viewer.entities.add({
      position: result.samples[0].position,
      point: {
        pixelSize: 12,
        color: Cesium.Color.GREEN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: '起点',
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -25),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
    this.resultEntities.push(startMarker)

    const endMarker = this.viewer.entities.add({
      position: result.samples[result.samples.length - 1].position,
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: '终点',
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -25),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
    this.resultEntities.push(endMarker)

    // 中点信息标签
    const midIndex = Math.floor(result.samples.length / 2)
    const midPoint = result.samples[midIndex]
    const infoLabel = this.viewer.entities.add({
      position: midPoint.position,
      label: {
        text: this.formatResultText(result),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.8)'),
        backgroundPadding: new Cesium.Cartesian2(10, 8),
        pixelOffset: new Cesium.Cartesian2(0, -60)
      }
    })
    this.resultEntities.push(infoLabel)
  }

  /**
   * 格式化结果文本
   */
  private formatResultText(result: ProfileAnalysisResult): string {
    return [
      `📊 剖面分析`,
      `━━━━━━━━━━━━`,
      `长度: ${this.formatDistance(result.totalDistance)}`,
      `最高: ${result.maxElevation.toFixed(1)} m`,
      `最低: ${result.minElevation.toFixed(1)} m`,
      `爬升: ${result.totalAscent.toFixed(1)} m`,
      `下降: ${result.totalDescent.toFixed(1)} m`,
      `采样: ${result.samples.length} 点`
    ].join('\n')
  }

  /**
   * 计算路径总长度
   */
  private calculatePathDistance(positions: Cesium.Cartesian3[]): number {
    let distance = 0
    for (let i = 1; i < positions.length; i++) {
      distance += Cesium.Cartesian3.distance(positions[i - 1], positions[i])
    }
    return distance
  }

  /**
   * 格式化距离
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters.toFixed(1)} m`
    }
    return `${(meters / 1000).toFixed(2)} km`
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * 添加顶点标记
   */
  private addMarker(position: Cesium.Cartesian3): void {
    const marker = this.viewer.entities.add({
      position,
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(this.style.pointColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
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
   * 重置状态
   */
  private reset(): void {
    this.positions = []
    this.cursorPosition = null
    this.lastPreviewCount = 0
    this.markerEntities.forEach(e => this.viewer.entities.remove(e))
    this.markerEntities = []
  }

  /**
   * 清除预览实体
   */
  private clearPreviewEntities(): void {
    this.previewEntities.forEach(e => this.viewer.entities.remove(e))
    this.previewEntities = []
  }

  /**
   * 清除所有预览
   */
  private clearPreview(): void {
    this.clearPreviewEntities()
    this.markerEntities.forEach(e => this.viewer.entities.remove(e))
    this.markerEntities = []
  }

  /**
   * 清除结果可视化
   */
  public clearResult(): void {
    this.resultEntities.forEach(e => this.viewer.entities.remove(e))
    this.resultEntities = []
    this.lastResult = null
  }

  /**
   * 获取最新结果
   */
  public getLastResult(): ProfileAnalysisResult | null {
    return this.lastResult
  }

  /**
   * 设置采样间隔
   */
  public setSampleInterval(interval: number): void {
    this.sampleInterval = Math.max(1, interval)
  }

  /**
   * 获取采样间隔
   */
  public getSampleInterval(): number {
    return this.sampleInterval
  }

  /**
   * 导出 CSV
   */
  public exportCSV(result?: ProfileAnalysisResult): string {
    const data = result || this.lastResult
    if (!data) return ''

    const header = 'Distance(m),Elevation(m),Longitude,Latitude\n'
    const rows = data.samples.map(s =>
      `${s.distance.toFixed(2)},${s.elevation.toFixed(2)},${s.longitude.toFixed(6)},${s.latitude.toFixed(6)}`
    ).join('\n')

    return header + rows
  }

  /**
   * 下载 CSV 文件
   */
  public downloadCSV(filename?: string): void {
    const csv = this.exportCSV()
    if (!csv) return

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `profile_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
