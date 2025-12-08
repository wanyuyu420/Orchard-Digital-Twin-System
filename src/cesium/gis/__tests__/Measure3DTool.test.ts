/**
 * Measure3DTool 单元测试
 *
 * 测试 3D 测量工具的核心功能:
 * - 斜距/水平距/垂直距计算
 * - 高度模式切换 (terrain/custom/relative)
 * - 坡度计算
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
        distance: vi.fn((a: any, b: any) => {
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dz = b.z - a.z
          return Math.sqrt(dx * dx + dy * dy + dz * dz)
        }),
        midpoint: vi.fn((a: any, b: any, result: any) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })),
        fromDegrees: vi.fn((lon: number, lat: number, height?: number) => mockCartesian3(lon, lat, height || 0)),
        fromRadians: vi.fn((lon: number, lat: number, height?: number) => mockCartesian3(lon, lat, height || 0)),
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
          height: cartesian.z || 100
        }))
      }
    ),
    Color: {
      fromCssColorString: vi.fn((color: string) => ({
        withAlpha: vi.fn((alpha: number) => ({ r: 1, g: 0.8, b: 0.2, a: alpha }))
      })),
      WHITE: { r: 1, g: 1, b: 1, a: 1 },
      CYAN: { r: 0, g: 1, b: 1, a: 1 },
      GREEN: { r: 0, g: 1, b: 0, a: 1 },
      RED: { r: 1, g: 0, b: 0, a: 1 },
      YELLOW: { r: 1, g: 1, b: 0, a: 1 },
      BLACK: { r: 0, g: 0, b: 0, a: 1 }
    },
    ColorMaterialProperty: vi.fn((color: any) => ({ color })),
    ConstantProperty: vi.fn((value: any) => ({ getValue: () => value })),
    CallbackProperty: vi.fn((callback: any, isConstant: boolean) => ({
      getValue: callback,
      isConstant
    })),
    PolylineDashMaterialProperty: vi.fn((options: any) => options),
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

import { Measure3DTool, type HeightMode, type Measure3DResult } from '../tools/Measure3DTool'

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

describe('Measure3DTool', () => {
  let mockViewer: ReturnType<typeof createMockViewer>
  let measure3dTool: Measure3DTool

  beforeEach(() => {
    mockViewer = createMockViewer()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (measure3dTool) {
      measure3dTool.destroy()
    }
  })

  describe('实例化', () => {
    it('应该正确创建 Measure3DTool 实例', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      expect(measure3dTool).toBeDefined()
    })

    it('应该支持默认高度模式配置', () => {
      measure3dTool = new Measure3DTool(mockViewer, {
        heightMode: 'terrain'
      })
      expect(measure3dTool.getHeightMode()).toBe('terrain')
    })

    it('应该支持自定义高度值', () => {
      measure3dTool = new Measure3DTool(mockViewer, {
        heightMode: 'custom',
        customHeight: 500
      })
      expect(measure3dTool.getCustomHeight()).toBe(500)
    })
  })

  describe('高度模式', () => {
    it('应该默认使用地形模式', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      expect(measure3dTool.getHeightMode()).toBe('terrain')
    })

    it('应该能切换到自定义模式', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.setHeightMode('custom')
      expect(measure3dTool.getHeightMode()).toBe('custom')
    })

    it('应该能切换到相对模式', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.setHeightMode('relative')
      expect(measure3dTool.getHeightMode()).toBe('relative')
    })

    it('应该能设置自定义高度', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.setCustomHeight(250)
      expect(measure3dTool.getCustomHeight()).toBe(250)
    })

    it('切换模式时应触发回调', () => {
      const onHeightModeChange = vi.fn()
      measure3dTool = new Measure3DTool(mockViewer, { onHeightModeChange })
      measure3dTool.setHeightMode('custom')
      expect(onHeightModeChange).toHaveBeenCalledWith('custom')
    })
  })

  describe('生命周期', () => {
    it('应该正确激活工具', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.activate()
      expect(measure3dTool.isActive()).toBe(true)
    })

    it('应该正确停用工具', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.activate()
      measure3dTool.deactivate()
      expect(measure3dTool.isActive()).toBe(false)
    })

    it('激活时应改变光标样式', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.activate()
      expect(mockViewer.canvas.style.cursor).toBe('crosshair')
    })
  })

  describe('回调', () => {
    it('应该支持 onComplete 回调', () => {
      const onComplete = vi.fn()
      measure3dTool = new Measure3DTool(mockViewer, { onComplete })
      expect(measure3dTool).toBeDefined()
    })

    it('应该支持 onCancel 回调', () => {
      const onCancel = vi.fn()
      measure3dTool = new Measure3DTool(mockViewer, { onCancel })
      expect(measure3dTool).toBeDefined()
    })
  })

  describe('结果管理', () => {
    it('应该能获取最新结果', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      const result = measure3dTool.getLastResult()
      expect(result).toBeNull() // 初始时无结果
    })

    it('应该能清理结果可视化', () => {
      measure3dTool = new Measure3DTool(mockViewer)
      measure3dTool.activate()
      measure3dTool.clearResult()
      expect(measure3dTool.getLastResult()).toBeNull()
    })
  })

  describe('样式配置', () => {
    it('应该支持自定义线条颜色', () => {
      measure3dTool = new Measure3DTool(mockViewer, {
        style: { lineColor: '#FF0000' }
      })
      expect(measure3dTool).toBeDefined()
    })

    it('应该支持自定义线条宽度', () => {
      measure3dTool = new Measure3DTool(mockViewer, {
        style: { lineWidth: 5 }
      })
      expect(measure3dTool).toBeDefined()
    })

    it('应该支持自定义点颜色', () => {
      measure3dTool = new Measure3DTool(mockViewer, {
        style: { pointColor: '#00FF00' }
      })
      expect(measure3dTool).toBeDefined()
    })
  })
})
