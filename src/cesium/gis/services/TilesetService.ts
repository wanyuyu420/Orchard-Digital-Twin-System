/**
 * TilesetService - 3D Tiles 加载和管理服务
 *
 * 提供统一的 3D Tiles 加载、样式、交互接口
 * 支持本地 tileset.json 和 Cesium Ion 资产
 *
 * 使用场景：
 * - 洪水水面 3D Tiles
 * - BIM 建筑模型
 * - 倾斜摄影数据
 */

import * as Cesium from 'cesium'

/**
 * Tileset 加载选项
 */
export interface TilesetLoadOptions {
  /** 最大屏幕空间误差（越小越精细，默认16） */
  maximumScreenSpaceError?: number
  /** 最大内存使用 MB（默认512） */
  maximumMemoryUsage?: number
  /** 是否启用动态屏幕空间误差 */
  dynamicScreenSpaceError?: boolean
  /** 是否跳过细节级别 */
  skipLevelOfDetail?: boolean
  /** 模型矩阵（用于位置调整） */
  modelMatrix?: Cesium.Matrix4
  /** 初始样式 */
  style?: Cesium.Cesium3DTileStyle
  /** 是否显示 */
  show?: boolean
}

/**
 * Tileset 样式配置
 */
export interface TilesetStyleConfig {
  /** 颜色表达式或条件 */
  color?: string | { conditions: [string, string][] }
  /** 显示条件 */
  show?: string | boolean
  /** 点大小（点云） */
  pointSize?: string | number
}

/**
 * 已加载的 Tileset 信息
 */
export interface LoadedTileset {
  id: string
  tileset: Cesium.Cesium3DTileset
  url: string
  loadedAt: Date
}

/**
 * 3D Tiles 加载和管理服务
 */
