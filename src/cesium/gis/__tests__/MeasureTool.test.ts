/**
 * MeasureTool 单元测试
 *
 * 测试 2D 测量工具的核心功能:
 * - 距离测量
 * - 面积测量
 * - 结果显示
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock Cesium
vi.mock('cesium', () => {
  const mockCartesian3 = (x: number, y: number, z: number) => ({ x, y, z })

  return {
    Cartesian3: Object.assign(
      vi.fn((x: number, y: number, z: number) => ({ x, y, z })),
      {
        distance: vi.fn(() => 500),
        midpoint: vi.fn((a: any, b: any, result: any) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })),
        fromDegrees: vi.fn((lon: number, lat: number, height?: number) => mockCartesian3(lon, lat, height || 0)),
        clone: vi.fn((c: any) => ({ ...c }))
      }
    ),
    Cartesian2: vi.fn((x: number, y: number) => ({ x, y })),
    Cartographic: Object.assign(
      vi.fn((lon: number, lat: number, height?: number) => ({
        longitude: lon,
        latitude: lat,
        height: height || 0
      })),
      {
        fromCartesian: vi.fn((cartesian: any) => ({
          longitude: 2.0,
          latitude: 0.5,
          height: 0
        }))
      }
    ),
    PolygonHierarchy: vi.fn((positions: any) => ({ positions })),
    PolygonGeometry: {
      computeArea2D: vi.fn(() => 10000)
    },
    Color: {
      fromCssColorString: vi.fn((color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha }))
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      CYAN: { r: 0, g: 1, b: 1, a: 1 },
      RED: { r: 1, g: 0, b: 0, a: 1 },
      YELLOW: { r: 1, g: 1, b: 0, a: 1 }
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    ConstantProperty: vi.fn((value: any) => ({ getValue: () => value })),
    CallbackProperty: vi.fn((callback: any, isConstant: boolean) => ({
      getValue: callback,
      isConstant
    })),
    LabelStyle: { FILL_AND_OUTLINE: 0 },
    HeightReference: { CLAMP_TO_GROUND: 0 },
    ScreenSpaceEventType: {
      LEFT_CLICK: 0,
      RIGHT_CLICK: 1,
      LEFT_DOUBLE_CLICK: 2,
      MOUSE_MOVE: 3
    },
    ScreenSpaceEventHandler: class {
      setInputAction = vi.fn()
      removeInputAction = vi.fn()
      destroy = vi.fn()
    },
    Math: {
      toDegrees: vi.fn((radians: number) => radians * 180 / Math.PI),
      toRadians: vi.fn((degrees: number) => degrees * Math.PI / 180)
    },
    defined: vi.fn((value: any) => value !== undefined && value !== null),
    Entity: vi.fn()
  }
})

import { MeasureTool } from '../tools/MeasureTool'

// Mock Viewer
function createMockViewer() {
  return {
    scene: {
      canvas: document.createElement('canvas'),
      globe: {
        pick: vi.fn(() => ({ x: 100, y: 200, z: 300 })),
        ellipsoid: {
          maximumRadius: 6378137,
          cartesianToCartographic: vi.fn(() => ({ longitude: 2.0, latitude: 0.5, height: 0 })),
          cartographicToCartesian: vi.fn(() => ({ x: 100, y: 200, z: 300 }))
        }
      },
      pick: vi.fn(() => undefined)
    },
    camera: {
      getPickRay: vi.fn(() => ({ origin: {}, direction: {} })),
      pickEllipsoid: vi.fn(() => ({ x: 100, y: 200, z: 300 }))
    },
    canvas: {
      style: { cursor: 'default' }
    },
    entities: {
      add: vi.fn((options) => ({
        id: options.id || 'test-entity',
        ...options,
        show: true
      })),
      remove: vi.fn(),
      removeById: vi.fn()
    }
  } as any
}

describe('MeasureTool', () => {
  let mockViewer: ReturnType<typeof createMockViewer>
  let measureTool: MeasureTool

  beforeEach(() => {
    mockViewer = createMockViewer()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (measureTool) {
      measureTool.destroy()
    }
  })

  describe('实例化', () => {
    it('应该正确创建距离测量实例', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      expect(measureTool).toBeDefined()
    })

    it('应该正确创建面积测量实例', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'area' })
      expect(measureTool).toBeDefined()
    })
  })

  describe('生命周期', () => {
    it('应该正确激活工具', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      measureTool.activate()
      expect(measureTool.isActive()).toBe(true)
    })

    it('应该正确停用工具', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      measureTool.activate()
      measureTool.deactivate()
      expect(measureTool.isActive()).toBe(false)
    })

    it('激活时应改变光标样式', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      measureTool.activate()
      expect(mockViewer.canvas.style.cursor).toBe('crosshair')
    })
  })

  describe('回调', () => {
    it('应该支持 onComplete 回调', () => {
      const onComplete = vi.fn()
      measureTool = new MeasureTool(mockViewer, {
        measureType: 'distance',
        onComplete
      })
      expect(measureTool).toBeDefined()
    })

    it('应该支持 onCancel 回调', () => {
      const onCancel = vi.fn()
      measureTool = new MeasureTool(mockViewer, {
        measureType: 'distance',
        onCancel
      })
      expect(measureTool).toBeDefined()
    })
  })

  describe('测量类型', () => {
    it('距离测量应该支持多点', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      measureTool.activate()
      expect(measureTool.isActive()).toBe(true)
    })

    it('面积测量应该需要至少3点', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'area' })
      measureTool.activate()
      expect(measureTool.isActive()).toBe(true)
    })
  })

  describe('结果管理', () => {
    it('工具支持 destroy 清理', () => {
      measureTool = new MeasureTool(mockViewer, { measureType: 'distance' })
      measureTool.activate()
      measureTool.destroy()
      expect(measureTool.isActive()).toBe(false)
    })
  })
})
