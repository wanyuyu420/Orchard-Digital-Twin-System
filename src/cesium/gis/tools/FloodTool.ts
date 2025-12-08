/**
 * FloodTool - 淹没分析工具
 *
 * 基于 BaseTool 实现的洪水淹没模拟工具
 * 支持加载 3D Tiles 水面数据，动态调整水位
 *
 * 使用场景：
 * - 洪水淹没范围可视化
 * - 水位动态模拟
 * - 淹没面积/体积计算
 */

import * as Cesium from 'cesium'
import { BaseTool, type BaseToolOptions, type ToolType } from '../core/BaseTool'
import { TilesetService } from '../services/TilesetService'

/**
 * 淹没分析模式
 */
export type FloodMode =
  | 'polygon'    // 手动绘制多边形区域
  | 'tileset'    // 加载预设 3D Tiles 水面
  | 'terrain'    // 基于地形的简单淹没

/**
 * 洪水数据源配置
 */
export interface FloodDataSource {
  /** 数据源类型 */
  type: 'tileset' | 'geojson' | 'polygon'
  /** tileset.json URL (tileset 类型) */
  tilesetUrl?: string
  /** GeoJSON URL (geojson 类型) */
  geojsonUrl?: string
  /** 多边形坐标 (polygon 类型) */
  positions?: Cesium.Cartesian3[]
  /** 最小水位（米） */
  minWaterLevel?: number
  /** 最大水位（米） */
  maxWaterLevel?: number
  /** 时间步数 */
  timeSteps?: number
}

/**
 * 淹没分析结果
 */
export interface FloodAnalysisResult {
  /** 当前水位 */
  waterLevel: number
  /** 淹没面积（平方米） */
  floodedArea: number
  /** 淹没体积（立方米） */
  floodedVolume: number
  /** 分析时间 */
  analyzedAt: Date
}

/**
 * 淹没工具配置
 */
export interface FloodToolOptions extends BaseToolOptions {
  /** 淹没模式 */
  mode?: FloodMode

  /** 数据源 */
  dataSource?: FloodDataSource

  /** 初始水位（米） */
  initialWaterLevel?: number

  /** 水位变化步长（米） */
  waterLevelStep?: number

  /** 水面颜色 */
  waterColor?: string

  /** 水面透明度 */
  waterOpacity?: number

  /** 是否启用动画 */
  enableAnimation?: boolean

  /** 动画速度（毫秒/帧） */
  animationSpeed?: number

  /** 水位变化回调 */
  onWaterLevelChange?: (level: number, result: FloodAnalysisResult) => void

  /** 完成回调 */
  onComplete?: (result: FloodAnalysisResult) => void

  /** 取消回调 */
  onCancel?: () => void
}

/**
 * 淹没分析工具类
 *
 * @example
 * ```ts
 * const floodTool = new FloodTool(viewer, {
 *   mode: 'tileset',
 *   dataSource: {
 *     type: 'tileset',
 *     tilesetUrl: '/mock/flood/mild/tileset.json',
 *     minWaterLevel: 0,
 *     maxWaterLevel: 50
 *   },
 *   initialWaterLevel: 10,
 *   onWaterLevelChange: (level, result) => {
 *     console.log(`水位: ${level}m, 淹没面积: ${result.floodedArea}`)
 *   }
 * })
 * floodTool.activate()
 * ```
 */
export class FloodTool extends BaseTool {
  /** 淹没模式 */
  private floodMode: FloodMode

  /** 数据源配置 */
  private dataSource?: FloodDataSource

  /** 当前水位 */
  private currentWaterLevel: number = 0

  /** 水位步长 */
  private waterLevelStep: number

  /** 水面颜色 */
  private waterColor: string

  /** 水面透明度 */
  private waterOpacity: number

  /** 是否启用动画 */
  private _enableAnimation: boolean

  /** 动画速度 */
  private animationSpeed: number

  /** 动画定时器 */
  private animationTimer: number | null = null

  /** 动画方向 (1: 上涨, -1: 下降) */
  private animationDirection: 1 | -1 = 1

  /** TilesetService 实例 */
  private tilesetService: TilesetService

  /** 已加载的水面 Tileset */
  private waterTileset: Cesium.Cesium3DTileset | null = null

  /** 简单水面实体（terrain 模式） */
  private waterEntity: Cesium.Entity | null = null

  /** 多边形绘制顶点 */
  private polygonPositions: Cesium.Cartesian3[] = []

  /** 预览实体 */
  private previewEntities: Cesium.Entity[] = []

  /** 回调函数 */
  private onWaterLevelChange?: (level: number, result: FloodAnalysisResult) => void
  private onComplete?: (result: FloodAnalysisResult) => void
  private onCancel?: () => void

