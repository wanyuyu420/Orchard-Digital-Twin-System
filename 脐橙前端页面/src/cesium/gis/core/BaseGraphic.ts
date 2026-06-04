/**
 * BaseGraphic - 图形基类
 *
 * 参考 cesium-draw 设计的统一图形抽象层
 * 所有几何图形（点、线、面、圆、矩形等）都应继承此基类
 *
 * 设计理念：
 * - 统一的图形生命周期管理（create/remove/show/hide）
 * - 统一的样式配置接口
 * - 统一的编辑能力（顶点编辑）
 * - 统一的数据导出（toGeoJSON）
 */

import * as Cesium from 'cesium'

export type GraphicType =
  | 'point'
  | 'line'
  | 'polygon'
  | 'circle'
  | 'rectangle'
  | 'polyline'
  | 'custom'

/**
 * 图形样式配置
 */
export interface GraphicStyle {
  /** 填充颜色（CSS颜色字符串）*/
  fillColor?: string
  /** 填充透明度 (0-1) */
  fillOpacity?: number
  /** 描边颜色 */
  strokeColor?: string
  /** 描边宽度（像素）*/
  strokeWidth?: number
  /** 点大小（像素）*/
  pointSize?: number
  /** 点颜色 */
  pointColor?: string
  /** 整体透明度 (0-1) */
  opacity?: number
}

/**
 * 图形配置选项
 */
export interface BaseGraphicOptions {
  /** 图形ID（自动生成或手动指定）*/
  id?: string
  /** 图形名称 */
  name?: string
  /** 图形类型 */
  type?: GraphicType
  /** 样式配置 */
  style?: GraphicStyle
  /** 是否可编辑 */
  editable?: boolean
  /** 是否显示 */
  visible?: boolean
  /** 自定义属性 */
  properties?: Record<string, any>
}

