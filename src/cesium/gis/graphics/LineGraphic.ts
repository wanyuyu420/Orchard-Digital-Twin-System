/**
 * LineGraphic - 线图形类
 *
 * 实现折线/路径绘制功能，支持长度计算、样式配置
 * 参考 MeasureTool 的距离测量实现
 */

import * as Cesium from 'cesium'
import { BaseGraphic, type BaseGraphicOptions, type GraphicStyle } from '../core/BaseGraphic'

/**
 * 线图形配置
 */
export interface LineGraphicOptions extends BaseGraphicOptions {
  /** 是否显示长度标签 */
  showLength?: boolean
  /** 线型：solid | dashed | dotted */
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

/**
 * 线图形类
 *
 * @example
 * ```ts
 * const line = new LineGraphic(viewer, {
 *   name: '道路',
 *   showLength: true,
 *   style: {
 *     strokeColor: '#22D3EE',
 *     strokeWidth: 3
 *   }
 * })
 * line.create([position1, position2, position3])
 * ```
 */
export class LineGraphic extends BaseGraphic {
  /** 是否显示长度标签 */
  private showLength: boolean

  /** 线型 */
  private lineStyle: 'solid' | 'dashed' | 'dotted'

  /** 线实体 */
  private lineEntity?: Cesium.Entity

  /** 标签实体 */
  private labelEntity?: Cesium.Entity

  /** 顶点标记实体 */
  private vertexMarkers: Cesium.Entity[] = []

  /** 当前总长度（米）*/
  private totalLength: number = 0

  /** 默认样式 */
  private static readonly DEFAULT_STYLE: Required<GraphicStyle> = {
    fillColor: '#3B82F6',
    fillOpacity: 1.0,
    strokeColor: '#22D3EE',
    strokeWidth: 3,
    pointSize: 8,
    pointColor: '#FFFFFF',
    opacity: 1.0,
  }

  /**
   * 构造函数
   */
  constructor(viewer: Cesium.Viewer, options: LineGraphicOptions = {}) {
    super(viewer, { ...options, type: 'line' })
    this.showLength = options.showLength !== false
    this.lineStyle = options.lineStyle || 'solid'
  }

  /**
   * 创建线图形
   * @param positions - 线的顶点位置数组（至少2个点）
   */
  public create(positions: Cesium.Cartesian3[]): void {
    if (positions.length < 2) {
      console.warn('LineGraphic.create: At least 2 positions required')
      return
    }

    // 清除旧的实体
    this.remove()

    const style = { ...LineGraphic.DEFAULT_STYLE, ...this.style }

    // 计算总长度
    this.totalLength = this.calculateLength(positions)

    // 创建线实体
    this.createLineEntity(positions, style)

    // 创建标签（如果需要）
    if (this.showLength && this.totalLength > 0) {
      this.createLengthLabel(positions, style)
    }
  }

  /**
   * 创建线实体
   */
  private createLineEntity(positions: Cesium.Cartesian3[], style: Required<GraphicStyle>): void {
    const material = this.createLineMaterial(style)

    this.lineEntity = this.viewer.entities.add({
      id: `${this.id}_line`,
      polyline: {
        positions,
        width: style.strokeWidth,
        material,
        clampToGround: true, // Enable terrain clamping
        show: this.visible,
      },
    })

    this.entities.push(this.lineEntity)
  }

  /**
   * 创建线材质（支持虚线、点线）
   */
  private createLineMaterial(style: Required<GraphicStyle>): Cesium.MaterialProperty {
    const color = Cesium.Color.fromCssColorString(style.strokeColor).withAlpha(style.opacity)

    switch (this.lineStyle) {
      case 'dashed':
        return new Cesium.PolylineDashMaterialProperty({
          color,
          dashLength: 16,
        })
      case 'dotted':
        return new Cesium.PolylineDashMaterialProperty({
          color,
          dashLength: 4,
          gapColor: Cesium.Color.TRANSPARENT,
        })
      case 'solid':
      default:
        return new Cesium.ColorMaterialProperty(color)
    }
  }

