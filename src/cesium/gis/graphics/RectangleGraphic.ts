/**
 * RectangleGraphic - 矩形图形类
 *
 * 实现矩形绘制功能，支持面积计算、尺寸显示、样式配置
 * 使用两个对角点定义矩形范围
 */
import * as Cesium from 'cesium'
import { BaseGraphic, type BaseGraphicOptions } from '../core/BaseGraphic'

/**
 * 矩形图形选项
 */
export interface RectangleGraphicOptions extends BaseGraphicOptions {
  /** 是否显示尺寸标签 */
  showDimensionsLabel?: boolean
  /** 是否显示面积标签 */
  showAreaLabel?: boolean
  /** 高度模式 */
  heightReference?: Cesium.HeightReference
}

/**
 * RectangleGraphic 类
 *
 * 功能：
 * - 使用 RectangleGraphics 渲染填充
 * - 使用独立 Polyline 渲染边框（支持自定义宽度）
 * - 面积计算（平方米/平方公里）
 * - 尺寸标签（宽×高）
 * - 面积标签显示
 * - 支持填充和边框样式
 * - 编辑模式（显示4个角点标记）
 */
export class RectangleGraphic extends BaseGraphic {
  /** 矩形填充实体 */
  private rectangleEntity: Cesium.Entity | null = null

  /** 矩形边框实体（独立 Polyline）*/
  private outlineEntity: Cesium.Entity | null = null

  /** 尺寸标签实体 */
  private dimensionsLabelEntity: Cesium.Entity | null = null

  /** 面积标签实体 */
  private areaLabelEntity: Cesium.Entity | null = null

  /** 角点标记（编辑模式） */
  private cornerMarkers: Cesium.Entity[] = []

  /** 是否显示尺寸标签 */
  private showDimensionsLabel: boolean

  /** 是否显示面积标签 */
  private showAreaLabel: boolean

  /** 高度模式 */
  private heightReference: Cesium.HeightReference

  /** 矩形范围（西、南、东、北）*/
  private rectangleBounds: Cesium.Rectangle | null = null

  /** 宽度（米）*/
  private width: number = 0

  /** 高度（米）*/
  private height: number = 0

  /** 矩形所在高度（用于边框贴合3D表面）*/
  private rectHeight: number = 0

  /** 面积（平方米）*/
  private area: number = 0

  constructor(viewer: Cesium.Viewer, options: RectangleGraphicOptions = {}) {
    super(viewer, { ...options, type: 'rectangle' })
    this.showDimensionsLabel = options.showDimensionsLabel ?? false
    this.showAreaLabel = options.showAreaLabel ?? false
    this.heightReference = options.heightReference ?? Cesium.HeightReference.CLAMP_TO_GROUND
  }

  /**
   * 创建矩形
   * @param positions 两个对角点的位置数组 [西南角, 东北角]
   */
  create(positions: Cesium.Cartesian3[]): void {
    if (positions.length < 2) {
      throw new Error('RectangleGraphic requires at least 2 positions (opposite corners)')
    }

    // 转换为经纬度
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const cartographics = positions.slice(0, 2).map((pos) => ellipsoid.cartesianToCartographic(pos))

    // 计算矩形范围
    const west = Math.min(cartographics[0].longitude, cartographics[1].longitude)
    const south = Math.min(cartographics[0].latitude, cartographics[1].latitude)
    const east = Math.max(cartographics[0].longitude, cartographics[1].longitude)
    const north = Math.max(cartographics[0].latitude, cartographics[1].latitude)

    // 使用两个角点的平均高度，使边框贴合3D模型表面
    this.rectHeight = (cartographics[0].height + cartographics[1].height) / 2

    this.rectangleBounds = Cesium.Rectangle.fromRadians(west, south, east, north)

    // 计算尺寸和面积
    const dimensions = this.calculateDimensions(this.rectangleBounds)
    this.width = dimensions.width
    this.height = dimensions.height
    this.area = this.width * this.height

    // 创建矩形实体（填充）
    this.createRectangleEntity()

    // 创建独立边框
    this.createOutlineEntity()

    // 创建标签
    if (this.showDimensionsLabel) {
      this.createDimensionsLabel()
    }
    if (this.showAreaLabel) {
      this.createAreaLabel()
    }

    // Rectangle creation complete
  }

  /**
   * 创建矩形填充实体
   */
  private createRectangleEntity(): void {
    if (!this.rectangleBounds) return

    this.rectangleEntity = this.viewer.entities.add({
      id: this.id,
      name: this.name,
      rectangle: {
        coordinates: this.rectangleBounds,
        material: Cesium.Color.TRANSPARENT, // 完全透明填充
        outline: false,
      },
    })

    this.entities.push(this.rectangleEntity)
  }

