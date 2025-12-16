/**
 * PolygonGraphic 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Cesium - 必须在 import 之前
vi.mock('cesium', () => {
  const mockPositions = [
    { x: 100, y: 200, z: 300 },
    { x: 150, y: 200, z: 300 },
    { x: 150, y: 250, z: 300 },
    { x: 100, y: 250, z: 300 },
  ]

  const mockCartographic = {
    longitude: 2.0,
    latitude: 0.5,
    height: 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockEllipsoid = {
    maximumRadius: 6378137,
    cartesianToCartographic: vi.fn(() => mockCartographic),
    cartographicToCartesian: vi.fn((_carto: any) => mockPositions[0]),
  }

  return {
    Cartesian3: vi.fn((x: number, y: number, z: number) => ({ x, y, z })),
    Cartesian2: vi.fn((x: number, y: number) => ({ x, y })),
    PolygonHierarchy: vi.fn((positions: any) => ({ positions })),
    Cartographic: vi.fn((lon: number, lat: number, height?: number) => ({
      longitude: lon,
      latitude: lat,
      height: height || 0,
    })),
    Color: {
      fromCssColorString: vi.fn((_color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha })),
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      BLACK: { r: 0, g: 0, b: 0, a: 1 },
      RED: { r: 1, g: 0, b: 0, a: 1 },
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    LabelStyle: {
      FILL_AND_OUTLINE: 0,
    },
    HeightReference: {
      CLAMP_TO_GROUND: 0,
    },
    Math: {
      toDegrees: vi.fn((radians: number) => (radians * 180) / Math.PI),
    },
  }
})

import { PolygonGraphic } from '../graphics/PolygonGraphic'

// Test data
const mockPositions = [
  { x: 100, y: 200, z: 300 },
  { x: 150, y: 200, z: 300 },
  { x: 150, y: 250, z: 300 },
  { x: 100, y: 250, z: 300 },
]

const mockCartographic = {
  longitude: 2.0,
  latitude: 0.5,
  height: 0,
}

const mockEllipsoid = {
  maximumRadius: 6378137,
  cartesianToCartographic: vi.fn(() => mockCartographic),
  cartographicToCartesian: vi.fn(() => mockPositions[0]),
}

const mockViewer = {
  scene: {
    globe: {
      ellipsoid: mockEllipsoid,
    },
  },
  entities: {
    add: vi.fn((options) => ({
      id: options.id,
      position: options.position,
      polygon: options.polygon,
      polyline: options.polyline,
      point: options.point,
      label: options.label,
      properties: options.properties,
      show: options.show !== false,
    })),
    remove: vi.fn(),
  },
} as any

describe('PolygonGraphic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该创建 PolygonGraphic 实例', () => {
    const polygon = new PolygonGraphic(mockViewer)
    expect(polygon).toBeDefined()
    expect(polygon.type).toBe('polygon')
  })

  it('应该使用默认样式创建多边形', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    // 应该创建多边形实体和边框实体
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该创建独立的边框实体', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    // 应该至少创建2个实体：多边形 + 边框
    const calls = mockViewer.entities.add.mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(2)

    // 检查是否有 polyline（边框）
    const hasPolyline = calls.some((call: any) => call[0].polyline !== undefined)
    expect(hasPolyline).toBe(true)
  })

  it('应该创建带面积标签的多边形', () => {
    const polygon = new PolygonGraphic(mockViewer, {
      showAreaLabel: true,
    })
    polygon.create(mockPositions as any)

    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该正确计算面积', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const area = polygon.getArea()
    expect(area).toBeGreaterThanOrEqual(0)
  })

  it('应该正确获取顶点数量', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    expect(polygon.getVertexCount()).toBe(4)
  })

  it('应该正确获取顶点位置', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const positions = polygon.getPositions()
    expect(positions.length).toBe(4)
  })

  it('应该支持更新单个顶点', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const newPosition = { x: 200, y: 200, z: 300 }
    polygon.updateVertex(0, newPosition as any)

    const positions = polygon.getPositions()
    expect(positions[0]).toEqual(newPosition)
  })

  it('应该支持插入顶点', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const initialCount = polygon.getVertexCount()
    const newPosition = { x: 125, y: 200, z: 300 }
    polygon.insertVertex(0, newPosition as any)

    expect(polygon.getVertexCount()).toBe(initialCount + 1)
  })

  it('应该支持删除顶点', () => {
    const polygon = new PolygonGraphic(mockViewer)
    const positions = [...mockPositions, { x: 125, y: 225, z: 300 }]
    polygon.create(positions as any)

    const initialCount = polygon.getVertexCount()
    polygon.removeVertex(4)

    expect(polygon.getVertexCount()).toBe(initialCount - 1)
  })

  it('应该拒绝删除导致顶点少于3个的操作', () => {
    const polygon = new PolygonGraphic(mockViewer)
    const positions = mockPositions.slice(0, 3) // 只有3个顶点
    polygon.create(positions as any)

    expect(() => {
      polygon.removeVertex(0)
    }).toThrow('polygon must have at least 3 vertices')
  })

  it('应该导出正确的 GeoJSON 格式', () => {
    const polygon = new PolygonGraphic(mockViewer, {
      name: '测试多边形',
    })
    polygon.create(mockPositions as any)

    const geojson = polygon.toGeoJSON()
    expect(geojson.type).toBe('Feature')
    expect(geojson.geometry.type).toBe('Polygon')
    expect(geojson.properties.vertexCount).toBe(4)
  })

  it('GeoJSON 坐标应该是闭合的多边形', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const geojson = polygon.toGeoJSON()
    const coordinates = geojson.geometry.coordinates[0]

    // 应该有5个点（4个顶点 + 闭合点）
    expect(coordinates.length).toBe(5)
    // 第一个点和最后一个点应该相同（闭合）
    expect(coordinates[0]).toEqual(coordinates[4])
  })

  it('应该在 GeoJSON 中包含格式化的面积', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const geojson = polygon.toGeoJSON()
    expect(geojson.properties.areaFormatted).toMatch(/\d+\.?\d* (m²|km²)/)
  })

  it('应该支持切换面积标签显示', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    polygon.toggleAreaLabel(false)
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持显示/隐藏功能', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    polygon.hide()
    expect(polygon.visible).toBe(false)

    polygon.show()
    expect(polygon.visible).toBe(true)
  })

  it('应该支持移除功能', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    polygon.remove()
    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该支持编辑模式', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    const initialCallCount = mockViewer.entities.add.mock.calls.length
    polygon.startEdit()

    // 应该添加顶点标记
    expect(mockViewer.entities.add.mock.calls.length).toBeGreaterThan(initialCallCount)
    expect(polygon.isEditing).toBe(true)

    polygon.stopEdit()
    expect(polygon.isEditing).toBe(false)
  })

  it('应该拒绝少于3个点的多边形', () => {
    const polygon = new PolygonGraphic(mockViewer)

    expect(() => {
      polygon.create([mockPositions[0], mockPositions[1]] as any)
    }).toThrow('PolygonGraphic requires at least 3 positions')
  })

  it('应该生成唯一的 ID', () => {
    const polygon1 = new PolygonGraphic(mockViewer)
    const polygon2 = new PolygonGraphic(mockViewer)

    expect(polygon1.id).not.toBe(polygon2.id)
  })

  it('更新顶点时应该抛出无效索引错误', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    expect(() => {
      polygon.updateVertex(10, mockPositions[0] as any)
    }).toThrow('Invalid vertex index')
  })

  it('插入顶点时应该抛出无效索引错误', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    expect(() => {
      polygon.insertVertex(10, mockPositions[0] as any)
    }).toThrow('Invalid insert index')
  })

  it('删除顶点时应该抛出无效索引错误', () => {
    const polygon = new PolygonGraphic(mockViewer)
    polygon.create(mockPositions as any)

    expect(() => {
      polygon.removeVertex(10)
    }).toThrow('Invalid vertex index')
  })
})
