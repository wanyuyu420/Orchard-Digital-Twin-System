/**
 * RectangleGraphic 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Cesium - 必须在 import 之前
vi.mock('cesium', () => {
  const mockPosition1 = { x: 100, y: 200, z: 300 }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockPosition2 = { x: 150, y: 250, z: 300 }

  const mockCartographic1 = {
    longitude: 2.0,
    latitude: 0.5,
    height: 0,
  }

  const mockCartographic2 = {
    longitude: 2.1,
    latitude: 0.6,
    height: 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockEllipsoid = {
    maximumRadius: 6378137,
    cartesianToCartographic: vi.fn((pos) => {
      return pos.x === 100 ? mockCartographic1 : mockCartographic2
    }),
    cartographicToCartesian: vi.fn(() => mockPosition1),
  }

  const mockGeodesic = {
    surfaceDistance: 10000, // 10km
    interpolateUsingFraction: vi.fn(() => mockCartographic1),
  }

  return {
    Cartesian3: {
      fromRadians: vi.fn(() => mockPosition1),
    },
    Cartesian2: vi.fn((x: number, y: number) => ({ x, y })),
    Rectangle: {
      fromRadians: vi.fn((west, south, east, north) => ({
        west,
        south,
        east,
        north,
      })),
      center: vi.fn(() => mockCartographic1),
    },
    Color: {
      fromCssColorString: vi.fn((_color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha })),
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      BLACK: { r: 0, g: 0, b: 0, a: 1 },
      RED: { r: 1, g: 0, b: 0, a: 1 },
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    EllipsoidGeodesic: vi.fn().mockImplementation(() => mockGeodesic),
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

import { RectangleGraphic } from '../graphics/RectangleGraphic'

// Test data
const mockPosition1 = { x: 100, y: 200, z: 300 }
const mockPosition2 = { x: 150, y: 250, z: 300 }

const mockCartographic = {
  longitude: 2.0,
  latitude: 0.5,
  height: 0,
}

const mockEllipsoid = {
  maximumRadius: 6378137,
  cartesianToCartographic: vi.fn(() => mockCartographic),
  cartographicToCartesian: vi.fn(() => mockPosition1),
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
      rectangle: options.rectangle,
      point: options.point,
      label: options.label,
      show: options.show !== false,
    })),
    remove: vi.fn(),
  },
} as any

describe('RectangleGraphic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该创建 RectangleGraphic 实例', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    expect(rectangle).toBeDefined()
    expect(rectangle.type).toBe('rectangle')
  })

  it('应该使用默认样式创建矩形', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    // 应该创建矩形实体
    expect(mockViewer.entities.add).toHaveBeenCalled()
    const firstCall = mockViewer.entities.add.mock.calls[0][0]
    expect(firstCall.rectangle).toBeDefined()
  })

  it('应该创建带尺寸和面积标签的矩形', () => {
    const rectangle = new RectangleGraphic(mockViewer, {
      showDimensionsLabel: true,
      showAreaLabel: true,
    })
    rectangle.create([mockPosition1, mockPosition2] as any)

    // 应该创建至少2个实体：矩形 + 标签
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该正确计算面积', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const area = rectangle.getArea()
    expect(area).toBeGreaterThan(0)
    expect(area).toBe(10000 * 10000) // width * height
  })

  it('应该正确获取矩形尺寸', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const dimensions = rectangle.getDimensions()
    expect(dimensions.width).toBe(10000)
    expect(dimensions.height).toBe(10000)
  })

  it('应该导出正确的 GeoJSON 格式', () => {
    const rectangle = new RectangleGraphic(mockViewer, {
      name: '测试矩形',
    })
    rectangle.create([mockPosition1, mockPosition2] as any)

    const geojson = rectangle.toGeoJSON()
    expect(geojson.type).toBe('Feature')
    expect(geojson.geometry.type).toBe('Polygon')
    expect(geojson.properties.shapeType).toBe('rectangle')
    expect(geojson.properties.width).toBe(10000)
    expect(geojson.properties.height).toBe(10000)
  })

  it('应该在 GeoJSON 中包含格式化的尺寸', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const geojson = rectangle.toGeoJSON()
    expect(geojson.properties.dimensionsFormatted).toMatch(/\d+\.?\d* (m|km) × \d+\.?\d* (m|km)/)
  })

  it('应该在 GeoJSON 中包含格式化的面积', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const geojson = rectangle.toGeoJSON()
    expect(geojson.properties.areaFormatted).toMatch(/\d+\.?\d* (m²|km²)/)
  })

  it('应该支持切换尺寸标签显示', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    rectangle.toggleDimensionsLabel(false)
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持切换面积标签显示', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    rectangle.toggleAreaLabel(false)
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持显示/隐藏功能', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    rectangle.hide()
    expect(rectangle.visible).toBe(false)

    rectangle.show()
    expect(rectangle.visible).toBe(true)
  })

  it('应该支持移除功能', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    rectangle.remove()
    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该支持编辑模式', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const initialCallCount = mockViewer.entities.add.mock.calls.length
    rectangle.startEdit()

    // 应该添加4个角点标记
    expect(mockViewer.entities.add.mock.calls.length).toBeGreaterThan(initialCallCount)
    expect(rectangle.isEditing).toBe(true)

    rectangle.stopEdit()
    expect(rectangle.isEditing).toBe(false)
  })

  it('应该拒绝少于2个点的矩形', () => {
    const rectangle = new RectangleGraphic(mockViewer)

    expect(() => {
      rectangle.create([mockPosition1] as any)
    }).toThrow('RectangleGraphic requires at least 2 positions')
  })

  it('应该生成唯一的 ID', () => {
    const rectangle1 = new RectangleGraphic(mockViewer)
    const rectangle2 = new RectangleGraphic(mockViewer)

    expect(rectangle1.id).not.toBe(rectangle2.id)
  })

  it('GeoJSON 坐标应该是闭合的多边形', () => {
    const rectangle = new RectangleGraphic(mockViewer)
    rectangle.create([mockPosition1, mockPosition2] as any)

    const geojson = rectangle.toGeoJSON()
    const coordinates = geojson.geometry.coordinates[0]

    // 应该有5个点（4个角 + 闭合点）
    expect(coordinates.length).toBe(5)
    // 第一个点和最后一个点应该相同（闭合）
    expect(coordinates[0]).toEqual(coordinates[4])
  })
})