  /** 默认配置 */
  private static readonly DEFAULTS = {
    mode: 'terrain' as FloodMode,
    initialWaterLevel: 0,
    waterLevelStep: 1,
    waterColor: '#1E90FF',     // 道奇蓝
    waterOpacity: 0.6,
    enableAnimation: false,
    animationSpeed: 100
  }

  constructor(viewer: Cesium.Viewer, options: FloodToolOptions = {}) {
    super(viewer, { ...options, type: 'custom' as ToolType })

    this.floodMode = options.mode ?? FloodTool.DEFAULTS.mode
    this.dataSource = options.dataSource
    this.currentWaterLevel = options.initialWaterLevel ?? FloodTool.DEFAULTS.initialWaterLevel
    this.waterLevelStep = options.waterLevelStep ?? FloodTool.DEFAULTS.waterLevelStep
    this.waterColor = options.waterColor ?? FloodTool.DEFAULTS.waterColor
    this.waterOpacity = options.waterOpacity ?? FloodTool.DEFAULTS.waterOpacity
    this._enableAnimation = options.enableAnimation ?? FloodTool.DEFAULTS.enableAnimation
    this.animationSpeed = options.animationSpeed ?? FloodTool.DEFAULTS.animationSpeed

    this.onWaterLevelChange = options.onWaterLevelChange
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel

    this.tilesetService = new TilesetService(viewer)
  }

  protected setupEventHandlers(): void {
    if (this.floodMode === 'polygon') {
      // 多边形绘制模式
      this.handler.setInputAction(
        (click: any) => this.handleLeftClick(click.position),
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      )

      this.handler.setInputAction(
        () => this.handleRightClick(),
        Cesium.ScreenSpaceEventType.RIGHT_CLICK
      )

      this.handler.setInputAction(
        (movement: any) => this.handleMouseMove(movement.endPosition),
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      )

      this.handler.setInputAction(
        () => this.handleDoubleClick(),
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      )
    }
  }

  protected removeEventHandlers(): void {
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  }

  protected onActivate(): void {
    this.setCursor('crosshair')

    // 根据模式初始化
    if (this.floodMode === 'tileset' && this.dataSource?.tilesetUrl) {
      this.loadWaterTileset()
    } else if (this.floodMode === 'terrain' && this.dataSource?.positions) {
      this.createTerrainFlood(this.dataSource.positions)
    }

    // 如果启用了自动动画
    if (this._enableAnimation) {
      this.startAnimation()
    }
  }

  protected onDeactivate(): void {
    this.resetCursor()
    this.stopAnimation()
    this.clearPreview()
  }

  /**
   * 加载水面 3D Tileset
   */
  private async loadWaterTileset(): Promise<void> {
    if (!this.dataSource?.tilesetUrl) return

    try {
      const style = new Cesium.Cesium3DTileStyle({
        color: `color('${this.waterColor}', ${this.waterOpacity})`
      })

      this.waterTileset = await this.tilesetService.loadFromUrl(
        this.dataSource.tilesetUrl,
        { style }
      )

      // 飞行到 tileset
      await this.tilesetService.flyTo(this.waterTileset)

      console.log('Water tileset loaded')

    } catch (error) {
      console.error('Failed to load water tileset:', error)
    }
  }

