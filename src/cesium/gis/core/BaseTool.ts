/**
 * BaseTool - 工具基类
 *
 * 参考 OpenLayers Interaction 模式设计的统一工具抽象层
 * 所有交互工具（绘制、选择、编辑、测量等）都应继承此基类
 *
 * 设计理念：
 * - 统一的生命周期管理（activate/deactivate）
 * - 统一的事件处理机制
 * - 子类只需实现具体的业务逻辑
 */

import * as Cesium from 'cesium'

export type ToolMode = 'ready' | 'active' | 'end'
export type ToolType =
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'draw-circle'
  | 'draw-rectangle'
  | 'measure-distance'
  | 'measure-area'
  | 'measure-3d'
  | 'volume' // 方量分析
  | 'flood' // 淹没分析
  | 'profile' // 剖面分析
  | 'measure3d' // 3D测量
  | 'select'
  | 'modify'
  | 'custom'

/**
 * 工具配置选项
 */
export interface BaseToolOptions {
  /** 工具类型 */
  type?: ToolType
  /** 是否启用捕捉 */
  snapEnabled?: boolean
  /** 是否显示提示 */
  showTips?: boolean
  /** 是否需要地形 */
  requiresTerrain?: boolean
}

/**
 * 工具基类
 *
 * @abstract
 * @example
 * ```ts
 * class MyTool extends BaseTool {
 *   protected setupEventHandlers(): void {
 *     this.handler.setInputAction(
 *       (click) => this.handleClick(click.position),
 *       Cesium.ScreenSpaceEventType.LEFT_CLICK
 *     )
 *   }
 *
 *   protected removeEventHandlers(): void {
 *     this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
 *   }
 *
 *   protected handleClick(position: Cesium.Cartesian2): void {
 *     // 处理点击事件
 *   }
 * }
 * ```
 */
export abstract class BaseTool {
  /** Cesium Viewer 实例 */
  protected viewer: Cesium.Viewer

  /** 事件处理器 */
  protected handler: Cesium.ScreenSpaceEventHandler

  /** 工具模式 */
  protected mode: ToolMode = 'ready'

  /** 是否激活 */
  protected active: boolean = false

  /** 工具类型 */
  protected toolType: ToolType

  /** 工具配置 */
  protected options: BaseToolOptions

  /** 当前鼠标位置（用于实时预览） */
  protected currentCursorPosition: Cesium.Cartesian3 | null = null

  /**
   * 构造函数
   * @param viewer - Cesium Viewer 实例
   * @param options - 工具配置
   */
  constructor(viewer: Cesium.Viewer, options: BaseToolOptions = {}) {
    this.viewer = viewer
    this.options = {
      snapEnabled: false,
      showTips: true,
      requiresTerrain: false,
      ...options,
    }
    this.toolType = options.type || 'custom'
    this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  }

  /**
   * 激活工具
   * 开始监听用户交互事件
   * @returns 是否成功激活
   */
  public activate(): boolean {
    if (this.active) {
      console.warn(`Tool ${this.toolType} is already active`)
      return true
    }

    // 检查地形要求
    if (this.options.requiresTerrain) {
      const isEllipsoid = this.viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider
      if (isEllipsoid) {
        // 使用原生 confirm 或 alert
        // 这里只是简单的提醒，无法直接帮用户开启地形（因为BaseTool不持有Store或UI控制器）
        window.alert('该工具需要开启地形才能使用，请先在图层控制中开启地形。')
        // 也可以使用 confirm 让用户确认
        // if (!window.confirm('该工具建议在地形开启状态下使用，是否继续？')) { return false }
        
        // 需求：提醒必须开启（取消选择）或推荐开启（不取消）
        // 这里实现：强制要求开启 -> 取消工具选择
        return false
      }
    }

    this.active = true
    this.mode = 'active'
    this.setupEventHandlers()
    this.onActivate()
    
    return true
  }

  /**
   * 停用工具
   * 停止监听用户交互事件，清理资源
   */
  public deactivate(): void {
    if (!this.active) {
      return
    }

    this.active = false
    this.mode = 'end'
    this.removeEventHandlers()
    this.onDeactivate()
  }

