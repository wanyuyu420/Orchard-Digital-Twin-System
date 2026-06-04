/**
 * CircleGraphic - 圆形图形类
 *
 * 实现圆形绘制功能，支持半径计算、面积计算、样式配置
 * 使用两次点击：第一次定圆心，第二次定半径
 */
import * as Cesium from 'cesium'
import { BaseGraphic, type BaseGraphicOptions } from '../core/BaseGraphic'

/**
 * 圆形图形选项
 */
export interface CircleGraphicOptions extends BaseGraphicOptions {
  /** 是否显示半径标签 */
  showRadiusLabel?: boolean
  /** 是否显示面积标签 */
  showAreaLabel?: boolean
  /** 高度模式 */
  heightReference?: Cesium.HeightReference
}

/**
 * CircleGraphic 类
 *
 * 功能：
 * - 使用 EllipseGraphics 渲染（半长轴=半短轴=半径）
 * - 半径和面积计算（大地测量）
 * - 标签显示（中心、半径、面积）
 * - 支持填充和边框样式
 * - 编辑模式（显示中心点和边界点）
 */
export class CircleGraphic extends BaseGraphic {
  /** 圆形实体 */
  private circleEntity: Cesium.Entity | null = null

  /** 半径标签实体 */
  private radiusLabelEntity: Cesium.Entity | null = null

  /** 面积标签实体 */
  private areaLabelEntity: Cesium.Entity | null = null

  /** 中心点标记（编辑模式） */
  private centerMarker: Cesium.Entity | null = null

  /** 边界点标记（编辑模式） */
  private edgeMarker: Cesium.Entity | null = null

  /** 是否显示半径标签 */
  private showRadiusLabel: boolean

  /** 是否显示面积标签 */
  private showAreaLabel: boolean

  /** 高度模式 */
  private heightReference: Cesium.HeightReference

  /** 圆心位置 */
  private centerPosition: Cesium.Cartesian3 | null = null

  /** 半径（米） */
  private radius: number = 0

  /** 面积（平方米） */
  private area: number = 0

  constructor(viewer: Cesium.Viewer, options: CircleGraphicOptions = {}) {
    super(viewer, { ...options, type: 'circle' })
    this.showRadiusLabel = options.showRadiusLabel ?? true
    this.showAreaLabel = options.showAreaLabel ?? true
    this.heightReference = options.heightReference ?? Cesium.HeightReference.CLAMP_TO_GROUND
  }

  /**
   * 创建圆形
   * @param positions 位置数组 [圆心, 边界点]
   */
  create(positions: Cesium.Cartesian3[]): void {
    if (positions.length < 2) {
      throw new Error('CircleGraphic requires at least 2 positions (center and edge point)')
    }

    this.centerPosition = positions[0]
    const edgePosition = positions[1]

    // 计算半径（大地测量距离）
    this.radius = this.calculateRadius(this.centerPosition, edgePosition)

    // 计算面积
    this.area = Math.PI * this.radius * this.radius

    // 创建圆形实体
    this.createCircleEntity()

    // 创建标签
    if (this.showRadiusLabel) {
      this.createRadiusLabel(edgePosition)
    }
    if (this.showAreaLabel) {
      this.createAreaLabel()
    }

    // Circle creation complete
  }

  /**
   * 创建圆形实体
   */
  private createCircleEntity(): void {
    if (!this.centerPosition) return

    this.circleEntity = this.viewer.entities.add({
      id: this.id,
      name: this.name,
      position: this.centerPosition,
      ellipse: {
        semiMinorAxis: this.radius,
        semiMajorAxis: this.radius,
        material: this.getMaterial(),
        classificationType: Cesium.ClassificationType.TERRAIN, // Classify on terrain to avoid Z-fighting
        // Note: outline is disabled when using classificationType
        outline: false,
      },
    })

    this.entities.push(this.circleEntity)
  }

  /**
   * 获取填充材质
   */
  private getMaterial(): Cesium.MaterialProperty {
    const color = Cesium.Color.fromCssColorString(this.style.fillColor || '#ffcc33').withAlpha(
      this.style.opacity ?? 0.5
    )
    return new Cesium.ColorMaterialProperty(color)
  }

