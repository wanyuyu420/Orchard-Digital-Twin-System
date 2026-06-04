/**
 * Backward Compatibility Test
 *
 * 验证新架构对现有代码的向后兼容性
 * 确保旧的 API 仍然可用
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGISStore, useMeasureStore } from '@/stores/gis'
import type { Measurement } from '@/types/measure'

describe('Backward Compatibility', () => {
  beforeEach(() => {
    // 为每个测试创建新的 Pinia 实例
    setActivePinia(createPinia())
  })

  describe('useMeasureStore alias', () => {
    it('should be an alias for useGISStore', () => {
      const gisStore = useGISStore()
      const measureStore = useMeasureStore()

      // 验证是同一个 store 实例
      expect(gisStore).toBe(measureStore)
    })

    it('should expose measurements array', () => {
      const measureStore = useMeasureStore()

      expect(measureStore.measurements).toBeDefined()
      expect(Array.isArray(measureStore.measurements)).toBe(true)
      expect(measureStore.measurements.length).toBe(0)
    })
  })

  describe('Measurement API', () => {
    it('should support addMeasurement()', () => {
      const measureStore = useMeasureStore()

      const measurement: Measurement = {
        id: 'test_1',
        type: 'distance',
        distance: 100.5,
        startPoint: { longitude: 120.0, latitude: 30.0 },
        endPoint: { longitude: 120.1, latitude: 30.1 },
        createdAt: new Date(),
      }

      measureStore.addMeasurement(measurement)

      expect(measureStore.measurements.length).toBe(1)
      expect(measureStore.measurements[0].id).toBe('test_1')
      expect(measureStore.measurements[0].distance).toBe(100.5)
    })

    it('should support removeMeasurement()', () => {
      const measureStore = useMeasureStore()

      const m1: Measurement = {
        id: 'test_1',
        type: 'distance',
        distance: 100,
        startPoint: { longitude: 120.0, latitude: 30.0 },
        endPoint: { longitude: 120.1, latitude: 30.1 },
        createdAt: new Date(),
      }

      const m2: Measurement = {
        id: 'test_2',
        type: 'area',
        area: 500,
        vertices: [
          { longitude: 120.0, latitude: 30.0 },
          { longitude: 120.1, latitude: 30.0 },
          { longitude: 120.1, latitude: 30.1 },
        ],
        createdAt: new Date(),
      }

      measureStore.addMeasurement(m1)
      measureStore.addMeasurement(m2)
      expect(measureStore.measurements.length).toBe(2)

      measureStore.removeMeasurement('test_1')
      expect(measureStore.measurements.length).toBe(1)
      expect(measureStore.measurements[0].id).toBe('test_2')
    })

    it('should support clearMeasurements()', () => {
      const measureStore = useMeasureStore()

      const m1: Measurement = {
        id: 'test_1',
        type: 'distance',
        distance: 100,
        startPoint: { longitude: 120.0, latitude: 30.0 },
        endPoint: { longitude: 120.1, latitude: 30.1 },
        createdAt: new Date(),
      }

      measureStore.addMeasurement(m1)
      expect(measureStore.measurements.length).toBe(1)

      measureStore.clearMeasurements()
      expect(measureStore.measurements.length).toBe(0)
    })

    it('should support clearAll() as alias', () => {
      const measureStore = useMeasureStore()

      const m1: Measurement = {
        id: 'test_1',
        type: 'distance',
        distance: 100,
        startPoint: { longitude: 120.0, latitude: 30.0 },
        endPoint: { longitude: 120.1, latitude: 30.1 },
        createdAt: new Date(),
      }

      measureStore.addMeasurement(m1)
      expect(measureStore.measurements.length).toBe(1)

      // clearAll 应该等同于 clearMeasurements
      measureStore.clearAll()
      expect(measureStore.measurements.length).toBe(0)
    })
  })

  describe('Tool API (backward compatible)', () => {
    it('should support setTool() with null', () => {
      const measureStore = useMeasureStore()

      measureStore.setTool('measure-distance')
      expect(measureStore.toolType).toBe('measure-distance')

      measureStore.setTool(null)
      expect(measureStore.toolType).toBeNull()
    })

    it('should support setTool() with measure types', () => {
      const measureStore = useMeasureStore()

      measureStore.setTool('measure-distance')
      expect(measureStore.toolType).toBe('measure-distance')

      measureStore.setTool('measure-area')
      expect(measureStore.toolType).toBe('measure-area')
    })
  })

  describe('Mode Management', () => {
    it('should support startDrawing()', () => {
      const measureStore = useMeasureStore()

      measureStore.startDrawing()
      expect(measureStore.mode).toBe('drawing')
      expect(measureStore.isDrawing).toBe(true)
    })

    it('should support finishDrawing()', () => {
      const measureStore = useMeasureStore()

      measureStore.startDrawing()
      expect(measureStore.isDrawing).toBe(true)

      measureStore.finishDrawing()
      expect(measureStore.mode).toBe('none')
      expect(measureStore.isDrawing).toBe(false)
    })

    it('should support cancelDrawing()', () => {
      const measureStore = useMeasureStore()

      measureStore.startDrawing()
      expect(measureStore.isDrawing).toBe(true)

      measureStore.cancelDrawing()
      expect(measureStore.mode).toBe('none')
      expect(measureStore.isDrawing).toBe(false)
    })
  })

  describe('Computed Properties', () => {
    it('should expose measurementCount', () => {
      const measureStore = useMeasureStore()

      expect(measureStore.measurementCount).toBe(0)

      const m1: Measurement = {
        id: 'test_1',
        type: 'distance',
        distance: 100,
        startPoint: { longitude: 120.0, latitude: 30.0 },
        endPoint: { longitude: 120.1, latitude: 30.1 },
        createdAt: new Date(),
      }

      measureStore.addMeasurement(m1)
      expect(measureStore.measurementCount).toBe(1)
    })
  })

  describe('Settings', () => {
    it('should support snapEnabled setting', () => {
      const measureStore = useMeasureStore()

      expect(measureStore.snapEnabled).toBe(true)

      measureStore.setSnapEnabled(false)
      expect(measureStore.snapEnabled).toBe(false)
    })

    it('should support snapTolerance setting', () => {
      const measureStore = useMeasureStore()

      expect(measureStore.snapTolerance).toBe(10)

      measureStore.setSnapTolerance(15)
      expect(measureStore.snapTolerance).toBe(15)
    })
  })
})