/**
 * 图形基类
 *
 * @abstract
 * @example
 * ```ts
 * class PointGraphic extends BaseGraphic {
 *   create(positions: Cesium.Cartesian3[]): void {
 *     const entity = this.viewer.entities.add({
 *       position: positions[0],
 *       point: {
 *         pixelSize: this.style.pointSize || 10,
 *         color: Cesium.Color.fromCssColorString(this.style.pointColor || '#FF0000')
 *       }
 *     })
 *     this.entities.push(entity)
 *   }
 *
 *   toGeoJSON(): any {
 *     const position = this.entities[0].position.getValue(Cesium.JulianDate.now())
 *     const cartographic = Cesium.Cartographic.fromCartesian(position)
 *     return {
 *       type: 'Feature',
 *       geometry: {
 *         type: 'Point',
 *         coordinates: [
 *           Cesium.Math.toDegrees(cartographic.longitude),
 *           Cesium.Math.toDegrees(cartographic.latitude),
 *           cartographic.height
 *         ]
 *       },
 *       properties: this.properties
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseGraphic {
  /** Cesium Viewer 实例 */
  protected viewer: Cesium.Viewer

  /** 图形包含的所有实体 */
  protected entities: Cesium.Entity[] = []

  /** 图形唯一标识 */
  public readonly id: string

  /** 图形名称 */
  public name: string

  /** 图形类型 */
  public readonly type: GraphicType

  /** 图形样式 */
  public style: GraphicStyle

  /** 是否可编辑 */
  public editable: boolean

  /** 是否可见 */
  public visible: boolean

  /** 自定义属性 */
  public properties: Record<string, any>

  /** 是否处于编辑状态 */
  protected editing: boolean = false

  /** 是否高亮显示 */
  protected highlighted: boolean = false

  /** 原始样式（用于高亮恢复） */
  protected originalStyle: GraphicStyle | null = null

  /** 关联的 Feature ID（用于选择功能） */
  public featureId: string | null = null

  /** 创建时间 */
  public readonly createdAt: Date

  /**
   * 构造函数
   * @param viewer - Cesium Viewer 实例
   * @param options - 图形配置
   */
  constructor(viewer: Cesium.Viewer, options: BaseGraphicOptions = {}) {
    this.viewer = viewer
    this.id = options.id || this.generateId()
    this.name = options.name || `Graphic_${this.id.slice(-6)}`
    this.type = options.type || 'custom'
    this.style = this.normalizeStyle(options.style || {})
    this.editable = options.editable !== false
    this.visible = options.visible !== false
    this.properties = options.properties || {}
    this.createdAt = new Date()
  }

  // ========== 抽象方法 - 子类必须实现 ==========

  /**
   * 创建图形
   * 子类实现具体的图形创建逻辑
   *
   * @abstract
   * @param positions - 图形位置数组
   */
  public abstract create(positions: Cesium.Cartesian3[]): void

  /**
   * 开始编辑
   * 子类实现编辑模式的启动逻辑（显示顶点、添加拖拽交互等）
   *
   * @abstract
   */
  public abstract startEdit(): void

  /**
   * 停止编辑
   * 子类实现编辑模式的停止逻辑
   *
   * @abstract
   */
  public abstract stopEdit(): void

  /**
   * 导出为GeoJSON格式
   * 子类实现具体的GeoJSON转换逻辑
   *
   * @abstract
   * @returns GeoJSON Feature对象
   */
  public abstract toGeoJSON(): any

  /**
   * 获取图形中心点
   * 子类实现获取几何中心的逻辑
   *
   * @abstract
   * @returns 中心点位置（Cartesian3）
   */
  public abstract getCenter(): Cesium.Cartesian3

  /**
   * 移动图形
   * 子类实现具体的移动逻辑（更新所有顶点位置）
   *
   * @abstract
   * @param offset - 偏移向量（Cartesian3）
   */
  public abstract move(offset: Cesium.Cartesian3): void

  /**
   * 获取所有顶点位置
   * 子类实现获取顶点坐标的逻辑
   *
   * @abstract
   * @returns 顶点位置数组
   */
  public abstract getPositions(): Cesium.Cartesian3[] | null

  // ========== 公共方法 ==========

  /**
   * 移除图形
   * 从场景中删除所有相关实体
   */
  public remove(): void {
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity)
    })
    this.entities = []
  }

  /**
   * 显示图形
   */
  public show(): void {
    this.visible = true
    this.entities.forEach((entity) => {
      entity.show = true
    })
  }

  /**
   * 隐藏图形
   */
  public hide(): void {
    this.visible = false
    this.entities.forEach((entity) => {
      entity.show = false
    })
  }

  /**
   * 更新样式
   * @param newStyle - 新样式（部分更新）
   */
  public updateStyle(newStyle: Partial<GraphicStyle>): void {
    this.style = {
      ...this.style,
      ...newStyle,
    }
    this.applyStyle()
  }

  /**
   * 获取所有实体
   */
  public getEntities(): Cesium.Entity[] {
    return this.entities
  }

  /**
   * 获取主实体（通常是第一个）
   */
  public getMainEntity(): Cesium.Entity | undefined {
    return this.entities[0]
  }

  /**
   * 检查是否处于编辑状态
   */
  public isEditing(): boolean {
    return this.editing
  }

  /**
   * 检查是否高亮显示
   */
  public isHighlighted(): boolean {
    return this.highlighted
  }

  /**
   * 设置高亮状态
   * @param enabled - 是否启用高亮
   */
  public setHighlight(enabled: boolean): void {
    if (this.highlighted === enabled) return

    if (enabled) {
      // 保存原始样式
      if (!this.originalStyle) {
        this.originalStyle = { ...this.style }
      }

      // 应用高亮样式
      this.style = {
        ...this.style,
        strokeColor: '#FFD700', // 金色边框
        strokeWidth: (this.style.strokeWidth || 2) + 2,
        fillOpacity: Math.min((this.style.fillOpacity || 0.3) + 0.2, 0.8),
        pointColor: '#FFD700',
        pointSize: (this.style.pointSize || 8) + 4,
      }
      this.highlighted = true
    } else {
      // 恢复原始样式
      if (this.originalStyle) {
        this.style = { ...this.originalStyle }
        this.originalStyle = null
      }
      this.highlighted = false
    }

    // 应用样式更新到实体
    this.applyStyle()
  }

  /**
   * 将 featureId 绑定到所有实体
   * 用于 scene.pick 后识别实体属于哪个 Feature
   */
  public bindFeatureId(featureId: string): void {
    this.featureId = featureId
    this.entities.forEach((entity) => {
      if (!entity.properties) {
        entity.properties = new Cesium.PropertyBag()
      }
      entity.properties.addProperty('featureId', featureId)
    })
  }

  /**
   * 销毁图形
   * 移除所有实体并清理资源
   */
  public destroy(): void {
    this.stopEdit()
    this.remove()
    this.onDestroy()
  }

  // ========== 工具方法 ==========

  /**
   * 生成唯一ID
   * @returns UUID格式的字符串
   */
  protected generateId(): string {
    return `gis_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * 规范化样式配置
   * 填充默认值
   */
  protected normalizeStyle(style: GraphicStyle): GraphicStyle {
    return {
      fillColor: style.fillColor || 'rgba(255, 255, 255, 0.3)',
      fillOpacity: style.fillOpacity ?? 0.3,
      strokeColor: style.strokeColor || '#FFFFFF',
      strokeWidth: style.strokeWidth || 2,
      pointSize: style.pointSize || 8,
      pointColor: style.pointColor || '#22D3EE',
      opacity: style.opacity ?? 1.0,
      ...style,
    }
  }

  /**
   * 将CSS颜色字符串转换为Cesium.Color
   * @param cssColor - CSS颜色字符串
   * @param alpha - 透明度（可选）
   */
  protected cssColorToCesiumColor(cssColor: string, alpha?: number): Cesium.Color {
    try {
      const color = Cesium.Color.fromCssColorString(cssColor)
      if (alpha !== undefined) {
        return color.withAlpha(alpha)
      }
      return color
    } catch (e) {
      console.warn(`Invalid CSS color: ${cssColor}, using white as fallback`)
      return Cesium.Color.WHITE.withAlpha(alpha || 1.0)
    }
  }

  /**
   * 应用样式到实体
   * 子类可覆盖此方法以实现自定义样式应用逻辑
   */
  protected applyStyle(): void {
    // 子类可选实现
    // 默认不做任何事，子类根据需要覆盖
  }

  /**
   * 销毁时的钩子函数
   * 子类可覆盖以执行自定义清理逻辑
   */
  protected onDestroy(): void {
    // 子类可选实现
  }
}
