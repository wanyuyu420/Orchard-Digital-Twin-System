import { describe, it, expect } from 'vitest'
import { normalizeToClosedRing, growthIndexToHealth } from '@/utils/spatial'

describe('normalizeToClosedRing', () => {
  it('rectangle 两点对角 → 4 角 bbox 闭合环（5 点）', () => {
    // PoiDrawToolbar 路径：RectangleGraphic.getPositions() 只给 SW+NE 两个对角点
    const ring = normalizeToClosedRing({
      type: 'rectangle',
      coordinates: [
        [116.499764, 27.128822],
        [116.500098, 27.128869],
      ],
    })
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual([116.499764, 27.128822])
    expect(ring[1]).toEqual([116.500098, 27.128822])
    expect(ring[2]).toEqual([116.500098, 27.128869])
    expect(ring[3]).toEqual([116.499764, 27.128869])
    // 首尾闭合
    expect(ring[4]).toEqual(ring[0])
  })

  it('rectangle 四点有序角 → 相同 bbox 闭合环', () => {
    // GISLayer 路径：featureToSidebarCoords 给 4 个有序角
    const ring = normalizeToClosedRing({
      type: 'rectangle',
      coordinates: [
        [116.499764, 27.128822],
        [116.500098, 27.128822],
        [116.500098, 27.128869],
        [116.499764, 27.128869],
      ],
    })
    expect(ring).toHaveLength(5)
    expect(ring[0][0]).toBeCloseTo(116.499764)
    expect(ring[0][1]).toBeCloseTo(27.128822)
    expect(ring[ring.length - 1]).toEqual(ring[0])
  })

  it('polygon 包裹 + 已闭合 → 解包为平铺闭合环', () => {
    const ring = normalizeToClosedRing({
      type: 'polygon',
      coordinates: [
        [
          [116.5, 27.12],
          [116.51, 27.12],
          [116.51, 27.13],
          [116.5, 27.12],
        ],
      ],
    })
    expect(ring).toHaveLength(4)
    expect(ring[0]).toEqual([116.5, 27.12])
    expect(ring[ring.length - 1]).toEqual([116.5, 27.12])
  })

  it('polygon 平铺 + 开环 → 自动闭合', () => {
    const ring = normalizeToClosedRing({
      type: 'polygon',
      coordinates: [
        [116.5, 27.12],
        [116.51, 27.12],
        [116.51, 27.13],
      ],
    })
    expect(ring).toHaveLength(4)
    expect(ring[3]).toEqual([116.5, 27.12])
  })

  it('circle 显式半径 → 24 段 25 点闭合环', () => {
    const ring = normalizeToClosedRing({
      type: 'circle',
      coordinates: [[116.5, 27.12]],
      radius: 100,
    })
    expect(ring).toHaveLength(25)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    // 中心点到环上点距离 ≈ 半径（经度需乘 cos(纬度) 换算成米）
    const latRad = (27.12 * Math.PI) / 180
    const metersPerDegLng = 111320 * Math.cos(latRad)
    const dx = ring[0][0] - 116.5
    const dy = ring[0][1] - 27.12
    expect(Math.hypot(dx * metersPerDegLng, dy * 110540)).toBeCloseTo(100, 0)
  })

  it('circle 两点坐标（中心+边缘）→ 用 haversine 恢复半径，不抛错', () => {
    const ring = normalizeToClosedRing({
      type: 'circle',
      coordinates: [
        [116.5, 27.12],
        [116.501, 27.12], // 东侧约 111m
      ],
    })
    expect(ring).toHaveLength(25)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('circle 仅中心点且无半径 → 抛错', () => {
    expect(() =>
      normalizeToClosedRing({
        type: 'circle',
        coordinates: [[116.5, 27.12]],
      }),
    ).toThrow('无法获取圆形查询半径')
  })
})

describe('growthIndexToHealth', () => {
  it('边界阈值', () => {
    expect(growthIndexToHealth(0.8)).toBe('healthy')
    expect(growthIndexToHealth(0.7)).toBe('healthy')
    expect(growthIndexToHealth(0.6)).toBe('warning')
    expect(growthIndexToHealth(0.4)).toBe('warning')
    expect(growthIndexToHealth(0.3)).toBe('critical')
  })

  it('null / undefined → warning', () => {
    expect(growthIndexToHealth(null)).toBe('warning')
    expect(growthIndexToHealth(undefined)).toBe('warning')
  })
})