  /**
   * 销毁工具
   * 释放所有资源
   */
  public destroy(): void {
    this.deactivate()
    this.handler.destroy()
    this.onDestroy()
  }

  /**
   * 获取工具是否激活
   */
  public isActive(): boolean {
    return this.active
  }

  /**
   * 获取工具类型
   */
  public getType(): ToolType {
    return this.toolType
  }

  /**
   * 获取工具模式
   */
  public getMode(): ToolMode {
    return this.mode
  }

  /**
   * 动态更新样式（无需重新激活工具）
   * 子类可覆盖以实现具体逻辑
   * @param _newStyle - 新的样式配置
   */
  public updateStyle(_newStyle: Record<string, any>): void {
    // 默认实现：子类可覆盖
  }

  // ========== 抽象方法 - 子类必须实现 ==========

  /**
   * 设置事件处理器
   * 子类实现具体的交互逻辑
   *
   * @abstract
   * @example
   * ```ts
   * protected setupEventHandlers(): void {
   *   this.handler.setInputAction(
   *     (click) => this.handleClick(click.position),
   *     Cesium.ScreenSpaceEventType.LEFT_CLICK
   *   )
   *   this.handler.setInputAction(
   *     (movement) => this.handleMouseMove(movement.endPosition),
   *     Cesium.ScreenSpaceEventType.MOUSE_MOVE
   *   )
   * }
   * ```
   */
  protected abstract setupEventHandlers(): void

  /**
   * 移除事件处理器
   * 清理所有监听的事件
   *
   * @abstract
   * @example
   * ```ts
   * protected removeEventHandlers(): void {
   *   this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
   *   this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
   * }
   * ```
   */
  protected abstract removeEventHandlers(): void

  // ========== 公共工具方法 ==========

  /**
   * 拾取屏幕坐标对应的世界坐标
   * 优先拾取地形，其次拾取椭球面
   *
   * @param screenPosition - 屏幕坐标
   * @returns 世界坐标（Cartesian3），如果拾取失败返回 null
   */
  protected pickPosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    // 0. 优先尝试使用 scene.pickPosition (支持 3D Tiles 和地形)
    // 注意：scene.pickPosition 需要深度缓冲区支持，且在某些视角下可能不稳定
    if (this.viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
      try {
        const cartesian = this.viewer.scene.pickPosition(screenPosition);
        if (cartesian) {
          return cartesian;
        }
      } catch (e) {
        // 忽略 pickPosition 可能抛出的错误（如深度缓冲区未就绪）
      }
    }

    // 1. 尝试拾取地形 (后备方案)
    const ray = this.viewer.camera.getPickRay(screenPosition)
    if (ray) {
      const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene)
      if (cartesian) {
        return cartesian
      }
    }

    // 2. 拾取椭球面 (最后兜底)
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    return this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid) || null
  }

  /**
   * 拾取屏幕坐标对应的实体（Entity）
   *
   * @param screenPosition - 屏幕坐标
   * @returns 拾取到的对象，如果未拾取到返回 undefined
   */
  protected pickEntity(screenPosition: Cesium.Cartesian2): Cesium.Entity | undefined {
    const pickedObject = this.viewer.scene.pick(screenPosition)
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      return pickedObject.id
    }
    return undefined
  }

  /**
   * 设置鼠标样式
   * @param cursor - CSS cursor 值
   */
  protected setCursor(cursor: string): void {
    this.viewer.canvas.style.cursor = cursor
  }

  /**
   * 重置鼠标样式
   */
  protected resetCursor(): void {
    this.viewer.canvas.style.cursor = 'default'
  }

  // ========== 生命周期钩子 - 子类可选择性覆盖 ==========

  /**
   * 激活时的钩子函数
   * 子类可覆盖以执行自定义逻辑
   */
  protected onActivate(): void {
    // 子类可选实现
  }

  /**
   * 停用时的钩子函数
   * 子类可覆盖以执行自定义逻辑
   */
  protected onDeactivate(): void {
    // 子类可选实现
  }

  /**
   * 销毁时的钩子函数
   * 子类可覆盖以执行自定义逻辑
   */
  protected onDestroy(): void {
    // 子类可选实现
  }
}