  /**
   * 创建长度标签
   */
  private createLengthLabel(positions: Cesium.Cartesian3[], _style: Required<GraphicStyle>): void {
    // 标签位置：线段中点
    const midIndex = Math.floor(positions.length / 2)
    const labelPosition = positions[midIndex]

    this.labelEntity = this.viewer.entities.add({
      id: `${this.id}_label`,
      position: labelPosition,
      label: {
        text: this.formatLength(this.totalLength),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: this.visible,
      },
    })

    this.entities.push(this.labelEntity)
  }

  /**
   * 计算线段总长度（大地测量）
   */
  private calculateLength(positions: Cesium.Cartesian3[]): number {
    let totalDistance = 0
    const ellipsoid = this.viewer.scene.globe.ellipsoid

    for (let i = 0; i < positions.length - 1; i++) {
      const geodesic = new Cesium.EllipsoidGeodesic(
        ellipsoid.cartesianToCartographic(positions[i]),
        ellipsoid.cartesianToCartographic(positions[i + 1])
      )
      totalDistance += geodesic.surfaceDistance
    }

    return totalDistance
  }

  /**
   * 格式化长度显示
   */
  private formatLength(meters: number): string {
    if (meters < 1000) {
      return `${meters.toFixed(2)} m`
    } else {
      return `${(meters / 1000).toFixed(2)} km`
    }
  }

  /**
   * 开始编辑模式
   */
  public startEdit(): void {
    if (!this.editable || this.editing || !this.lineEntity) {
      return
    }

    this.editing = true

    // 显示顶点标记
    const positions = this.lineEntity.polyline?.positions?.getValue(Cesium.JulianDate.now())
    if (positions) {
      this.showVertexMarkers(positions)
    }

    // TODO: 实现顶点拖拽编辑功能
    console.log('LineGraphic.startEdit: Edit mode enabled (drag vertices - to be implemented)')
  }

  /**
   * 显示顶点标记
   */
  private showVertexMarkers(positions: Cesium.Cartesian3[]): void {
    const style = { ...LineGraphic.DEFAULT_STYLE, ...this.style }

    positions.forEach((position, vertexIndex) => {
      const marker = this.viewer.entities.add({
        id: `${this.id}_vertex_${vertexIndex}`,
        position,
        point: {
          pixelSize: style.pointSize,
          color: Cesium.Color.fromCssColorString(style.pointColor),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        // Store vertex index for editing
        properties: {
          vertexIndex,
        },
      })
      this.vertexMarkers.push(marker)
      this.entities.push(marker)
    })
  }

  /**
   * 停止编辑模式
   */
  public stopEdit(): void {
    if (!this.editing) return

    this.editing = false

    // 移除顶点标记
    this.hideVertexMarkers()

    console.log('LineGraphic.stopEdit: Edit mode disabled')
  }

  /**
   * 隐藏顶点标记
   */
  private hideVertexMarkers(): void {
    this.vertexMarkers.forEach((marker) => {
      this.viewer.entities.remove(marker)
      const index = this.entities.indexOf(marker)
      if (index > -1) {
        this.entities.splice(index, 1)
      }
    })
    this.vertexMarkers = []
  }

  /**
   * 导出为 GeoJSON 格式
   */
  /**
   * 获取图形中心点（线段中点）
   */
  public getCenter(): Cesium.Cartesian3 {
    if (!this.lineEntity || !this.lineEntity.polyline || !this.lineEntity.polyline.positions) {
      throw new Error('LineGraphic has no positions')
    }

    const positions = this.lineEntity.polyline.positions.getValue(Cesium.JulianDate.now())
    if (!positions || positions.length === 0) {
      throw new Error('LineGraphic positions are empty')
    }

    // Return middle point of the line
    const middleIndex = Math.floor(positions.length / 2)
    return positions[middleIndex]
  }

  public toGeoJSON(): any {
    if (!this.lineEntity || !this.lineEntity.polyline?.positions) {
      return null
    }

    const positions = this.lineEntity.polyline.positions.getValue(Cesium.JulianDate.now())
    if (!positions || positions.length < 2) return null

    const coordinates = positions.map((pos: Cesium.Cartesian3) => {
      const cartographic = Cesium.Cartographic.fromCartesian(pos)
      return [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
        cartographic.height,
      ]
    })

    return {
      type: 'Feature',
      id: this.id,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        name: this.name,
        length: this.totalLength,
        lengthFormatted: this.formatLength(this.totalLength),
        lineStyle: this.lineStyle,
        style: this.style,
        createdAt: this.createdAt.toISOString(),
        ...this.properties,
      },
    }
  }

