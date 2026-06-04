/**
 * PointGraphic 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PointGraphic } from '../graphics/PointGraphic'

// Mock Cesium
const mockViewer = {
  entities: {
    add: vi.fn((options) => ({
      id: options.id,
      position: {
        getValue: vi.fn(() => mockCartesian3),
      },
      point: options.point,
      billboard: options.billboard,
      label: options.label,
      show: options.show,
    })),
    remove: vi.fn(),
  },
} as any

const mockCartesian3 = {
  x: 100,
  y: 200,
  z: 300,
  clone: vi.fn(),
  equals: vi.fn(),
  equalsEpsilon: vi.fn(),
}

// Mock Cesium static methods
const mockCesium = {
  Color: {
    fromCssColorString: vi.fn(() => ({
      withAlpha: vi.fn((alpha) => ({ alpha })),
    })),
    WHITE: { r: 1, g: 1, b: 1, a: 1 },
    BLACK: { r: 0, g: 0, b: 0, a: 1 },
  },
  VerticalOrigin: {
    BOTTOM: 1,
    CENTER: 0,
  },
  HorizontalOrigin: {
    CENTER: 0,
  },
  LabelStyle: {
    FILL_AND_OUTLINE: 2,
  },
  Cartesian2: vi.fn((x, y) => ({ x, y })),
  ConstantProperty: vi.fn((value) => value),
  ConstantPositionProperty: vi.fn((value) => value),
  JulianDate: {
    now: vi.fn(() => ({})),
  },
  Cartographic: {
    fromCartesian: vi.fn(() => ({
      longitude: 1.9949,
      latitude: 0.5323,
      height: 100,
    })),
  },
  Math: {
    toDegrees: vi.fn((rad) => rad * 57.2958),
  },
}

// 注入 mock
;(global as any).Cesium = mockCesium

describe('PointGraphic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该创建 PointGraphic 实例', () => {
    const point = new PointGraphic(mockViewer, {
      name: '测试点',
    })

    expect(point).toBeDefined()
    expect(point.name).toBe('测试点')
    expect(point.type).toBe('point')
  })

  it('应该使用默认样式创建点', () => {
    const point = new PointGraphic(mockViewer)
    point.create([mockCartesian3])

    expect(mockViewer.entities.add).toHaveBeenCalledTimes(1)
    expect(mockViewer.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        position: mockCartesian3,
        point: expect.objectContaining({
          pixelSize: expect.any(Number),
        }),
      })
    )
  })

  it('应该创建带标签的点', () => {
    const point = new PointGraphic(mockViewer, {
      label: '水位站A',
    })
    point.create([mockCartesian3])

    expect(mockViewer.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        label: expect.objectContaining({
          text: '水位站A',
        }),
      })
    )
  })

  it('应该创建带图标的点（billboard）', () => {
    const point = new PointGraphic(mockViewer, {
      icon: 'marker.png',
    })
    point.create([mockCartesian3])

    expect(mockViewer.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        billboard: expect.objectContaining({
          image: 'marker.png',
        }),
      })
    )
  })

  it('应该正确导出 GeoJSON', () => {
    const point = new PointGraphic(mockViewer, {
      name: 'TestPoint',
      label: 'Label',
    })
    point.create([mockCartesian3])

    const geojson = point.toGeoJSON()

    expect(geojson).toMatchObject({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]),
      },
      properties: expect.objectContaining({
        name: 'TestPoint',
        label: 'Label',
      }),
    })
  })

  it('应该支持显示/隐藏', () => {
    const point = new PointGraphic(mockViewer)
    point.create([mockCartesian3])

    expect(point.visible).toBe(true)

    point.hide()
    expect(point.visible).toBe(false)

    point.show()
    expect(point.visible).toBe(true)
  })

  it('应该正确移除点', () => {
    const point = new PointGraphic(mockViewer)
    point.create([mockCartesian3])

    point.remove()

    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该生成唯一 ID', () => {
    const point1 = new PointGraphic(mockViewer)
    const point2 = new PointGraphic(mockViewer)

    expect(point1.id).toBeDefined()
    expect(point2.id).toBeDefined()
    expect(point1.id).not.toBe(point2.id)
  })
})
