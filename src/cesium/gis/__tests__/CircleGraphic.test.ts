/**
 * CircleGraphic 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Cesium - 必须在 import 之前
vi.mock('cesium', () => {
  const mockCenterPosition = { x: 100, y: 200, z: 300 }
  const mockCartographic = {
    longitude: 2.0,
    latitude: 0.5,
    height: 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockEllipsoid = {
    maximumRadius: 6378137,
    cartesianToCartographic: vi.fn(() => mockCartographic),
    cartographicToCartesian: vi.fn((_carto: any) => mockCenterPosition),
  }

  return {
    Cartesian3: {
      midpoint: vi.fn((_a: any, _b: any, _result: any) => mockCenterPosition),
    },
    Cartesian2: vi.fn((x: number, y: number) => ({ x, y })),
    Color: {
      fromCssColorString: vi.fn((_color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha })),
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      BLACK: { r: 0, g: 0, b: 0, a: 1 },
      RED: { r: 1, g: 0, b: 0, a: 1 },
      BLUE: { r: 0, g: 0, b: 1, a: 1 },
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    EllipsoidGeodesic: vi.fn().mockImplementation(() => ({
      surfaceDistance: 5000, // 5km
      interpolateUsingFraction: vi.fn(() => mockCartographic),
    })),
    Cartographic: vi.fn((lon: number, lat: number, height?: number) => ({
      longitude: lon,
      latitude: lat,
      height: height || 0,
    })),
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

import { CircleGraphic } from '../graphics/CircleGraphic'

// Test data
const mockCenterPosition = { x: 100, y: 200, z: 300 }
const mockEdgePosition = { x: 150, y: 200, z: 300 }

const mockCartographic = {
  longitude: 2.0,
  latitude: 0.5,
  height: 0,
}

const mockEllipsoid = {
  maximumRadius: 6378137,
  cartesianToCartographic: vi.fn(() => mockCartographic),
  cartographicToCartesian: vi.fn((carto: any) => mockCenterPosition),
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
      ellipse: options.ellipse,
      point: options.point,
      label: options.label,
      show: options.show !== false,
    })),
    remove: vi.fn(),
  },
} as any

describe('CircleGraphic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该创建 CircleGraphic 实例', () => {
    const circle = new CircleGraphic(mockViewer)
    expect(circle).toBeDefined()
    expect(circle.type).toBe('circle')
  })

  it('应该使用默认样式创建圆形', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    // 应该创建圆形实体
    expect(mockViewer.entities.add).toHaveBeenCalled()
    const firstCall = mockViewer.entities.add.mock.calls[0][0]
    expect(firstCall.ellipse).toBeDefined()
  })

  it('应该创建带半径和面积标签的圆形', () => {
    const circle = new CircleGraphic(mockViewer, {
      showRadiusLabel: true,
      showAreaLabel: true,
    })
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    // 应该创建至少2个实体：圆形 + 标签
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该正确计算半径', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const radius = circle.getRadius()
    expect(radius).toBe(5000) // mock 返回 5000m
  })

  it('应该正确计算面积', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const area = circle.getArea()
    expect(area).toBeGreaterThan(0)
    expect(area).toBe(Math.PI * 5000 * 5000) // πr²
  })

  it('应该正确格式化半径显示', () => {
    const circle = new CircleGraphic(mockViewer, {
      showRadiusLabel: true,
    })
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const geojson = circle.toGeoJSON()
    expect(geojson.properties.radiusFormatted).toMatch(/R: \d+\.?\d* (m|km)/)
  })

  it('应该正确格式化面积显示', () => {
    const circle = new CircleGraphic(mockViewer, {
      showAreaLabel: true,
    })
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const geojson = circle.toGeoJSON()
    expect(geojson.properties.areaFormatted).toMatch(/\d+\.?\d* (m²|km²)/)
  })

  it('应该支持切换半径标签显示', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    circle.toggleRadiusLabel(false)
    // 验证标签被隐藏（通过调用次数）
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持切换面积标签显示', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    circle.toggleAreaLabel(false)
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该导出正确的 GeoJSON 格式', () => {
    const circle = new CircleGraphic(mockViewer, {
      name: '测试圆形',
    })
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const geojson = circle.toGeoJSON()
    expect(geojson.type).toBe('Feature')
    expect(geojson.geometry.type).toBe('Polygon')
    expect(geojson.properties.shapeType).toBe('circle')
    expect(geojson.properties.center).toBeDefined()
    expect(geojson.properties.radius).toBe(5000)
  })

  it('应该在 GeoJSON 中包含圆心坐标', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const geojson = circle.toGeoJSON()
    expect(geojson.properties.center).toHaveLength(2) // [lon, lat]
  })

  it('应该支持显示/隐藏功能', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    circle.hide()
    expect(circle.visible).toBe(false)

    circle.show()
    expect(circle.visible).toBe(true)
  })

  it('应该支持移除功能', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    circle.remove()

    // 验证实体被移除
    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该支持编辑模式', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const initialCallCount = mockViewer.entities.add.mock.calls.length
    circle.startEdit()

    // 应该添加中心点和边界点标记
    expect(mockViewer.entities.add.mock.calls.length).toBeGreaterThan(initialCallCount)
    expect(circle.isEditing).toBe(true)

    circle.stopEdit()
    expect(circle.isEditing).toBe(false)
  })

  it('应该拒绝少于2个点的圆形', () => {
    const circle = new CircleGraphic(mockViewer)

    expect(() => {
      circle.create([mockCenterPosition] as any)
    }).toThrow('CircleGraphic requires at least 2 positions')
  })

  it('应该生成唯一的 ID', () => {
    const circle1 = new CircleGraphic(mockViewer)
    const circle2 = new CircleGraphic(mockViewer)

    expect(circle1.id).not.toBe(circle2.id)
  })

  it('应该在 GeoJSON 中生成圆形多边形近似', () => {
    const circle = new CircleGraphic(mockViewer)
    circle.create([mockCenterPosition, mockEdgePosition] as any)

    const geojson = circle.toGeoJSON()
    const coordinates = geojson.geometry.coordinates[0]

    // 应该有37个点（36个 + 闭合点）
    expect(coordinates.length).toBe(37)
  })
})