  /**
   * 创建半径标签
   */
  private createRadiusLabel(edgePosition: Cesium.Cartesian3): void {
    if (!this.centerPosition) return

    // 标签位置：圆心到边界的中点
    const midpoint = Cesium.Cartesian3.midpoint(
      this.centerPosition,
      edgePosition,
      new Cesium.Cartesian3()
    )

    this.radiusLabelEntity = this.viewer.entities.add({
      position: midpoint,
      label: {
        text: this.formatRadius(this.radius),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    this.entities.push(this.radiusLabelEntity)
  }

  /**
   * 创建面积标签
   */
  private createAreaLabel(): void {
    if (!this.centerPosition) return

    this.areaLabelEntity = this.viewer.entities.add({
      position: this.centerPosition,
      label: {
        text: this.formatArea(this.area),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 10),
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    this.entities.push(this.areaLabelEntity)
  }

  /**
   * 计算半径（大地测量距离）
   */
  private calculateRadius(center: Cesium.Cartesian3, edge: Cesium.Cartesian3): number {
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const centerCartographic = ellipsoid.cartesianToCartographic(center)
    const edgeCartographic = ellipsoid.cartesianToCartographic(edge)

    const geodesic = new Cesium.EllipsoidGeodesic(centerCartographic, edgeCartographic)
    return geodesic.surfaceDistance
  }

  /**
   * 格式化半径显示
   */
  private formatRadius(radius: number): string {
    if (radius < 1000) {
      return `R: ${radius.toFixed(2)} m`
    } else {
      return `R: ${(radius / 1000).toFixed(3)} km`
    }
  }

  /**
   * 格式化面积显示
   */
  private formatArea(area: number): string {
    if (area < 1_000_000) {
      return `${area.toFixed(2)} m²`
    } else {
      return `${(area / 1_000_000).toFixed(3)} km²`
    }
  }

  /**
   * 获取半径
   */
  getRadius(): number {
    return this.radius
  }

  /**
   * 获取面积
   */
  getArea(): number {
    return this.area
  }

  /**
   * 更新圆形（修改半径）
   */
  updateRadius(newEdgePosition: Cesium.Cartesian3): void {
    if (!this.centerPosition) return

    this.remove()
    this.create([this.centerPosition, newEdgePosition])
  }

  /**
   * 切换半径标签显示
   */
  toggleRadiusLabel(show: boolean): void {
    this.showRadiusLabel = show
    if (this.radiusLabelEntity) {
      this.radiusLabelEntity.show = show
    }
  }

  /**
   * 切换面积标签显示
   */
  toggleAreaLabel(show: boolean): void {
    this.showAreaLabel = show
    if (this.areaLabelEntity) {
      this.areaLabelEntity.show = show
    }
  }

  /**
   * 开始编辑模式
   */
  startEdit(): void {
    if (!this.centerPosition) return

    this.editing = true

    // 显示中心点标记
    this.centerMarker = this.viewer.entities.add({
      position: this.centerPosition,
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: this.heightReference,
      },
    })
    this.entities.push(this.centerMarker)

    // 显示边界点标记（东侧）
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const centerCartographic = ellipsoid.cartesianToCartographic(this.centerPosition)

    // 计算东侧边界点
    const edgeCartographic = new Cesium.EllipsoidGeodesic(
      centerCartographic,
      new Cesium.Cartographic(
        centerCartographic.longitude + this.radius / ellipsoid.maximumRadius,
        centerCartographic.latitude
      )
    )

    const edgePosition = ellipsoid.cartographicToCartesian(
      edgeCartographic.interpolateUsingFraction(1.0)
    )

    this.edgeMarker = this.viewer.entities.add({
      position: edgePosition,
      point: {
        pixelSize: 10,
        color: Cesium.Color.BLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: this.heightReference,
      },
    })
    this.entities.push(this.edgeMarker)
  }

  /**
   * 停止编辑模式
   */
  stopEdit(): void {
    this.editing = false

    if (this.centerMarker) {
      this.viewer.entities.remove(this.centerMarker)
      this.centerMarker = null
    }

    if (this.edgeMarker) {
      this.viewer.entities.remove(this.edgeMarker)
      this.edgeMarker = null
    }
  }

  /**
   * 移除圆形
   */
  remove(): void {
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity)
    })
    this.entities = []
    this.circleEntity = null
    this.radiusLabelEntity = null
    this.areaLabelEntity = null
    this.centerMarker = null
    this.edgeMarker = null
    // Circle removed
  }

  /**
   * 导出为 GeoJSON
   */
  /**
   * 获取图形中心点（圆心）
   */
  public getCenter(): Cesium.Cartesian3 {
    if (!this.centerPosition) {
      throw new Error('CircleGraphic has no center position')
    }
    return this.centerPosition
  }

  /**
   * 获取所有顶点位置（圆形返回圆心和一个边界点）
   */
  public getPositions(): Cesium.Cartesian3[] | null {
    if (!this.centerPosition) return null

    // Calculate edge point (east direction)
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const centerCartographic = ellipsoid.cartesianToCartographic(this.centerPosition)
    const edgeCartographic = new Cesium.Cartographic(
      centerCartographic.longitude + this.radius / ellipsoid.maximumRadius,
      centerCartographic.latitude,
      centerCartographic.height
    )
    const edgePosition = ellipsoid.cartographicToCartesian(edgeCartographic)

    return [this.centerPosition, edgePosition]
  }

  /**
   * 移动图形
   * @param offset - 偏移向量
   */
  public move(offset: Cesium.Cartesian3): void {
    if (!this.centerPosition) return

    // Calculate new center position
    const newCenter = Cesium.Cartesian3.add(this.centerPosition, offset, new Cesium.Cartesian3())

    // Calculate new edge point (east direction at same radius)
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const newCenterCartographic = ellipsoid.cartesianToCartographic(newCenter)
    const newEdgeCartographic = new Cesium.Cartographic(
      newCenterCartographic.longitude + this.radius / ellipsoid.maximumRadius,
      newCenterCartographic.latitude,
      newCenterCartographic.height
    )
    const newEdgePosition = ellipsoid.cartographicToCartesian(newEdgeCartographic)

    // Recreate with new positions
    this.remove()
    this.create([newCenter, newEdgePosition])
  }

  /**
   * 应用样式到实体
   * 覆盖基类方法以支持高亮效果
   */
  protected applyStyle(): void {
    if (this.circleEntity && this.circleEntity.ellipse) {
      const fillColor = Cesium.Color.fromCssColorString(
        this.style.fillColor || '#22D3EE'
      ).withAlpha(this.style.fillOpacity ?? this.style.opacity ?? 0.3)
      const outlineColor = Cesium.Color.fromCssColorString(this.style.strokeColor || '#22D3EE')

      this.circleEntity.ellipse.material = new Cesium.ColorMaterialProperty(fillColor)
      this.circleEntity.ellipse.outlineColor = new Cesium.ConstantProperty(outlineColor)
      this.circleEntity.ellipse.outlineWidth = new Cesium.ConstantProperty(
        this.style.strokeWidth || 2
      )
    }
  }

  toGeoJSON(): any {
    if (!this.centerPosition) {
      return null
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const centerCartographic = ellipsoid.cartesianToCartographic(this.centerPosition)
    const centerLon = Cesium.Math.toDegrees(centerCartographic.longitude)
    const centerLat = Cesium.Math.toDegrees(centerCartographic.latitude)

    // 生成圆形的多边形近似（36个点）
    const numPoints = 36
    const coordinates: number[][] = []

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI
      const geodesic = new Cesium.EllipsoidGeodesic(
        centerCartographic,
        new Cesium.Cartographic(
          centerCartographic.longitude + (this.radius / ellipsoid.maximumRadius) * Math.cos(angle),
          centerCartographic.latitude + (this.radius / ellipsoid.maximumRadius) * Math.sin(angle)
        )
      )
      const pointCartographic = geodesic.interpolateUsingFraction(1.0)
      coordinates.push([
        Cesium.Math.toDegrees(pointCartographic.longitude),
        Cesium.Math.toDegrees(pointCartographic.latitude),
      ])
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
      properties: {
        id: this.id,
        name: this.name,
        type: this.type,
        shapeType: 'circle',
        center: [centerLon, centerLat],
        radius: this.radius,
        radiusFormatted: this.formatRadius(this.radius),
        area: this.area,
        areaFormatted: this.formatArea(this.area),
        style: this.style,
        createdAt: new Date().toISOString(),
      },
    }
  }
}
