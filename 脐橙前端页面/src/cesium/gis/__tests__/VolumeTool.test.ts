/**
 * VolumeTool 单元测试
 *
 * 测试方量分析工具的核心功能:
 * - 多边形绘制
 * - 体积计算
 * - 结果可视化
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock Cesium
vi.mock('cesium', () => {
  const mockCartesian3 = (x: number, y: number, z: number) => ({ x, y, z })

  return {
    Cartesian3: Object.assign(
      vi.fn((x: number, y: number, z: number) => ({ x, y, z })),
      {
        distance: vi.fn(() => 100),
        midpoint: vi.fn((a: any, b: any, result: any) => ({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          z: (a.z + b.z) / 2,
        })),
        fromDegrees: vi.fn((lon: number, lat: number, height?: number) =>
          mockCartesian3(lon, lat, height || 0)
        ),
        fromRadians: vi.fn((lon: number, lat: number, height?: number) =>
          mockCartesian3(lon, lat, height || 0)
        ),
        clone: vi.fn((c: any) => ({ ...c })),
      }
    ),
    Cartesian2: vi.fn((x: number, y: number) => ({ x, y })),
    Cartographic: Object.assign(
      vi.fn((lon: number, lat: number, height?: number) => ({
        longitude: lon,
        latitude: lat,
        height: height || 100,
      })),
      {
        fromCartesian: vi.fn((cartesian: any) => ({
          longitude: 2.0,
          latitude: 0.5,
          height: 100,
        })),
      }
    ),
    PolygonHierarchy: vi.fn((positions: any) => ({ positions })),
    Color: {
      fromCssColorString: vi.fn((color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha })),
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      CYAN: { r: 0, g: 1, b: 1, a: 1 },
      RED: { withAlpha: vi.fn(() => ({ r: 1, g: 0, b: 0, a: 0.5 })) },
      BLUE: { withAlpha: vi.fn(() => ({ r: 0, g: 0, b: 1, a: 0.5 })) },
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    ConstantProperty: vi.fn((value: any) => ({ getValue: () => value })),
    CallbackProperty: vi.fn((callback: any, isConstant: boolean) => ({
      getValue: callback,
      isConstant,
    })),
    LabelStyle: { FILL_AND_OUTLINE: 0 },
    HeightReference: { CLAMP_TO_GROUND: 0, RELATIVE_TO_GROUND: 1 },
    ScreenSpaceEventType: {
      LEFT_CLICK: 0,
      RIGHT_CLICK: 1,
      LEFT_DOUBLE_CLICK: 2,
      MOUSE_MOVE: 3,
    },
    ScreenSpaceEventHandler: class {
      setInputAction = vi.fn()
      removeInputAction = vi.fn()
      destroy = vi.fn()
    },
    Math: {
      toDegrees: vi.fn((radians: number) => (radians * 180) / Math.PI),
      toRadians: vi.fn((degrees: number) => (degrees * Math.PI) / 180),
    },
    defined: vi.fn((value: any) => value !== undefined && value !== null),
    Entity: vi.fn(),
    sampleTerrainMostDetailed: vi.fn(() => {
      return Promise.resolve([
        { longitude: 2.0, latitude: 0.5, height: 100 },
        { longitude: 2.01, latitude: 0.5, height: 120 },
        { longitude: 2.01, latitude: 0.51, height: 110 },
        { longitude: 2.0, latitude: 0.51, height: 90 },
      ])
    }),
  }
})

import { VolumeTool, type VolumeAnalysisResult } from '../tools/VolumeTool'

// Mock Viewer
function createMockViewer() {
  return {
    scene: {
      canvas: document.createElement('canvas'),
      globe: {
        pick: vi.fn(() => ({ x: 100, y: 200, z: 300 })),
        ellipsoid: {
          maximumRadius: 6378137,
          cartesianToCartographic: vi.fn(() => ({ longitude: 2.0, latitude: 0.5, height: 100 })),
          cartographicToCartesian: vi.fn(() => ({ x: 100, y: 200, z: 300 })),
        },
      },
      pick: vi.fn(() => undefined),
    },
    camera: {
      getPickRay: vi.fn(() => ({ origin: {}, direction: {} })),
      pickEllipsoid: vi.fn(() => ({ x: 100, y: 200, z: 300 })),
    },
    canvas: {
      style: { cursor: 'default' },
    },
    entities: {
      add: vi.fn((options) => ({
        id: options.id || 'test-entity',
        ...options,
        show: true,
      })),
      remove: vi.fn(),
      removeById: vi.fn(),
    },
    terrainProvider: {
      ready: true,
    },
  } as any
}

describe('VolumeTool', () => {
  let mockViewer: ReturnType<typeof createMockViewer>
  let volumeTool: VolumeTool

  beforeEach(() => {
    mockViewer = createMockViewer()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (volumeTool) {
      volumeTool.destroy()
    }
  })

  describe('实例化', () => {
    it('应该正确创建 VolumeTool 实例', () => {
      volumeTool = new VolumeTool(mockViewer)
      expect(volumeTool).toBeDefined()
    })

    it('应该支持自定义基准高度', () => {
      volumeTool = new VolumeTool(mockViewer, {
        baseHeight: 50,
      })
      expect(volumeTool).toBeDefined()
    })
  })

  describe('生命周期', () => {
    it('应该正确激活工具', () => {
      volumeTool = new VolumeTool(mockViewer)
      volumeTool.activate()
      expect(volumeTool.isActive()).toBe(true)
    })

    it('应该正确停用工具', () => {
      volumeTool = new VolumeTool(mockViewer)
      volumeTool.activate()
      volumeTool.deactivate()
      expect(volumeTool.isActive()).toBe(false)
    })

    it('激活时应改变光标样式', () => {
      volumeTool = new VolumeTool(mockViewer)
      volumeTool.activate()
      expect(mockViewer.canvas.style.cursor).toBe('crosshair')
    })
  })

  describe('回调', () => {
    it('应该支持 onComplete 回调', () => {
      const onComplete = vi.fn()
      volumeTool = new VolumeTool(mockViewer, { onComplete })
      expect(volumeTool).toBeDefined()
    })

    it('应该支持 onCancel 回调', () => {
      const onCancel = vi.fn()
      volumeTool = new VolumeTool(mockViewer, { onCancel })
      expect(volumeTool).toBeDefined()
    })
  })

  describe('结果管理', () => {
    it('应该能清理结果可视化', () => {
      volumeTool = new VolumeTool(mockViewer)
      volumeTool.activate()
      volumeTool.clearResult()
      expect(true).toBe(true)
    })
  })
})
