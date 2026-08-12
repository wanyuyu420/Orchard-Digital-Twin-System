/**
 * PolygonGraphic - 多边形图形类
 *
 * 实现多边形绘制功能，支持面积计算、样式配置
 * 使用独立 Polyline 实现边框（绕过 Cesium PolygonGraphics outlineWidth 限制）
 */
import * as Cesium from 'cesium'
import { BaseGraphic, type BaseGraphicOptions } from '../core/BaseGraphic'

/**
 * 多边形图形选项
 */
export interface PolygonGraphicOptions extends BaseGraphicOptions {
  /** 是否显示面积标签 */
  showAreaLabel?: boolean
  /** 高度模式 */
  heightReference?: Cesium.HeightReference
  /** 中心图标URL（可选） */
  centerIcon?: string
}

/**
 * PolygonGraphic 类
 *
 * 功能：
 * - 使用 PolygonGraphics 渲染填充
 * - 使用独立 PolylineGraphics 渲染边框（支持自定义宽度）
 * - 面积计算（大地测量）
 * - 面积标签显示
 * - 中心图标显示
 * - 支持填充和边框样式
 * - 编辑模式（显示顶点标记）
 */
export class PolygonGraphic extends BaseGraphic {
  /** 多边形填充实体 */
  private polygonEntity: Cesium.Entity | null = null

  /** 多边形边框实体（独立 Polyline）*/
  private outlineEntity: Cesium.Entity | null = null

  /** 面积标签实体 */
  private areaLabelEntity: Cesium.Entity | null = null
  
  /** 中心图标实体 */
  private centerIconEntity: Cesium.Entity | null = null

  /** 顶点标记实体（编辑模式）*/
  private vertexMarkers: Cesium.Entity[] = []

  /** 是否显示面积标签 */
  private showAreaLabel: boolean

  /** 高度模式 */
  private heightReference: Cesium.HeightReference
  
  /** 中心图标URL */
  private centerIcon?: string

  /** 顶点位置数组 */
  private positions: Cesium.Cartesian3[] = []

  /** 面积（平方米）*/
  private area: number = 0

  constructor(viewer: Cesium.Viewer, options: PolygonGraphicOptions = {}) {
    super(viewer, { ...options, type: 'polygon' })
    this.showAreaLabel = options.showAreaLabel ?? false // 默认不显示面积标签
    this.heightReference = options.heightReference ?? Cesium.HeightReference.CLAMP_TO_GROUND
    this.centerIcon = options.centerIcon
  }

  /**
   * 创建多边形
   * @param positions 顶点位置数组（至少3个点）
   */
  create(positions: Cesium.Cartesian3[]): void {
    if (positions.length < 3) {
      throw new Error('PolygonGraphic requires at least 3 positions')
    }

    this.positions = [...positions]

    // 计算面积
    this.area = this.calculateArea(this.positions)

    // 创建填充多边形
    this.createPolygonEntity()

    // 创建独立边框
    this.createOutlineEntity()

    // 创建面积标签
    if (this.showAreaLabel) {
      this.createAreaLabel()
    }
    
    // 创建中心图标
    if (this.centerIcon) {
      this.createCenterIcon()
    }

    // Mark as created (using internal flag)
  }

  /**
   * 创建多边形填充实体
   */
  private createPolygonEntity(): void {
    if (this.positions.length < 3) return

    this.polygonEntity = this.viewer.entities.add({
      id: this.id,
      name: this.name,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(this.positions),
        material: Cesium.Color.TRANSPARENT, // 完全透明填充
        classificationType: Cesium.ClassificationType.BOTH_3D_TILE, // 贴地形/3D Tile表面
        outline: false,
      },
    })

