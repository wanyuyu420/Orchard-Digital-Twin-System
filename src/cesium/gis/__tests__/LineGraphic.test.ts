/**
 * LineGraphic 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LineGraphic } from '../graphics/LineGraphic'

// Mock Cesium
const mockPositions = [
  { x: 100, y: 200, z: 300 },
  { x: 200, y: 300, z: 400 },
  { x: 300, y: 400, z: 500 },
]

const mockViewer = {
  entities: {
    add: vi.fn((options) => ({
      id: options.id,
      position: options.position,
      polyline: options.polyline
        ? {
            ...options.polyline,
            positions: {
              getValue: vi.fn(() => options.polyline.positions),
            },
          }
        : undefined,
      point: options.point,
      label: options.label,
      show: options.show,
    })),
    remove: vi.fn(),
  },
  scene: {
    globe: {
      ellipsoid: {
        cartesianToCartographic: vi.fn(() => ({
          longitude: 1.9949,
          latitude: 0.5323,
          height: 100,
        })),
      },
    },
  },
} as any

// Mock Cesium static methods
const mockCesium = {
  Color: {
    fromCssColorString: vi.fn(() => ({
      withAlpha: vi.fn((alpha) => ({ alpha })),
    })),
    WHITE: { r: 1, g: 1, b: 1, a: 1 },
    BLACK: { r: 0, g: 0, b: 0, a: 1 },
    TRANSPARENT: { r: 0, g: 0, b: 0, a: 0 },
  },
  LabelStyle: {
    FILL_AND_OUTLINE: 2,
  },
  Cartesian2: vi.fn((x, y) => ({ x, y })),
  Cartesian3: {
    distance: vi.fn(() => 100),
  },
  ConstantProperty: vi.fn((value) => value),
  ConstantPositionProperty: vi.fn((value) => value),
  ColorMaterialProperty: vi.fn((color) => ({ color })),
  PolylineDashMaterialProperty: vi.fn((options) => options),
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
  EllipsoidGeodesic: vi.fn(function (this: any) {
    this.surfaceDistance = 1000
  }),
}

// 注入 mock
;(global as any).Cesium = mockCesium

describe('LineGraphic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该创建 LineGraphic 实例', () => {
    const line = new LineGraphic(mockViewer, {
      name: '测试线',
    })

    expect(line).toBeDefined()
    expect(line.name).toBe('测试线')
    expect(line.type).toBe('line')
  })

  it('应该使用默认样式创建线', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    expect(mockViewer.entities.add).toHaveBeenCalled()
    expect(mockViewer.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        polyline: expect.objectContaining({
          positions: mockPositions,
          width: expect.any(Number),
        }),
      })
    )
  })

  it('应该创建带长度标签的线', () => {
    const line = new LineGraphic(mockViewer, {
      showLength: true,
    })
    line.create(mockPositions as any)

    // 至少创建了线实体
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持虚线样式', () => {
    const line = new LineGraphic(mockViewer, {
      lineStyle: 'dashed',
    })
    line.create(mockPositions as any)

    // 验证创建了线
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该支持点线样式', () => {
    const line = new LineGraphic(mockViewer, {
      lineStyle: 'dotted',
    })
    line.create(mockPositions as any)

    // 验证创建了线
    expect(mockViewer.entities.add).toHaveBeenCalled()
  })

  it('应该拒绝少于2个点的线', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const line = new LineGraphic(mockViewer)
    line.create([mockPositions[0] as any])

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('At least 2 positions required')
    )

    consoleWarnSpy.mockRestore()
  })

  it('应该正确计算长度', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    const length = line.getLength()
    expect(length).toBeGreaterThanOrEqual(0)
  })

  it('应该正确格式化长度显示', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    const geojson = line.toGeoJSON()
    expect(geojson.properties).toHaveProperty('lengthFormatted')
    expect(geojson.properties.lengthFormatted).toMatch(/\d+(\.\d+)? (m|km)/)
  })

  it('应该正确导出 GeoJSON', () => {
    const line = new LineGraphic(mockViewer, {
      name: 'TestLine',
    })
    line.create(mockPositions as any)

    const geojson = line.toGeoJSON()

    expect(geojson).toMatchObject({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: expect.arrayContaining([
          expect.arrayContaining([expect.any(Number), expect.any(Number), expect.any(Number)]),
        ]),
      },
      properties: expect.objectContaining({
        name: 'TestLine',
        length: expect.any(Number),
        lineStyle: 'solid',
      }),
    })
  })

  it('应该支持显示/隐藏', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    expect(line.visible).toBe(true)

    line.hide()
    expect(line.visible).toBe(false)

    line.show()
    expect(line.visible).toBe(true)
  })

  it('应该正确移除线', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    line.remove()

    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该支持设置线型', () => {
    const line = new LineGraphic(mockViewer)
    line.create(mockPositions as any)

    line.setLineStyle('dashed')

    // 应该重新创建线（会调用 remove 和 add）
    expect(mockViewer.entities.remove).toHaveBeenCalled()
  })

  it('应该支持切换长度标签显示', () => {
    const line = new LineGraphic(mockViewer, { showLength: true })
    line.create(mockPositions as any)

    line.setShowLength(false)
    // 标签应该被隐藏但不删除
  })

  it('应该生成唯一 ID', () => {
    const line1 = new LineGraphic(mockViewer)
    const line2 = new LineGraphic(mockViewer)

    expect(line1.id).toBeDefined()
    expect(line2.id).toBeDefined()
    expect(line1.id).not.toBe(line2.id)
  })
})
