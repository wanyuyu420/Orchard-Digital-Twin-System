/**
 * PointGraphic - 点图形类
 *
 * 实现点标注功能，支持图标、文本标签
 * 最简单的图形类型，用于验证 Graphic 框架
 */

import * as Cesium from 'cesium'
import { BaseGraphic, type BaseGraphicOptions, type GraphicStyle } from '../core/BaseGraphic'

/**
 * 点图形配置
 */
export interface PointGraphicOptions extends BaseGraphicOptions {
  /** 点位置 */
  position?: Cesium.Cartesian3
  /** 文本标签 */
  label?: string
  /** 图标 URL（可选，使用 billboard）*/
  icon?: string
}

/**
 * 点图形类
 *
 * @example
 * ```ts
 * const point = new PointGraphic(viewer, {
 *   name: '测站A',
 *   position: Cesium.Cartesian3.fromDegrees(114.3, 30.5, 100),
 *   label: '水位站',
 *   style: {
 *     pointColor: '#22D3EE',
 *     pointSize: 12
 *   }
 * })
 * point.create([position])
 * ```
 */
export class PointGraphic extends BaseGraphic {
  /** 文本标签内容 */
  private labelText?: string

  /** 图标 URL */
  private iconUrl?: string

  /** 主点实体 */
  private pointEntity?: Cesium.Entity

  /** 默认样式 */
  private static readonly DEFAULT_STYLE: Required<GraphicStyle> = {
    fillColor: '#3B82F6',
    fillOpacity: 1.0,
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
    pointSize: 10,
    pointColor: '#22D3EE',
    opacity: 1.0,
  }

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: PointGraphicOptions = {}) {
    super(viewer, { ...options, type: 'point' })
    this.labelText = options.label
    this.iconUrl = options.icon

    // 如果提供了初始位置，立即创建
    if (options.position) {
      this.create([options.position])
    }
  }

  /**
   * 创建点图形
   * @param positions - 点位置数组（只使用第一个元素）
   */
  public create(positions: Cesium.Cartesian3[]): void {
    if (positions.length === 0) {
      console.warn('PointGraphic.create: No positions provided')
      return
    }

    // 清除旧的实体
    this.remove()

    const position = positions[0]
    const style = { ...PointGraphic.DEFAULT_STYLE, ...this.style }

    // 创建点实体配置
    const entityOptions: Cesium.Entity.ConstructorOptions = {
      id: `${this.id}_point`,
      position,
      show: this.visible,
    }

    // 如果有图标，使用 billboard
    if (this.iconUrl) {
      entityOptions.billboard = {
        image: this.iconUrl,
        width: style.pointSize * 2,
        height: style.pointSize * 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    } else {
      // 否则使用简单的点
      entityOptions.point = {
        pixelSize: style.pointSize,
        color: Cesium.Color.fromCssColorString(style.pointColor).withAlpha(style.opacity),
        outlineColor: Cesium.Color.fromCssColorString(style.strokeColor),
        outlineWidth: style.strokeWidth,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    }

    // 如果有标签文本，添加 label
    if (this.labelText) {
      entityOptions.label = {
        text: this.labelText,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -style.pointSize - 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    }

    // 添加实体到场景
    this.pointEntity = this.viewer.entities.add(entityOptions)
    this.entities.push(this.pointEntity)
  }

  /**
   * 开始编辑模式
   * 点图形的编辑：拖拽移动位置
   */
  public startEdit(): void {
    if (!this.editable || this.editing || !this.pointEntity) {
      return
    }

    this.editing = true

    // TODO: 实现拖拽编辑功能
    // 需要监听鼠标事件，允许拖拽点的位置
    console.log('PointGraphic.startEdit: Edit mode enabled (drag to move - to be implemented)')
  }

  /**
   * 停止编辑模式
   */
  public stopEdit(): void {
    if (!this.editing) return

    this.editing = false

    // TODO: 移除拖拽事件监听
    console.log('PointGraphic.stopEdit: Edit mode disabled')
  }

  /**
   * 导出为 GeoJSON 格式
   */
  public toGeoJSON(): any {
    if (!this.pointEntity || !this.pointEntity.position) {
      return null
    }

    const position = this.pointEntity.position.getValue(Cesium.JulianDate.now())
    if (!position) return null

    const cartographic = Cesium.Cartographic.fromCartesian(position)

    return {
      type: 'Feature',
      id: this.id,
      geometry: {
        type: 'Point',
        coordinates: [
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude),
          cartographic.height,
        ],
      },
      properties: {
        name: this.name,
        label: this.labelText,
        icon: this.iconUrl,
        style: this.style,
        createdAt: this.createdAt.toISOString(),
        ...this.properties,
      },
    }
  }

  /**
   * 更新点位置
   * @param position - 新位置
   */
  public updatePosition(position: Cesium.Cartesian3): void {
    if (!this.pointEntity) return

    this.pointEntity.position = new Cesium.ConstantPositionProperty(position)
  }

  /**
   * 更新标签文本
   * @param text - 新文本
   */
  public updateLabel(text: string): void {
    this.labelText = text

    if (this.pointEntity && this.pointEntity.label) {
      this.pointEntity.label.text = new Cesium.ConstantProperty(text)
    }
  }

  /**
   * 获取点位置
   */
  public getPosition(): Cesium.Cartesian3 | null {
    if (!this.pointEntity || !this.pointEntity.position) return null

    return this.pointEntity.position.getValue(Cesium.JulianDate.now()) || null
  }

  /**
   * 获取图形中心点（对于点图形，就是点本身的位置）
   */
  public getCenter(): Cesium.Cartesian3 {
    const position = this.getPosition()
    if (!position) {
      throw new Error('PointGraphic has no position')
    }
    return position
  }

  /**
   * 获取地理坐标
   */
  public getCoordinate(): { longitude: number; latitude: number; height: number } | null {
    const position = this.getPosition()
    if (!position) return null

    const cartographic = Cesium.Cartographic.fromCartesian(position)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }
  }

  /**
   * 获取所有顶点位置（点图形只有一个顶点）
   */
  public getPositions(): Cesium.Cartesian3[] | null {
    const position = this.getPosition()
    return position ? [position] : null
  }

  /**
   * 移动图形
   * @param offset - 偏移向量
   */
  public move(offset: Cesium.Cartesian3): void {
    const currentPosition = this.getPosition()
    if (!currentPosition) return

    const newPosition = Cesium.Cartesian3.add(currentPosition, offset, new Cesium.Cartesian3())
    this.updatePosition(newPosition)
  }

  /**
   * 应用样式到实体
   * 覆盖基类方法以支持高亮效果
   */
  protected applyStyle(): void {
    if (this.pointEntity && this.pointEntity.point) {
      const pointColor = Cesium.Color.fromCssColorString(this.style.pointColor || '#22D3EE')
      this.pointEntity.point.pixelSize = new Cesium.ConstantProperty(this.style.pointSize || 8)
      this.pointEntity.point.color = new Cesium.ConstantProperty(pointColor)
    }
  }
}
