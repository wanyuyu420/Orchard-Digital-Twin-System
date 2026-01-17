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

  /** 是否显示边界水墙（增强可读性，仅视觉效果） */
  showWaterWall?: boolean

  /** 水墙透明度（默认与 waterOpacity 接近） */
  waterWallOpacity?: number

  /** 是否启用动画 */
  enableAnimation?: boolean

  /** 动画 tick 间隔（毫秒/帧），主要用于平滑度/性能，一般无需调整 */
  animationSpeed?: number

  /** 涨/退水速度（米/秒） */
  riseRateMps?: number

  /** 水位变化回调 */
  onWaterLevelChange?: (level: number, result: FloodAnalysisResult) => void

  /** 完成回调 */
  onComplete?: (result: FloodAnalysisResult) => void

  /** 取消回调 */
  onCancel?: () => void

  /** 地形采样网格间距（米，局部平面近似）。越小越精细，但采样更慢。 */
  gridSpacingMeters?: number

  /** 网格采样点数量上限，超过则自动放大网格间距 */
  maxGridPoints?: number
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

  /** 是否显示边界水墙 */
  private showWaterWall: boolean

  /** 水墙透明度 */
  private waterWallOpacity: number

  /** 是否启用动画 */
  private _enableAnimation: boolean

  /** 动画 tick 间隔（毫秒） */
  private animationTickMs: number

  /** 涨/退水速度（米/秒） */
  private riseRateMps: number

  /** 动画定时器 */
  private animationTimer: number | null = null

  /** 动画上一次 tick 时间戳（ms） */
  private lastAnimationTs: number = 0

  /** 合并调度：拖动水位时避免每次都同步重算导致卡顿 */
  private pendingRecomputeTimer: number | null = null

  /** 动画方向 (1: 上涨, -1: 下降) */
  private animationDirection: 1 | -1 = 1

  /** TilesetService 实例 */
  private tilesetService: TilesetService

  /** 已加载的水面 Tileset */
  private waterTileset: Cesium.Cesium3DTileset | null = null

  /** 简单水面实体（terrain 模式） */
  private waterEntity: Cesium.Entity | null = null

  /** 边界水墙实体（可选） */
  private waterWallEntity: Cesium.Entity | null = null

  /** Transient UI entities (e.g. validation hints) */
  private transientEntities: Cesium.Entity[] = []

  /** 多边形绘制顶点 */
  private polygonPositions: Cesium.Cartesian3[] = []

  /** 已完成的多边形顶点（用于面积/体积计算） */
  private completedPositions: Cesium.Cartesian3[] = []

  /** 顶点高程范围（在网格采样完成前用于生成水位上下限） */
  private vertexMinHeight: number | null = null
  private vertexMaxHeight: number | null = null

  /** 地形网格采样配置 */
  private gridSpacingMeters: number
  private maxGridPoints: number

  /** 地形网格采样缓存（局部 ENU 平面近似） */
  private gridCache:
    | {
        status: 'idle' | 'sampling' | 'ready' | 'failed'
        requestedSpacing: number
        effectiveSpacing: number
        cellArea: number
        terrainHeights: number[]
        minTerrainHeight: number
        maxTerrainHeight: number
      }
    | null = null

  /** 用于取消/丢弃过期采样任务 */
  private gridSamplingToken = 0

  /** 对应的分析结果ID（用于水位变化时更新同一条结果，而不是新增） */
  private analysisResultId: string | null = null

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
    showWaterWall: true,
    waterWallOpacity: 0.35,
    enableAnimation: false,
    animationSpeed: 50,
    riseRateMps: 0.5,
    gridSpacingMeters: 50,
    maxGridPoints: 20000,
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
    this.showWaterWall = options.showWaterWall ?? FloodTool.DEFAULTS.showWaterWall
    this.waterWallOpacity = options.waterWallOpacity ?? FloodTool.DEFAULTS.waterWallOpacity
    this._enableAnimation = options.enableAnimation ?? FloodTool.DEFAULTS.enableAnimation
    this.animationTickMs = options.animationSpeed ?? FloodTool.DEFAULTS.animationSpeed
    this.riseRateMps = options.riseRateMps ?? FloodTool.DEFAULTS.riseRateMps

    this.gridSpacingMeters = options.gridSpacingMeters ?? FloodTool.DEFAULTS.gridSpacingMeters
    this.maxGridPoints = options.maxGridPoints ?? FloodTool.DEFAULTS.maxGridPoints

    this.onWaterLevelChange = options.onWaterLevelChange
    this.onComplete = options.onComplete
    this.onCancel = options.onCancel

    this.tilesetService = new TilesetService(viewer)
  }

  private getGridStatus(): FloodAnalysisData['calculationStatus'] {
    return (this.gridCache?.status ?? 'idle') as FloodAnalysisData['calculationStatus']
  }

  private getWaterLevelLimits(): { min: number; max: number } {
    // polygon/terrain 模式下：水位应该跟着地形高程范围走，而不是固定 0-50。
    const baseMin = this.dataSource?.minWaterLevel ?? 0
    const baseMax = this.dataSource?.maxWaterLevel ?? 100

    let minH: number | null = null
    let maxH: number | null = null

    if (this.gridCache?.status === 'ready') {
      minH = this.gridCache.minTerrainHeight
      maxH = this.gridCache.maxTerrainHeight
    } else if (this.vertexMinHeight !== null && this.vertexMaxHeight !== null) {
      minH = this.vertexMinHeight
      maxH = this.vertexMaxHeight
    }

    if (minH !== null && maxH !== null && Number.isFinite(minH) && Number.isFinite(maxH)) {
      const min = Math.floor(minH) - 5
      const max = Math.ceil(maxH) + 50
      // 确保包含当前值
      return {
        min: Math.min(min, this.currentWaterLevel),
        max: Math.max(max, this.currentWaterLevel),
      }
    }

    // 回退：仍用 dataSource 的 min/max，但也要覆盖当前水位
    return {
      min: Math.min(baseMin, this.currentWaterLevel),
      max: Math.max(baseMax, this.currentWaterLevel),
    }
  }

  private async prepareTerrainGridAsync(positions: Cesium.Cartesian3[]): Promise<void> {
    // 只在 polygon/terrain 模式下启用网格采样。tileset 模式目前没有可靠地形支撑。
    if (positions.length < 3) return
    if (this.floodMode !== 'polygon' && this.floodMode !== 'terrain') return

    const token = ++this.gridSamplingToken
    this.gridCache = {
      status: 'sampling',
      requestedSpacing: this.gridSpacingMeters,
      effectiveSpacing: this.gridSpacingMeters,
      cellArea: this.gridSpacingMeters * this.gridSpacingMeters,
      terrainHeights: [],
      minTerrainHeight: Number.POSITIVE_INFINITY,
      maxTerrainHeight: Number.NEGATIVE_INFINITY,
    }

    // 先把“正在计算”的状态写进结果（如果存在）
    if (this.analysisResultId) {
      const gisStore = useGISStore()
      gisStore.updateAnalysisResult(this.analysisResultId, {
        data: {
          calculationMethod: 'terrain_grid',
          calculationStatus: 'sampling',
          gridSpacingMeters: this.gridSpacingMeters,
        } as FloodAnalysisData,
      })
    }

    try {
      const grid = await this.sampleTerrainGridHeights(positions, this.gridSpacingMeters, this.maxGridPoints)
      if (token !== this.gridSamplingToken) return

      this.gridCache = {
        status: 'ready',
        requestedSpacing: this.gridSpacingMeters,
        effectiveSpacing: grid.effectiveSpacing,
        cellArea: grid.cellArea,
        terrainHeights: grid.terrainHeights,
        minTerrainHeight: grid.minTerrainHeight,
        maxTerrainHeight: grid.maxTerrainHeight,
      }

      const result = this.calculateFloodResult()
      this.onWaterLevelChange?.(this.currentWaterLevel, result)

      if (this.analysisResultId) {
        const gisStore = useGISStore()
        gisStore.updateAnalysisResult(this.analysisResultId, {
          data: {
            waterLevel: this.currentWaterLevel,
            floodArea: result.floodedArea,
            floodVolume: result.floodedVolume,
            mode: this.floodMode,
            tilesetUrl: this.dataSource?.tilesetUrl,
            calculationMethod: 'terrain_grid',
            calculationStatus: 'ready',
            gridSpacingMeters: this.gridCache.requestedSpacing,
            effectiveGridSpacingMeters: this.gridCache.effectiveSpacing,
            sampleCount: this.gridCache.terrainHeights.length,
            cellArea: this.gridCache.cellArea,
            minTerrainHeight: this.gridCache.minTerrainHeight,
            maxTerrainHeight: this.gridCache.maxTerrainHeight,
          } as FloodAnalysisData,
        })
      }
    } catch (e) {
      if (token !== this.gridSamplingToken) return
      console.error('[FloodTool] Terrain grid sampling failed:', e)
      if (this.gridCache) this.gridCache.status = 'failed'
      if (this.analysisResultId) {
        const gisStore = useGISStore()
        gisStore.updateAnalysisResult(this.analysisResultId, {
          data: {
            calculationMethod: 'terrain_grid',
            calculationStatus: 'failed',
            gridSpacingMeters: this.gridSpacingMeters,
          } as FloodAnalysisData,
        })
      }
    }
  }

  private async sampleTerrainGridHeights(
    polygonPositions: Cesium.Cartesian3[],
    spacingMeters: number,
    maxPoints: number
  ): Promise<{
    effectiveSpacing: number
    cellArea: number
    terrainHeights: number[]
    minTerrainHeight: number
    maxTerrainHeight: number
  }> {
    const ellipsoid = Cesium.Ellipsoid.WGS84
    const center = Cesium.BoundingSphere.fromPoints(polygonPositions).center
    const originOnSurface = ellipsoid.scaleToGeodeticSurface(center, new Cesium.Cartesian3())
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originOnSurface)
    const invEnu = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())

    const polygon2D: Array<{ x: number; y: number }> = polygonPositions.map((p) => {
      const local = Cesium.Matrix4.multiplyByPoint(invEnu, p, new Cesium.Cartesian3())
      return { x: local.x, y: local.y }
    })

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const p of polygon2D) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }

    const width = Math.max(0, maxX - minX)
    const height = Math.max(0, maxY - minY)
    if (width === 0 || height === 0) {
      return {
        effectiveSpacing: spacingMeters,
        cellArea: spacingMeters * spacingMeters,
        terrainHeights: [],
        minTerrainHeight: 0,
        maxTerrainHeight: 0,
      }
    }

    // 估算点数并在必要时自动放大网格间距，避免采样过慢
    const approxCount = Math.ceil(width / spacingMeters) * Math.ceil(height / spacingMeters)
    const effectiveSpacing =
      approxCount > maxPoints
        ? spacingMeters * Math.sqrt(approxCount / Math.max(1, maxPoints))
        : spacingMeters
    const cellArea = effectiveSpacing * effectiveSpacing

    const cartographics: Cesium.Cartographic[] = []
    for (let x = minX; x <= maxX; x += effectiveSpacing) {
      for (let y = minY; y <= maxY; y += effectiveSpacing) {
        // cell center
        const px = x + effectiveSpacing / 2
        const py = y + effectiveSpacing / 2
        if (!this.isPointInPolygon(px, py, polygon2D)) continue

        const world = Cesium.Matrix4.multiplyByPoint(
          enu,
          new Cesium.Cartesian3(px, py, 0),
          new Cesium.Cartesian3()
        )
        cartographics.push(Cesium.Cartographic.fromCartesian(world))

        if (cartographics.length >= maxPoints) {
          // 再保险：如果仍然超上限，提前截断
          break
        }
      }
      if (cartographics.length >= maxPoints) break
    }

    if (cartographics.length === 0) {
      return {
        effectiveSpacing,
        cellArea,
        terrainHeights: [],
        minTerrainHeight: 0,
        maxTerrainHeight: 0,
      }
    }

    // 采样地形高度（MostDetailed 在无地形或低级 terrainProvider 下也会退化，但仍可用）
    const updated = await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, cartographics)

    const heights: number[] = []
    let minH = Number.POSITIVE_INFINITY
    let maxH = Number.NEGATIVE_INFINITY
    for (const c of updated) {
      const h = c.height ?? 0
      heights.push(h)
      minH = Math.min(minH, h)
      maxH = Math.max(maxH, h)
    }

    return {
      effectiveSpacing,
      cellArea,
      terrainHeights: heights,
      minTerrainHeight: Number.isFinite(minH) ? minH : 0,
      maxTerrainHeight: Number.isFinite(maxH) ? maxH : 0,
    }
  }

  private isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    // Ray casting algorithm
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x
      const yi = polygon[i].y
      const xj = polygon[j].x
      const yj = polygon[j].y

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi
      if (intersect) inside = !inside
    }
    return inside
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

    // 可选：边界水墙（从地形抬到水位高度，增强“盛水”效果；纯视觉，不参与计算）
    if (this.showWaterWall) {
      const ring = [...positions, positions[0]]
      const minimumHeights = ring.map((p) => Cesium.Cartographic.fromCartesian(p).height ?? 0)
      const maximumHeights = ring.map(() => this.currentWaterLevel)

      if (!this.waterWallEntity) {
        this.waterWallEntity = this.viewer.entities.add({
          wall: {
            positions: ring,
            minimumHeights,
            maximumHeights,
            material: Cesium.Color.fromCssColorString(this.waterColor).withAlpha(
              Math.min(0.95, Math.max(0.05, this.waterWallOpacity))
            ),
          },
        })
      } else {
        // 更新既有墙体
        ;(this.waterWallEntity.wall as any).positions = ring
        ;(this.waterWallEntity.wall as any).minimumHeights = minimumHeights
        ;(this.waterWallEntity.wall as any).maximumHeights = maximumHeights
      }
    }
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

    // 3.1 自相交检测：自相交会导致面积/体积/渲染不稳定
    const intersection = this.findSelfIntersection(positionsCopy)
    if (intersection) {
      const centroid = this.calculateCentroid(positionsCopy)
      this.showTransientLabel('多边形存在自相交（例如“8”字形）。请调整顶点或重新绘制。', centroid, 4500)
      console.warn('[FloodTool] Polygon self-intersection detected:', intersection)
      // Reset drawing state so user can redraw
      this.polygonPositions = []
      this.completedPositions = []
      return
    }

    // 自动计算初始水位：取所有顶点的最小高度
    // 这样能确保画在山上的水面不会跑到地下
    const heights = positionsCopy.map(pos => {
      const carto = Cesium.Cartographic.fromCartesian(pos)
      return carto.height
    })
    
    if (heights.length > 0) {
      const minHeight = Math.min(...heights)
      const maxHeight = Math.max(...heights)
      this.vertexMinHeight = minHeight
      this.vertexMaxHeight = maxHeight
      // 如果计算出的高度比默认的大（说明是山上），则使用该高度
      // 同时也保留一定的向下容差，防止完全贴地导致 Z-fighting
      if (minHeight > this.currentWaterLevel) {
        // +1米偏移，避免与平坦地形 Z-fighting
        this.currentWaterLevel = Math.floor(minHeight) + 1
        console.log(`Auto-adjusted water level to ${this.currentWaterLevel}m based on terrain`)
      }
    }

    // 保存已完成的位置用于后续计算
    this.completedPositions = positionsCopy

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

    this.analysisResultId = gisStore.addAnalysisResult({
       type: 'flood',
       name: `淹没分析 #${gisStore.analysisResults.length + 1}`,
       data: {
         waterLevel: this.currentWaterLevel,
         floodArea: result.floodedArea,
         floodVolume: result.floodedVolume,
         mode: this.floodMode,
         tilesetUrl: this.dataSource?.tilesetUrl,
        calculationMethod: 'terrain_grid',
        calculationStatus: this.getGridStatus(),
        gridSpacingMeters: this.gridSpacingMeters,
        // 在网格采样完成前，先用顶点高程范围给 UI 一个合理的水位范围
        minTerrainHeight: this.vertexMinHeight ?? undefined,
        maxTerrainHeight: this.vertexMaxHeight ?? undefined,
       } as FloodAnalysisData,
       position: centroid,
    })

    // 异步准备地形网格采样缓存（不阻塞 UI）。完成后会自动更新该条结果。
    void this.prepareTerrainGridAsync(positionsCopy)

    // 5. 重置绘制状态，准备下一次绘制（或者保持结果显示）
    // 如果不清除 polygonPositions，handleMouseMove 会再次检测到有顶点从而重启预览
    this.polygonPositions = []
  }

  private calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    let totalX = 0
    let totalY = 0
    let totalZ = 0
    for (const pos of positions) {
      totalX += pos.x
      totalY += pos.y
      totalZ += pos.z
    }
    return new Cesium.Cartesian3(totalX / positions.length, totalY / positions.length, totalZ / positions.length)
  }

  private showTransientLabel(message: string, position: Cesium.Cartesian3, ttlMs = 3500): void {
    try {
      const entity = this.viewer.entities.add({
        position,
        label: {
          text: message,
          font: '14px "Noto Sans SC", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
          outlineWidth: 2,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.88),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      this.transientEntities.push(entity)
      window.setTimeout(() => {
        this.viewer.entities.remove(entity)
        this.transientEntities = this.transientEntities.filter((e) => e !== entity)
      }, ttlMs)
    } catch (err) {
      console.warn('[FloodTool] Failed to show transient label:', err)
    }
  }

  /**
   * Check polygon self-intersection in local ENU plane.
   * Returns first intersection pair, or null if ok.
   */
  private findSelfIntersection(
    positions: Cesium.Cartesian3[]
  ): { edgeA: [number, number]; edgeB: [number, number] } | null {
    const n = positions.length
    if (n < 4) return null

    const centroid = this.calculateCentroid(positions)
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(centroid)
    const invEnu = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())

    const pts = positions.map((p) => {
      const local = Cesium.Matrix4.multiplyByPoint(invEnu, p, new Cesium.Cartesian3())
      return { x: local.x, y: local.y }
    })

    const eps = 1e-9
    const orient = (a: any, b: any, c: any) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const onSegment = (a: any, b: any, c: any) => {
      return (
        Math.min(a.x, b.x) - eps <= c.x &&
        c.x <= Math.max(a.x, b.x) + eps &&
        Math.min(a.y, b.y) - eps <= c.y &&
        c.y <= Math.max(a.y, b.y) + eps
      )
    }
    const segIntersect = (p1: any, p2: any, q1: any, q2: any) => {
      const o1 = orient(p1, p2, q1)
      const o2 = orient(p1, p2, q2)
      const o3 = orient(q1, q2, p1)
      const o4 = orient(q1, q2, p2)

      const s1 = Math.sign(o1)
      const s2 = Math.sign(o2)
      const s3 = Math.sign(o3)
      const s4 = Math.sign(o4)

      if (s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0) {
        return s1 !== s2 && s3 !== s4
      }

      if (Math.abs(o1) <= eps && onSegment(p1, p2, q1)) return true
      if (Math.abs(o2) <= eps && onSegment(p1, p2, q2)) return true
      if (Math.abs(o3) <= eps && onSegment(q1, q2, p1)) return true
      if (Math.abs(o4) <= eps && onSegment(q1, q2, p2)) return true
      return false
    }

    const edge = (i: number) => [i, (i + 1) % n] as [number, number]

    for (let i = 0; i < n; i++) {
      const [a1, a2] = edge(i)
      const A1 = pts[a1]
      const A2 = pts[a2]

      for (let j = i + 1; j < n; j++) {
        const [b1, b2] = edge(j)

        // Skip adjacent edges and shared endpoints
        const sharesVertex = a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2
        if (sharesVertex) continue
        // Also skip first/last edge adjacency in closed polygon
        if ((a1 === 0 && a2 === 1 && b1 === n - 1 && b2 === 0) || (b1 === 0 && b2 === 1 && a1 === n - 1 && a2 === 0)) {
          continue
        }

        const B1 = pts[b1]
        const B2 = pts[b2]
        if (segIntersect(A1, A2, B1, B2)) {
          return { edgeA: [a1, a2], edgeB: [b1, b2] }
        }
      }
    }

    return null
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

    // 更新水墙高度
    if (this.waterWallEntity?.wall) {
      const positions = (this.waterWallEntity.wall.positions as any)?.getValue?.(Cesium.JulianDate.now?.())
      // 若取不到 positions（常量属性），回退读 wall.positions 本体
      const ring = (Array.isArray(positions) ? positions : (this.waterWallEntity.wall.positions as any)) as
        | Cesium.Cartesian3[]
        | undefined
      if (ring && Array.isArray(ring) && ring.length > 0) {
        ;(this.waterWallEntity.wall.maximumHeights as any) = ring.map(() => level)
      }
    }

    // 更新 Tileset 样式（如果使用 tileset 模式）
    if (this.waterTileset) {
      this.tilesetService.applyStyle(this.waterTileset, {
        color: `color('${this.waterColor}', ${this.waterOpacity})`,
        show: `\${waterLevel} <= ${level}`,
      })
    }

    // 面板/进度条要跟手：先让 Cesium 画面更新，再合并计算与 store 更新
    this.scheduleRecomputeAndStoreUpdate()
  }

  private scheduleRecomputeAndStoreUpdate(): void {
    if (this.pendingRecomputeTimer) {
      window.clearTimeout(this.pendingRecomputeTimer)
      this.pendingRecomputeTimer = null
    }

    this.pendingRecomputeTimer = window.setTimeout(() => {
      this.pendingRecomputeTimer = null

      const level = this.currentWaterLevel
      const result = this.calculateFloodResult()
      this.onWaterLevelChange?.(level, result)

      // 更新同一条分析结果（避免水位拖动时不断新增）
      if (this.analysisResultId) {
        const gisStore = useGISStore()
        gisStore.updateAnalysisResult(this.analysisResultId, {
          data: {
            waterLevel: level,
            floodArea: result.floodedArea,
            floodVolume: result.floodedVolume,
            mode: this.floodMode,
            tilesetUrl: this.dataSource?.tilesetUrl,
            calculationMethod: this.gridCache ? 'terrain_grid' : 'simple',
            calculationStatus: this.getGridStatus(),
            gridSpacingMeters: this.gridSpacingMeters,
            effectiveGridSpacingMeters: this.gridCache?.effectiveSpacing,
            sampleCount: this.gridCache?.terrainHeights.length,
            cellArea: this.gridCache?.cellArea,
            minTerrainHeight: this.gridCache?.minTerrainHeight ?? this.vertexMinHeight ?? undefined,
            maxTerrainHeight: this.gridCache?.maxTerrainHeight ?? this.vertexMaxHeight ?? undefined,
          } as FloodAnalysisData,
        })
      }
    }, 0)
  }

  public setRiseRateMps(rate: number): void {
    const next = Math.max(0.01, Math.min(20, rate))
    this.riseRateMps = next
  }

  public getRiseRateMps(): number {
    return this.riseRateMps
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
    const maxLevel = this.getWaterLevelLimits().max
    const newLevel = Math.min(this.currentWaterLevel + this.waterLevelStep, maxLevel)
    this.setWaterLevel(newLevel)
  }

  /**
   * 降低水位
   */
  public lowerWaterLevel(): void {
    const minLevel = this.getWaterLevelLimits().min
    const newLevel = Math.max(this.currentWaterLevel - this.waterLevelStep, minLevel)
    this.setWaterLevel(newLevel)
  }

  /**
   * 开始水位动画
   */
  public startAnimation(): void {
    if (this.animationTimer) return

    this.lastAnimationTs = performance.now()

    this.animationTimer = window.setInterval(() => {
      const now = performance.now()
      const dtSec = Math.max(0, (now - this.lastAnimationTs) / 1000)
      this.lastAnimationTs = now

      const { min: minLevel, max: maxLevel } = this.getWaterLevelLimits()

      const delta = this.riseRateMps * dtSec
      if (!Number.isFinite(delta) || delta <= 0) return

      if (this.animationDirection === 1) {
        if (this.currentWaterLevel >= maxLevel) {
          this.animationDirection = -1
        } else {
          this.setWaterLevel(Math.min(maxLevel, this.currentWaterLevel + delta))
        }
      } else {
        if (this.currentWaterLevel <= minLevel) {
          this.animationDirection = 1
        } else {
          this.setWaterLevel(Math.max(minLevel, this.currentWaterLevel - delta))
        }
      }
    }, this.animationTickMs)
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
    let floodedArea = 0
    let floodedVolume = 0

    // 优先使用已完成的多边形位置，其次使用绘制中的位置
    const positions = this.completedPositions.length >= 3 
      ? this.completedPositions 
      : this.polygonPositions

    if (positions.length >= 3) {
      if (this.gridCache?.status === 'ready' && this.gridCache.terrainHeights.length > 0) {
        const H = this.currentWaterLevel
        const cellArea = this.gridCache.cellArea
        let area = 0
        let volume = 0
        for (const h of this.gridCache.terrainHeights) {
          const depth = Math.max(0, H - h)
          if (depth > 0) {
            area += cellArea
            volume += depth * cellArea
          }
        }
        floodedArea = area
        floodedVolume = volume
      } else {
        // 回退：无网格缓存时用多边形面积近似（占位）
        floodedArea = this.calculatePolygonArea(positions)
        floodedVolume = floodedArea * this.currentWaterLevel
      }
    } else {
      console.warn('[FloodTool] calculateFloodResult: Not enough positions', {
        completedPositionsCount: this.completedPositions.length,
        polygonPositionsCount: this.polygonPositions.length,
      })
    }

    return {
      waterLevel: this.currentWaterLevel,
      floodedArea,
      floodedVolume,
      analyzedAt: new Date(),
    }
  }

  /**
   * 计算多边形面积（三角剖分法）
   */
  private calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    // 使用三角剖分法：以第一个点为原点，计算所有三角形面积之和
    let totalArea = 0
    const origin = positions[0]

    for (let i = 1; i < positions.length - 1; i++) {
      const p1 = positions[i]
      const p2 = positions[i + 1]

      // 计算三角形面积：使用向量叉积
      const v1 = Cesium.Cartesian3.subtract(p1, origin, new Cesium.Cartesian3())
      const v2 = Cesium.Cartesian3.subtract(p2, origin, new Cesium.Cartesian3())
      const cross = Cesium.Cartesian3.cross(v1, v2, new Cesium.Cartesian3())
      const triangleArea = Cesium.Cartesian3.magnitude(cross) / 2

      totalArea += triangleArea
    }

    return totalArea
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

    if (this.pendingRecomputeTimer) {
      window.clearTimeout(this.pendingRecomputeTimer)
      this.pendingRecomputeTimer = null
    }

    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity)
      this.waterEntity = null
    }

    if (this.waterOutlineEntity) {
      this.viewer.entities.remove(this.waterOutlineEntity)
      this.waterOutlineEntity = null
    }

    if (this.waterWallEntity) {
      this.viewer.entities.remove(this.waterWallEntity)
      this.waterWallEntity = null
    }

    if (this.waterTileset) {
      this.tilesetService.remove(this.waterTileset)
      this.waterTileset = null
    }

    if (this.transientEntities.length > 0) {
      for (const e of this.transientEntities) {
        this.viewer.entities.remove(e)
      }
      this.transientEntities = []
    }

    this.polygonPositions = []
    this.completedPositions = []
    this.analysisResultId = null
    this.cursorPosition = null
    this.currentWaterLevel = 0
    this.gridCache = null
    this.gridSamplingToken++
    this.vertexMinHeight = null
    this.vertexMaxHeight = null
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