export class TilesetService {
  private viewer: Cesium.Viewer
  private loadedTilesets: Map<string, LoadedTileset> = new Map()

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
  }

  /**
   * 从 URL 加载 3D Tileset
   *
   * @param url - tileset.json 的 URL
   * @param options - 加载选项
   * @returns 加载的 Tileset
   *
   * @example
   * ```ts
   * const tileset = await tilesetService.loadFromUrl('/mock/flood/tileset.json', {
   *   maximumScreenSpaceError: 8,
   *   style: new Cesium.Cesium3DTileStyle({ color: "color('blue', 0.5)" })
   * })
   * ```
   */
  async loadFromUrl(url: string, options: TilesetLoadOptions = {}): Promise<Cesium.Cesium3DTileset> {
    const id = this.generateId(url)

    // 检查是否已加载
    const existing = this.loadedTilesets.get(id)
    if (existing) {
      console.log(`Tileset already loaded: ${id}`)
      return existing.tileset
    }

    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
        maximumScreenSpaceError: options.maximumScreenSpaceError ?? 16,
        dynamicScreenSpaceError: options.dynamicScreenSpaceError ?? true,
        skipLevelOfDetail: options.skipLevelOfDetail ?? true,
        cullWithChildrenBounds: true,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 16,
        skipLevels: 1,
        immediatelyLoadDesiredLevelOfDetail: false,
        loadSiblings: false
      })

      // 应用模型矩阵
      if (options.modelMatrix) {
        tileset.modelMatrix = options.modelMatrix
      }

      // 应用样式
      if (options.style) {
        tileset.style = options.style
      }

      // 设置显示状态
      if (options.show !== undefined) {
        tileset.show = options.show
      }

      // 添加到场景
      this.viewer.scene.primitives.add(tileset)

      // 记录
      this.loadedTilesets.set(id, {
        id,
        tileset,
        url,
        loadedAt: new Date()
      })

      console.log(`✓ Tileset loaded: ${url}`)
      return tileset

    } catch (error) {
      console.error(`Failed to load tileset from ${url}:`, error)
      throw error
    }
  }

  /**
   * 从 Cesium Ion 资产 ID 加载
   *
   * @param assetId - Ion 资产 ID
   * @param options - 加载选项
   */
  async loadFromIon(assetId: number, options: TilesetLoadOptions = {}): Promise<Cesium.Cesium3DTileset> {
    const id = `ion_${assetId}`

    const existing = this.loadedTilesets.get(id)
    if (existing) {
      return existing.tileset
    }

    try {
      const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(assetId, {
        maximumScreenSpaceError: options.maximumScreenSpaceError ?? 16
      })

      if (options.modelMatrix) {
        tileset.modelMatrix = options.modelMatrix
      }

      if (options.style) {
        tileset.style = options.style
      }

      this.viewer.scene.primitives.add(tileset)

      this.loadedTilesets.set(id, {
        id,
        tileset,
        url: `ion://${assetId}`,
        loadedAt: new Date()
      })

      console.log(`✓ Ion tileset loaded: ${assetId}`)
      return tileset

    } catch (error) {
      console.error(`Failed to load Ion asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * 应用样式到 Tileset
   */
  applyStyle(tileset: Cesium.Cesium3DTileset, config: TilesetStyleConfig): void {
    const styleOptions: any = {}

    if (config.color) {
      styleOptions.color = config.color
    }

    if (config.show !== undefined) {
      styleOptions.show = config.show
    }

    if (config.pointSize !== undefined) {
      styleOptions.pointSize = config.pointSize
    }

    tileset.style = new Cesium.Cesium3DTileStyle(styleOptions)
  }

  /**
   * 创建洪水水面样式
   *
   * @param waterLevel - 当前水位
   * @param opacity - 透明度 (0-1)
   */
  createFloodStyle(waterLevel: number, opacity: number = 0.6): Cesium.Cesium3DTileStyle {
    return new Cesium.Cesium3DTileStyle({
      color: `color('rgba(30, 144, 255, ${opacity})')`,  // 道奇蓝
      show: `\${waterLevel} <= ${waterLevel}`
    })
  }

  /**
   * 飞行到 Tileset
   */
  async flyTo(tileset: Cesium.Cesium3DTileset, options?: {
    duration?: number
    heading?: number
    pitch?: number
    range?: number
  }): Promise<void> {
    const boundingSphere = tileset.boundingSphere
    const radius = boundingSphere.radius

    await this.viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: options?.duration ?? 2,
      offset: new Cesium.HeadingPitchRange(
        options?.heading ?? 0,
        options?.pitch ?? -0.5,
        options?.range ?? radius * 2.5
      )
    })
  }

  /**
   * 调整 Tileset 高度
   *
   * @param tileset - 目标 Tileset
   * @param heightOffset - 高度偏移（米）
   */
  adjustHeight(tileset: Cesium.Cesium3DTileset, heightOffset: number): void {
    const cartographic = Cesium.Cartographic.fromCartesian(
      tileset.boundingSphere.center
    )

    const surface = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      0.0
    )

    const offset = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      heightOffset
    )

    const translation = Cesium.Cartesian3.subtract(
      offset,
      surface,
      new Cesium.Cartesian3()
    )

    tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation)
  }

  /**
   * 设置 Tileset 显示/隐藏
   */
  setVisible(tilesetOrId: Cesium.Cesium3DTileset | string, visible: boolean): void {
    const tileset = typeof tilesetOrId === 'string'
      ? this.loadedTilesets.get(tilesetOrId)?.tileset
      : tilesetOrId

    if (tileset) {
      tileset.show = visible
    }
  }

  /**
   * 移除 Tileset
   */
  remove(tilesetOrId: Cesium.Cesium3DTileset | string): void {
    let id: string | undefined
    let tileset: Cesium.Cesium3DTileset | undefined

    if (typeof tilesetOrId === 'string') {
      id = tilesetOrId
      const loaded = this.loadedTilesets.get(id)
      if (!loaded) return
      tileset = loaded.tileset
    } else {
      tileset = tilesetOrId
      // 查找 ID
      for (const [key, value] of this.loadedTilesets.entries()) {
        if (value.tileset === tileset) {
          id = key
          break
        }
      }
    }

    if (tileset) {
      this.viewer.scene.primitives.remove(tileset)
    }
    if (id) {
      this.loadedTilesets.delete(id)
      console.log(`Tileset removed: ${id}`)
    }
  }

  /**
   * 移除所有 Tileset
   */
  removeAll(): void {
    for (const [, loaded] of this.loadedTilesets.entries()) {
      this.viewer.scene.primitives.remove(loaded.tileset)
    }
    this.loadedTilesets.clear()
    console.log('All tilesets removed')
  }

  /**
   * 获取已加载的 Tileset
   */
  get(id: string): Cesium.Cesium3DTileset | undefined {
    return this.loadedTilesets.get(id)?.tileset
  }

  /**
   * 获取所有已加载的 Tileset
   */
  getAll(): LoadedTileset[] {
    return Array.from(this.loadedTilesets.values())
  }

  /**
   * 生成 Tileset ID
   */
  private generateId(url: string): string {
    // 简单哈希
    return `tileset_${url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.removeAll()
  }
}

/**
 * 创建 TilesetService 实例的工厂函数
 */
export function createTilesetService(viewer: Cesium.Viewer): TilesetService {
  return new TilesetService(viewer)
}