  /**
   * 更新线的位置
   * @param positions - 新的顶点位置
   */
  public updatePositions(positions: Cesium.Cartesian3[]): void {
    if (!this.lineEntity || positions.length < 2) return

    // 更新线
    this.lineEntity.polyline!.positions = new Cesium.ConstantProperty(positions)

    // 重新计算长度
    this.totalLength = this.calculateLength(positions)

    // 更新标签
    if (this.labelEntity && this.showLength) {
      const midIndex = Math.floor(positions.length / 2)
      this.labelEntity.position = new Cesium.ConstantPositionProperty(positions[midIndex])
      this.labelEntity.label!.text = new Cesium.ConstantProperty(
        this.formatLength(this.totalLength)
      )
    }
  }

  /**
   * 获取线的长度（米）
   */
  public getLength(): number {
    return this.totalLength
  }

  /**
   * 获取线的顶点位置
   */
  public getPositions(): Cesium.Cartesian3[] | null {
    if (!this.lineEntity || !this.lineEntity.polyline?.positions) return null

    return this.lineEntity.polyline.positions.getValue(Cesium.JulianDate.now())
  }

  /**
   * 获取地理坐标数组
   */
  public getCoordinates(): Array<{ longitude: number; latitude: number; height: number }> | null {
    const positions = this.getPositions()
    if (!positions) return null

    return positions.map((pos) => {
      const cartographic = Cesium.Cartographic.fromCartesian(pos)
      return {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
      }
    })
  }

  /**
   * 设置是否显示长度标签
   */
  public setShowLength(show: boolean): void {
    this.showLength = show

    if (this.labelEntity) {
      this.labelEntity.show = show && this.visible
    }
  }

  /**
   * 设置线型
   */
  public setLineStyle(lineStyle: 'solid' | 'dashed' | 'dotted'): void {
    if (this.lineStyle === lineStyle) return

    this.lineStyle = lineStyle

    // 重新创建线（需要更新材质）
    const positions = this.getPositions()
    if (positions) {
      this.create(positions)
    }
  }

  /**
   * 移动图形
   * @param offset - 偏移向量
   */
  public move(offset: Cesium.Cartesian3): void {
    const positions = this.getPositions()
    if (!positions || positions.length === 0) return

    // Apply offset to all vertices
    const newPositions = positions.map((pos) =>
      Cesium.Cartesian3.add(pos, offset, new Cesium.Cartesian3())
    )

    this.updatePositions(newPositions)
  }

  /**
   * 应用样式到实体
   * 覆盖基类方法以支持高亮效果
   */
  protected applyStyle(): void {
    if (this.lineEntity && this.lineEntity.polyline) {
      const strokeColor = Cesium.Color.fromCssColorString(this.style.strokeColor || '#22D3EE')
      this.lineEntity.polyline.material = new Cesium.ColorMaterialProperty(strokeColor)
      this.lineEntity.polyline.width = new Cesium.ConstantProperty(this.style.strokeWidth || 2)
    }
  }
}
