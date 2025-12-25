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
import { TOOL_COLORS, createPointMarker } from '../utils/toolStyles'
import { useGISStore } from '@/stores/gis'
import type { FloodAnalysisData } from '@/types/analysis'

/**
 * 淹没分析模式
 */
export type FloodMode =
  | 'polygon' // 手动绘制多边形区域
  | 'tileset' // 加载预设 3D Tiles 水面
  | 'terrain' // 基于地形的简单淹没

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

  /** 鼠标移动节流 */
  private lastMoveTime: number = 0
  private readonly MOVE_THROTTLE_MS = 50

  /** 当前光标位置 */
  private cursorPosition: Cesium.Cartesian3 | null = null

  /** 回调函数 */
  private onWaterLevelChange?: (level: number, result: FloodAnalysisResult) => void
  private onComplete?: (result: FloodAnalysisResult) => void
  private onCancel?: () => void

  /** 默认配置 */
  private static readonly DEFAULTS = {
    mode: 'terrain' as FloodMode,
    initialWaterLevel: 0,
    waterLevelStep: 1,
    waterColor: TOOL_COLORS.flood.fill,
    waterOpacity: 0.6,
    enableAnimation: false,
    animationSpeed: 100,
  }

  constructor(viewer: Cesium.Viewer, options: FloodToolOptions = {}) {
    // 优先使用传入的 requiresTerrain，如果没有传入，则根据 mode 判断
    const mode = options.mode ?? FloodTool.DEFAULTS.mode
    const modeRequiresTerrain = mode === 'terrain'
    const requiresTerrain = options.requiresTerrain ?? modeRequiresTerrain
    
    super(viewer, { ...options, type: 'flood' as ToolType, requiresTerrain })

    this.floodMode = mode
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
    // 禁用双击缩放
    ;(this.viewer.scene.screenSpaceCameraController as any).zoomOnDoubleClick = false

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
    // 恢复双击缩放
    ;(this.viewer.scene.screenSpaceCameraController as any).zoomOnDoubleClick = true
  }

  /**
   * 加载水面 3D Tileset
   */
  private async loadWaterTileset(): Promise<void> {
    if (!this.dataSource?.tilesetUrl) return

    try {
      const style = new Cesium.Cesium3DTileStyle({
        color: `color('${this.waterColor}', ${this.waterOpacity})`,
      })

      this.waterTileset = await this.tilesetService.loadFromUrl(this.dataSource.tilesetUrl, {
        style,
      })

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

    // 创建水面多边形（带现代化样式）
    this.waterEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        height: this.currentWaterLevel,
        material: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(this.waterOpacity),
        // 移除自带边框（会被地形遮挡），改用下方独立 Polyline
        outline: false,
      },
    })
    
    // 添加独立贴地边框，确保边界可见
    const outlineEntity = this.viewer.entities.add({
      polyline: {
        positions: [...positions, positions[0]],
        width: 3,
        material: Cesium.Color.fromCssColorString(TOOL_COLORS.flood.stroke),
        clampToGround: true,
      }
    })
    // 能够随 waterEntity 一起清除（虽然 stored separately in entities collection in BaseTool usually, but here FloodTool manages specific entities）
    // 我们可以把它们都存入 previewEntities 或者创建一个 resultEntities 列表，目前 FloodTool `clear()` 逻辑只清除 `waterEntity`
    // 我们需要一种方式追踪这个边框。简单起见，我们将边框作为 waterEntity 的子实体或关联实体？
    // Cesium Entity API 没有直接的 children。
    // 方案：将 border entity 也赋值给 waterEntity (作为复合实体? or just track it)
    // 但 current implementation only tracks `this.waterEntity` (single).
    // Let's modify `clear()` to track `waterBorderEntity` too? Or use `CompositeEntity` concept (not native).
    // Better: modify `clear()` to remove both.
    // For now, let's keep it simple: Just add it. Ideally `FloodTool` should have `resultEntities: Entity[]`.
    // Hack: Store it in `previewEntities`? No, `previewEntities` are cleared on completion.
    // Let's assign it to a new property `waterOutlineEntity`.
    this.waterOutlineEntity = outlineEntity
  }

  private waterOutlineEntity: Cesium.Entity | null = null

  /**
   * 处理左键点击（多边形模式）
   */
  private handleLeftClick(screenPosition: Cesium.Cartesian2): void {
    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    // 如果是第一个点，自动设置初始水位为该点高度，确保预览可见
    if (this.polygonPositions.length === 0) {
      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      this.currentWaterLevel = Math.floor(carto.height)
    }

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
   * 处理鼠标移动 - 更新预览
   */
  private handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    // 节流处理
    const now = Date.now()
    if (now - this.lastMoveTime < this.MOVE_THROTTLE_MS) return
    this.lastMoveTime = now

    const cartesian = this.pickPosition(screenPosition)
    if (!cartesian) return

    // 更新当前光标位置
    this.cursorPosition = cartesian

    // 如果还没有创建预览实体，且有顶点，则创建
    if (this.previewEntities.length === 0 && this.polygonPositions.length > 0) {
      this.createPolygonPreview()
    }
  }

  /**
   * 创建多边形预览实体 (使用 CallbackProperty 动态更新)
   */
  private createPolygonPreview(): void {
    this.clearPreview()

    // 静态顶点引用
    const staticPositions = this.polygonPositions

    // 1. 动态多边形 (填充)
    const previewPolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          // 如果没有光标位置，只显示静态点
          if (!this.cursorPosition) {
             return staticPositions.length >= 3 ? new Cesium.PolygonHierarchy(staticPositions) : null
          }
           // 组合静态点和当前光标位置
           const positions = [...staticPositions, this.cursorPosition]
           return positions.length >= 3 ? new Cesium.PolygonHierarchy(positions) : null
        }, false),
        height: this.currentWaterLevel,
        material: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(
          this.waterOpacity * 0.5
        ),
        outline: false,
      },
    })
    this.previewEntities.push(previewPolygon)

    // 2. 动态边界线 (Polyline) - 贴地显示
    const previewPolyline = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
           if (!this.cursorPosition) return staticPositions.length >= 2 ? [...staticPositions, staticPositions[0]] : []
           return [...staticPositions, this.cursorPosition, staticPositions[0]]
        }, false),
        width: 3,
        material: Cesium.Color.fromCssColorString(TOOL_COLORS.flood.accent).withAlpha(0.9),
        clampToGround: true,
      },
    })
    this.previewEntities.push(previewPolyline)
  }

  /**
   * 更新多边形预览 (仅需在添加新顶点时调用)
   */
  private updatePolygonPreview(): void {
    // 每次添加新顶点时，重新创建预览实体以锁定旧顶点位置
    // 或者，由于我们使用了引用 staticPositions = this.polygonPositions
    // 其实不需要重新创建实体，因为数组引用没变，但是数组内容变了
    // CallbackProperty 会自动读取最新的数组内容 + cursorPosition

    // 添加顶点标记
    const lastPos = this.polygonPositions[this.polygonPositions.length - 1]
    const marker = this.viewer.entities.add(createPointMarker(lastPos, 'vertex'))
    this.previewEntities.push(marker)
    
    // 如果是第一次添加点，需要初始化预览实体
    if (this.previewEntities.length <= 1) { // 只有标记
       this.createPolygonPreview()
    }
  }

  /**
   * 完成多边形绘制
   */
  private completePolygonDrawing(): void {
    if (this.polygonPositions.length < 3) return

    // 1. 去重：移除双击可能产生的重复最后一个点
    const length = this.polygonPositions.length
    if (length >= 2) {
      const last = this.polygonPositions[length - 1]
      const secondLast = this.polygonPositions[length - 2]
      if (Cesium.Cartesian3.equalsEpsilon(last, secondLast, Cesium.Math.EPSILON6)) {
        this.polygonPositions.pop()
      }
    }

    // 再次检查定点数量（去重后）
    if (this.polygonPositions.length < 3) return

    // 2. 清除预览 (停止动态绘制)
    this.clearPreview()
    this.cursorPosition = null // 重要：清除光标位置，防止后续 move 事件意外触发预览

    // 3. 创建结果 (使用位置副本)
    const positionsCopy = [...this.polygonPositions]

    // 自动计算初始水位：取所有顶点的最小高度
    // 这样能确保画在山上的水面不会跑到地下
    const heights = positionsCopy.map(pos => {
      const carto = Cesium.Cartographic.fromCartesian(pos)
      return carto.height
    })
    
    if (heights.length > 0) {
      const minHeight = Math.min(...heights)
      // 如果计算出的高度比默认的大（说明是山上），则使用该高度
      // 同时也保留一定的向下容差，防止完全贴地导致 Z-fighting
      if (minHeight > this.currentWaterLevel) {
        // +1米偏移，避免与平坦地形 Z-fighting
        this.currentWaterLevel = Math.floor(minHeight) + 1
        console.log(`Auto-adjusted water level to ${this.currentWaterLevel}m based on terrain`)
      }
    }

    this.createTerrainFlood(positionsCopy)

    // 4. 计算并回调
    const result = this.calculateFloodResult()
    this.onComplete?.(result)

    // 添加到 Store
    const gisStore = useGISStore()
    // 计算中心点
    let totalX = 0,
       totalY = 0,
       totalZ = 0
    // 使用 positionsCopy 因为 this.polygonPositions 已清空
    for (const pos of positionsCopy) {
       totalX += pos.x
       totalY += pos.y
       totalZ += pos.z
    }
    const centroid = new Cesium.Cartesian3(
       totalX / positionsCopy.length,
       totalY / positionsCopy.length,
       totalZ / positionsCopy.length
    )

    gisStore.addAnalysisResult({
       type: 'flood',
       name: `淹没分析 #${gisStore.analysisResults.length + 1}`,
       data: {
         waterLevel: this.currentWaterLevel,
         floodArea: result.floodedArea,
         floodVolume: result.floodedVolume,
         mode: this.floodMode,
         tilesetUrl: this.dataSource?.tilesetUrl,
       } as FloodAnalysisData,
       position: centroid,
    })

    // 5. 重置绘制状态，准备下一次绘制（或者保持结果显示）
    // 如果不清除 polygonPositions，handleMouseMove 会再次检测到有顶点从而重启预览
    this.polygonPositions = []
  }

  /**
   * 清除预览
   */
  private clearPreview(): void {
    this.previewEntities.forEach((entity) => {
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
      ;(this.waterEntity.polygon.height as any) = level
    }

    // 更新 Tileset 样式（如果使用 tileset 模式）
    if (this.waterTileset) {
      this.tilesetService.applyStyle(this.waterTileset, {
        color: `color('${this.waterColor}', ${this.waterOpacity})`,
        show: `\${waterLevel} <= ${level}`,
      })
    }

    const result = this.calculateFloodResult()
    this.onWaterLevelChange?.(level, result)

    // 添加/更新分析结果到store
    if (this.dataSource?.positions && this.dataSource.positions.length > 0) {
      const gisStore = useGISStore()
      // 计算中心点
      const positions = this.dataSource.positions
      let totalX = 0,
        totalY = 0,
        totalZ = 0
      for (const pos of positions) {
        totalX += pos.x
        totalY += pos.y
        totalZ += pos.z
      }
      const centroid = new Cesium.Cartesian3(
        totalX / positions.length,
        totalY / positions.length,
        totalZ / positions.length
      )

      gisStore.addAnalysisResult({
        type: 'flood',
        name: `淹没分析 #${gisStore.analysisResults.length + 1}`,
        data: {
          waterLevel: level,
          floodArea: result.floodedArea,
          floodVolume: result.floodedVolume,
          mode: this.floodMode,
          tilesetUrl: this.dataSource?.tilesetUrl,
        } as FloodAnalysisData,
        position: centroid,
      })
    }
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
      analyzedAt: new Date(),
    }
  }

  /**
   * 计算多边形面积（简化版）
   */
  private calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    // 使用球面多边形面积公式
    const coordinates = positions.map((pos) => {
      const carto = Cesium.Cartographic.fromCartesian(pos)
      return { lon: carto.longitude, lat: carto.latitude }
    })

    const earthRadius = 6371000
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
   * 取消操作
   */
  private cancel(): void {
    this.clearPreview()
    this.polygonPositions = []
    this.cursorPosition = null
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

    if (this.waterOutlineEntity) {
      this.viewer.entities.remove(this.waterOutlineEntity)
      this.waterOutlineEntity = null
    }

    if (this.waterTileset) {
      this.tilesetService.remove(this.waterTileset)
      this.waterTileset = null
    }

    this.polygonPositions = []
    this.cursorPosition = null
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