  /**
   * 创建独立边框实体
   * 解决 Cesium RectangleGraphics outlineWidth 限制和 classificationType 冲突问题
   */
  private createOutlineEntity(): void {
    if (!this.rectangleBounds) return

    const westDeg = Cesium.Math.toDegrees(this.rectangleBounds.west)
    const eastDeg = Cesium.Math.toDegrees(this.rectangleBounds.east)
    const southDeg = Cesium.Math.toDegrees(this.rectangleBounds.south)
    const northDeg = Cesium.Math.toDegrees(this.rectangleBounds.north)

    // 使用纯经纬度（不带高程），配合 clampToGround 使边框贴地
    const nw = Cesium.Cartesian3.fromDegrees(westDeg, northDeg)
    const ne = Cesium.Cartesian3.fromDegrees(eastDeg, northDeg)
    const se = Cesium.Cartesian3.fromDegrees(eastDeg, southDeg)
    const sw = Cesium.Cartesian3.fromDegrees(westDeg, southDeg)

    // 边框位置（闭合）
    const outlinePositions = [nw, ne, se, sw, nw]

    // 使用 Entity polyline 创建边框（clampToGround 使边框贴在地形/3D模型表面）
    this.outlineEntity = this.viewer.entities.add({
      polyline: {
        positions: outlinePositions,
        clampToGround: true,
        width: this.style.strokeWidth || 2,
        material: Cesium.Color.fromCssColorString(this.style.strokeColor || '#000000'),
      },
    })

    this.entities.push(this.outlineEntity)
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
   * 创建尺寸标签
   */
  private createDimensionsLabel(): void {
    if (!this.rectangleBounds) return

    // 标签位置：矩形中心偏上
    const center = Cesium.Rectangle.center(this.rectangleBounds)
    const centerCartesian = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, this.rectHeight)

    this.dimensionsLabelEntity = this.viewer.entities.add({
      position: centerCartesian,
      label: {
        text: this.formatDimensions(this.width, this.height),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    this.entities.push(this.dimensionsLabelEntity)
  }

  /**
   * 创建面积标签
   */
  private createAreaLabel(): void {
    if (!this.rectangleBounds) return

    // 标签位置：矩形中心偏下
    const center = Cesium.Rectangle.center(this.rectangleBounds)
    const centerCartesian = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, this.rectHeight)

    this.areaLabelEntity = this.viewer.entities.add({
      position: centerCartesian,
      label: {
        text: this.formatArea(this.area),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 15),
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    this.entities.push(this.areaLabelEntity)
  }

  /**
   * 计算矩形尺寸
   * @param rectangle 矩形范围
   * @returns 尺寸（宽和高，单位：米）
   */
  private calculateDimensions(rectangle: Cesium.Rectangle): { width: number; height: number } {
    const ellipsoid = this.viewer.scene.globe.ellipsoid

    // 获取矩形四个角的笛卡尔坐标
    const nw = ellipsoid.cartographicToCartesian(
      new Cesium.Cartographic(rectangle.west, rectangle.north)
    )
    const ne = ellipsoid.cartographicToCartesian(
      new Cesium.Cartographic(rectangle.east, rectangle.north)
    )
    const sw = ellipsoid.cartographicToCartesian(
      new Cesium.Cartographic(rectangle.west, rectangle.south)
    )

    // 计算宽度（北边）
    const geodesicWidth = new Cesium.EllipsoidGeodesic(
      ellipsoid.cartesianToCartographic(nw),
      ellipsoid.cartesianToCartographic(ne)
    )
    const width = geodesicWidth.surfaceDistance

    // 计算高度（西边）
    const geodesicHeight = new Cesium.EllipsoidGeodesic(
      ellipsoid.cartesianToCartographic(nw),
      ellipsoid.cartesianToCartographic(sw)
    )
    const height = geodesicHeight.surfaceDistance

    return { width, height }
  }

  /**
   * 格式化尺寸显示
   */
  private formatDimensions(width: number, height: number): string {
    const formatLength = (length: number): string => {
      if (length < 1000) {
        return `${length.toFixed(2)}m`
      } else {
        return `${(length / 1000).toFixed(3)}km`
      }
    }

    return `${formatLength(width)} × ${formatLength(height)}`
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
   * 获取面积
   */
  getArea(): number {
    return this.area
  }

  /**
   * 获取矩形尺寸
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /**
   * 更新矩形位置
   */
  updatePositions(positions: Cesium.Cartesian3[]): void {
    this.remove()
    this.create(positions)
  }

  /**
   * 切换尺寸标签显示
   */
  toggleDimensionsLabel(show: boolean): void {
    this.showDimensionsLabel = show
    if (this.dimensionsLabelEntity) {
      this.dimensionsLabelEntity.show = show
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
    if (!this.rectangleBounds) return

    this.editing = true

    // 显示四个角的标记
    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const corners = [
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.west, this.rectangleBounds.north)
      ),
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.east, this.rectangleBounds.north)
      ),
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.east, this.rectangleBounds.south)
      ),
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.west, this.rectangleBounds.south)
      ),
    ]

    corners.forEach((corner, vertexIndex) => {
      const marker = this.viewer.entities.add({
        position: corner,
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: this.heightReference,
        },
        // Store vertex index for editing
        properties: {
          vertexIndex,
        },
      })
      this.cornerMarkers.push(marker)
      this.entities.push(marker)
    })
  }

  /**
   * 停止编辑模式
   */
  stopEdit(): void {
    this.editing = false

    // 移除角标记
    this.cornerMarkers.forEach((marker) => {
      this.viewer.entities.remove(marker)
    })
    this.cornerMarkers = []
  }

  /**
   * 移除矩形
   */
  remove(): void {
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity)
    })
    this.entities = []
    
    // 移除 GroundPolylinePrimitive
    if (this.outlineEntity) {
      this.viewer.scene.primitives.remove(this.outlineEntity)
    }
    
    this.rectangleEntity = null
    this.outlineEntity = null
    this.dimensionsLabelEntity = null
    this.areaLabelEntity = null
    this.cornerMarkers = []
    // Rectangle removed
  }

  /**
   * 导出为 GeoJSON
   */
  /**
   * 获取图形中心点（矩形中心）
   */
  public getCenter(): Cesium.Cartesian3 {
    if (!this.rectangleBounds) {
      throw new Error('RectangleGraphic has no bounds')
    }

    // Calculate center of rectangle
    const centerLon = (this.rectangleBounds.west + this.rectangleBounds.east) / 2
    const centerLat = (this.rectangleBounds.south + this.rectangleBounds.north) / 2

    return Cesium.Cartesian3.fromRadians(centerLon, centerLat, this.rectHeight)
  }

  /**
   * 获取所有顶点位置（四个角点）
   */
  public getPositions(): Cesium.Cartesian3[] | null {
    if (!this.rectangleBounds) return null

    const ellipsoid = this.viewer.scene.globe.ellipsoid
    return [
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.west, this.rectangleBounds.south)
      ),
      ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(this.rectangleBounds.east, this.rectangleBounds.north)
      ),
    ]
  }

  /**
   * 移动图形
   * @param offset - 偏移向量
   */
  public move(offset: Cesium.Cartesian3): void {
    if (!this.rectangleBounds) return

    const ellipsoid = this.viewer.scene.globe.ellipsoid

    // Get current corner positions
    const sw = ellipsoid.cartographicToCartesian(
      new Cesium.Cartographic(this.rectangleBounds.west, this.rectangleBounds.south)
    )
    const ne = ellipsoid.cartographicToCartesian(
      new Cesium.Cartographic(this.rectangleBounds.east, this.rectangleBounds.north)
    )

    // Apply offset to corners
    const newSW = Cesium.Cartesian3.add(sw, offset, new Cesium.Cartesian3())
    const newNE = Cesium.Cartesian3.add(ne, offset, new Cesium.Cartesian3())

    // Recreate with new positions
    this.remove()
    this.create([newSW, newNE])
  }

  /**
   * 应用样式到实体
   * 覆盖基类方法以支持高亮效果
   */
  protected applyStyle(): void {
    // Update rectangle fill - 保持透明
    if (this.rectangleEntity && this.rectangleEntity.rectangle) {
      this.rectangleEntity.rectangle.material = Cesium.Color.TRANSPARENT
    }

    // Update outline - 使用配置的线条颜色
    if (this.outlineEntity && this.outlineEntity.polyline) {
      this.outlineEntity.polyline.material = Cesium.Color.fromCssColorString(this.style.strokeColor || '#000000')
      this.outlineEntity.polyline.width = new Cesium.ConstantProperty(this.style.strokeWidth || 2)
    }
  }

  toGeoJSON(): any {
    if (!this.rectangleBounds) {
      return null
    }

    // 转换为多边形（矩形的四个角）
    const west = Cesium.Math.toDegrees(this.rectangleBounds.west)
    const south = Cesium.Math.toDegrees(this.rectangleBounds.south)
    const east = Cesium.Math.toDegrees(this.rectangleBounds.east)
    const north = Cesium.Math.toDegrees(this.rectangleBounds.north)

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
            [west, north], // 闭合
          ],
        ],
      },
      properties: {
        id: this.id,
        name: this.name,
        type: this.type,
        shapeType: 'rectangle',
        area: this.area,
        areaFormatted: this.formatArea(this.area),
        width: this.width,
        height: this.height,
        dimensionsFormatted: this.formatDimensions(this.width, this.height),
        style: this.style,
        createdAt: new Date().toISOString(),
      },
    }
  }
}