  /**
   * 创建基于地形的简单淹没效果
   */
  private createTerrainFlood(positions: Cesium.Cartesian3[]): void {
    if (positions.length < 3) return

    // 创建水面多边形
    this.waterEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        height: this.currentWaterLevel,
        material: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(this.waterOpacity),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.waterColor),
        outlineWidth: 2
      }
    })
  }

  /**
   * 处理左键点击（多边形模式）
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    this.polygonPositions.push(cartesian)
    this.updatePolygonPreview()
  }

  /**
   * 处理右键点击 - 取消
   */
  private handleRightClick(): void {
    this.cancel()
  }

  /**
   * 处理双击 - 完成多边形绘制
   */
  private handleDoubleClick(): void {
    if (this.polygonPositions.length >= 3) {
      this.completePolygonDrawing()
    }
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(_screenPosition: Cesium.Cartesian2): void {
    // 可添加预览逻辑（鼠标跟随等）
  }

  /**
   * 更新多边形预览
   */
  private updatePolygonPreview(): void {
    this.clearPreview()

    if (this.polygonPositions.length < 2) return

    // 绘制预览多边形
    const previewPolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(this.polygonPositions),
        height: this.currentWaterLevel,
        material: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(this.waterOpacity * 0.5),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(0.8),
        outlineWidth: 2
      }
    })
    this.previewEntities.push(previewPolygon)

    // 绘制顶点标记
    this.polygonPositions.forEach(pos => {
      const marker = this.viewer.entities.add({
        position: pos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        }
      })
      this.previewEntities.push(marker)
    })
  }

  /**
   * 完成多边形绘制
   */
  private completePolygonDrawing(): void {
    this.clearPreview()
    this.createTerrainFlood(this.polygonPositions)

    const result = this.calculateFloodResult()
    this.onComplete?.(result)
  }

  /**
   * 清除预览
   */
  private clearPreview(): void {
    this.previewEntities.forEach(entity => {
      this.viewer.entities.remove(entity)
    })
    this.previewEntities = []
  }

  /**
   * 设置水位
   */
  public setWaterLevel(level: number): void {
    this.currentWaterLevel = level

    // 更新水面高度
    if (this.waterEntity?.polygon) {
      (this.waterEntity.polygon.height as any) = level
    }

    // 更新 Tileset 样式（如果使用 tileset 模式）
    if (this.waterTileset) {
      this.tilesetService.applyStyle(this.waterTileset, {
        color: `color('${this.waterColor}', ${this.waterOpacity})`,
        show: `\${waterLevel} <= ${level}`
      })
    }

    const result = this.calculateFloodResult()
    this.onWaterLevelChange?.(level, result)
  }

  /**
   * 获取当前水位
   */
  public getWaterLevel(): number {
    return this.currentWaterLevel
  }

  /**
   * 增加水位
   */
  public raiseWaterLevel(): void {
    const maxLevel = this.dataSource?.maxWaterLevel ?? 100
    const newLevel = Math.min(this.currentWaterLevel + this.waterLevelStep, maxLevel)
    this.setWaterLevel(newLevel)
  }

  /**
   * 降低水位
   */
  public lowerWaterLevel(): void {
    const minLevel = this.dataSource?.minWaterLevel ?? 0
    const newLevel = Math.max(this.currentWaterLevel - this.waterLevelStep, minLevel)
    this.setWaterLevel(newLevel)
  }

  /**
   * 开始水位动画
   */
  public startAnimation(): void {
    if (this.animationTimer) return

    this.animationTimer = window.setInterval(() => {
      const minLevel = this.dataSource?.minWaterLevel ?? 0
      const maxLevel = this.dataSource?.maxWaterLevel ?? 100

      if (this.animationDirection === 1) {
        if (this.currentWaterLevel >= maxLevel) {
          this.animationDirection = -1
        } else {
          this.raiseWaterLevel()
        }
      } else {
        if (this.currentWaterLevel <= minLevel) {
          this.animationDirection = 1
        } else {
          this.lowerWaterLevel()
        }
      }
    }, this.animationSpeed)
  }

  /**
   * 停止水位动画
   */
  public stopAnimation(): void {
    if (this.animationTimer) {
      window.clearInterval(this.animationTimer)
      this.animationTimer = null
    }
  }

  /**
   * 切换动画状态
   */
  public toggleAnimation(): void {
    if (this.animationTimer) {
      this.stopAnimation()
    } else {
      this.startAnimation()
    }
  }

  /**
   * 计算淹没分析结果
   */
  private calculateFloodResult(): FloodAnalysisResult {
    // 简化计算 - 实际项目中应使用精确的 GIS 计算
    let floodedArea = 0
    let floodedVolume = 0

    if (this.polygonPositions.length >= 3) {
      // 使用多边形面积近似计算
      floodedArea = this.calculatePolygonArea(this.polygonPositions)
      floodedVolume = floodedArea * this.currentWaterLevel
    }

    return {
      waterLevel: this.currentWaterLevel,
      floodedArea,
      floodedVolume,
      analyzedAt: new Date()
    }
  }

  /**
   * 计算多边形面积（简化版）
   */
  private calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    // 使用球面多边形面积公式
    const coordinates = positions.map(pos => {
      const carto = Cesium.Cartographic.fromCartesian(pos)
      return { lon: carto.longitude, lat: carto.latitude }
    })

    const earthRadius = 6371000
    let area = 0

    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length
      area += (coordinates[j].lon - coordinates[i].lon) *
              (2 + Math.sin(coordinates[i].lat) + Math.sin(coordinates[j].lat))
    }

    return Math.abs(area * earthRadius * earthRadius / 2)
  }

  /**
   * 取消操作
   */
  private cancel(): void {
    this.clearPreview()
    this.polygonPositions = []
    this.onCancel?.()
  }

  /**
   * 清除所有淹没效果
   */
  public clear(): void {
    this.stopAnimation()
    this.clearPreview()

    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity)
      this.waterEntity = null
    }

    if (this.waterTileset) {
      this.tilesetService.remove(this.waterTileset)
      this.waterTileset = null
    }

    this.polygonPositions = []
    this.currentWaterLevel = 0
  }

  /**
   * 销毁工具
   */
  public destroy(): void {
    this.clear()
    this.tilesetService.destroy()
    super.destroy()
  }
}