    this.entities.push(this.polygonEntity)
  }

  /**
   * 创建独立边框实体
   * 解决 Cesium PolygonGraphics outlineWidth 限制
   */
  private createOutlineEntity(): void {
    if (this.positions.length < 3) return

    // 闭合多边形：最后一个点连回第一个点
    const outlinePositions = [...this.positions, this.positions[0]]

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
   * 创建面积标签
   */
  private createAreaLabel(): void {
    if (this.positions.length < 3) return

    // 标签位置：多边形中心（重心）
    const center = this.calculateCentroid(this.positions)

    this.areaLabelEntity = this.viewer.entities.add({
      position: center,
      label: {
        text: this.formatArea(this.area),
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    this.entities.push(this.areaLabelEntity)
  }

  /**
   * 创建中心图标
   */
  private createCenterIcon(): void {
    if (this.positions.length < 3 || !this.centerIcon) return

    const center = this.calculateCentroid(this.positions)
    
    this.centerIconEntity = this.viewer.entities.add({
      position: center,
      billboard: {
        image: this.centerIcon,
        width: 24,
        height: 24,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: this.heightReference,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
         // Ensure icon is above Polygon
        eyeOffset: new Cesium.Cartesian3(0, 0, -50)
      }
    })
    
    this.entities.push(this.centerIconEntity)
  }

  /**
   * 计算多边形面积（使用大地测量）
   * 基于 Shoelace 公式的球面版本
   */
  private calculateArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0

    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const cartographics = positions.map((pos) => ellipsoid.cartesianToCartographic(pos))

    // 使用 Shoelace 公式计算近似面积
    let area = 0
    const n = cartographics.length

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const xi = cartographics[i].longitude
      const yi = cartographics[i].latitude
      const xj = cartographics[j].longitude
      const yj = cartographics[j].latitude

      area += xi * yj - xj * yi
    }

    area = Math.abs(area / 2)

    // 转换为平方米（近似）
    // 使用平均纬度的米/度转换系数
    const avgLat = cartographics.reduce((sum, c) => sum + c.latitude, 0) / n
    const metersPerDegree = 111320 * Math.cos(avgLat)
    area *= metersPerDegree * metersPerDegree

    return area
  }

  /**
   * 计算多边形重心
   */
  private calculateCentroid(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    if (positions.length === 0) {
      return new Cesium.Cartesian3(0, 0, 0)
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const cartographics = positions.map((pos) => ellipsoid.cartesianToCartographic(pos))

    // 计算平均经纬度
    let lonSum = 0
    let latSum = 0
    let heightSum = 0

    cartographics.forEach((c) => {
      lonSum += c.longitude
      latSum += c.latitude
      heightSum += c.height
    })

    const avgLon = lonSum / cartographics.length
    const avgLat = latSum / cartographics.length
    const avgHeight = heightSum / cartographics.length

    return ellipsoid.cartographicToCartesian(new Cesium.Cartographic(avgLon, avgLat, avgHeight))
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
   * 获取顶点数量
   */
  getVertexCount(): number {
    return this.positions.length
  }

  /**
   * 获取顶点位置
   */
  getPositions(): Cesium.Cartesian3[] {
    return [...this.positions]
  }

  /**
   * 移动图形
   * @param offset - 偏移向量
   */
  public move(offset: Cesium.Cartesian3): void {
    if (this.positions.length === 0) return

    // Apply offset to all vertices
    const newPositions = this.positions.map((pos) =>
      Cesium.Cartesian3.add(pos, offset, new Cesium.Cartesian3())
    )

    this.updatePositions(newPositions)
  }

  /**
   * 更新多边形顶点
   */
  updatePositions(positions: Cesium.Cartesian3[]): void {
    this.remove()
    this.create(positions)
  }

  /**
   * 更新单个顶点位置
   * @param index 顶点索引
   * @param position 新位置
   */
  updateVertex(index: number, position: Cesium.Cartesian3): void {
    if (index < 0 || index >= this.positions.length) {
      throw new Error(`Invalid vertex index: ${index}`)
    }

    this.positions[index] = position
    this.updatePositions(this.positions)
  }

  /**
   * 插入顶点
   * @param index 插入位置索引（在此索引之后插入）
   * @param position 新顶点位置
   */
  insertVertex(index: number, position: Cesium.Cartesian3): void {
    if (index < 0 || index >= this.positions.length) {
      throw new Error(`Invalid insert index: ${index}`)
    }

    this.positions.splice(index + 1, 0, position)
    this.updatePositions(this.positions)
  }

  /**
   * 删除顶点
   * @param index 顶点索引
   */
  removeVertex(index: number): void {
    if (this.positions.length <= 3) {
      throw new Error('Cannot remove vertex: polygon must have at least 3 vertices')
    }

    if (index < 0 || index >= this.positions.length) {
      throw new Error(`Invalid vertex index: ${index}`)
    }

    this.positions.splice(index, 1)
    this.updatePositions(this.positions)
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
    if (this.positions.length < 3) return

    this.editing = true

    // 显示顶点标记
    this.positions.forEach((position, index) => {
      const marker = this.viewer.entities.add({
        position: position,
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: this.heightReference,
        },
        // 存储顶点索引，便于拖拽时识别
        properties: {
          vertexIndex: index,
        },
      })
      this.vertexMarkers.push(marker)
      this.entities.push(marker)
    })
  }

  /**
   * 停止编辑模式
   */
  stopEdit(): void {
    this.editing = false

    // 移除顶点标记
    this.vertexMarkers.forEach((marker) => {
      this.viewer.entities.remove(marker)
    })
    this.vertexMarkers = []
  }

  /**
   * 移除多边形
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
    
    this.polygonEntity = null
    this.outlineEntity = null
    this.areaLabelEntity = null
    this.vertexMarkers = []
    // Polygon removed
  }

  /**
   * 导出为 GeoJSON
   */
  /**
   * 获取图形中心点（多边形重心）
   */
  public getCenter(): Cesium.Cartesian3 {
    if (
      !this.polygonEntity ||
      !this.polygonEntity.polygon ||
      !this.polygonEntity.polygon.hierarchy
    ) {
      throw new Error('PolygonGraphic has no polygon hierarchy')
    }

    const hierarchy = this.polygonEntity.polygon.hierarchy.getValue(Cesium.JulianDate.now())
    const positions = hierarchy.positions || []

    if (positions.length === 0) {
      throw new Error('PolygonGraphic positions are empty')
    }

    // Calculate centroid (simple average of all vertices)
    let sumX = 0,
      sumY = 0,
      sumZ = 0
    positions.forEach((pos: Cesium.Cartesian3) => {
      sumX += pos.x
      sumY += pos.y
      sumZ += pos.z
    })

    return new Cesium.Cartesian3(
      sumX / positions.length,
      sumY / positions.length,
      sumZ / positions.length
    )
  }

  /**
   * 应用样式到实体
   * 覆盖基类方法以支持高亮效果
   */
  protected applyStyle(): void {
    // Update polygon fill - 保持透明
    if (this.polygonEntity && this.polygonEntity.polygon) {
      this.polygonEntity.polygon.material = Cesium.Color.TRANSPARENT
    }

    // Update outline - 使用配置的线条颜色
    if (this.outlineEntity && this.outlineEntity.polyline) {
      this.outlineEntity.polyline.material = Cesium.Color.fromCssColorString(this.style.strokeColor || '#000000')
      this.outlineEntity.polyline.width = new Cesium.ConstantProperty(this.style.strokeWidth || 2)
    }
  }

  toGeoJSON(): any {
    if (this.positions.length < 3) {
      return null
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid
    const coordinates: number[][] = this.positions.map((pos) => {
      const cartographic = ellipsoid.cartesianToCartographic(pos)
      return [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
      ]
    })

    // 闭合多边形：第一个点和最后一个点相同
    coordinates.push(coordinates[0])

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
        area: this.area,
        areaFormatted: this.formatArea(this.area),
        vertexCount: this.positions.length,
        style: this.style,
        createdAt: new Date().toISOString(),
      },
    }
  }
}
