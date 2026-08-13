/**
 * spatial.ts - 空间查询坐标归一化纯函数
 *
 * 前端拉框（矩形/圆形/多边形）会产出多种坐标形状（见 PoiDrawToolbar.vue 与
 * GISLayer.vue 的 featureToSidebarCoords），而后端 /orange/spatial-diagnose
 * 只接受"闭合平铺 [[lng,lat],...]" 的多边形环。本模块把所有输入形状归一化为
 * 满足后端校验（≥4 点、首尾闭合）的环，且不依赖 Cesium，便于单测。
 */

export type HealthStatus = 'healthy' | 'warning' | 'critical'

export interface SpatialRangeInput {
  type: 'rectangle' | 'circle' | 'polygon'
  /** 任意来源的坐标：平铺 [[lng,lat],...] 或多边形包裹 [[[lng,lat],...]] */
  coordinates: any
  /** 圆形半径（米），可选；缺省时尝试从两点坐标恢复 */
  radius?: number
}

const EARTH_RADIUS = 6378137 // 与 CircleGraphic 的 ellipsoid.maximumRadius 一致

/** 解包被包裹的多边形环：[[[lng,lat],...]] → [[lng,lat],...] */
function flattenRing(coords: any): number[][] {
  if (Array.isArray(coords?.[0]?.[0])) return coords[0]
  return coords
}

/** 保证首尾顶点一致（闭合） */
function closeRing(ring: number[][]): number[][] {
  if (!ring.length) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return ring
  return [...ring, [first[0], first[1]]]
}

/** 等距圆柱近似生成圆的闭合环（镜像 CircleGraphic 的画圆公式） */
function circleRing(center: [number, number], radiusMeters: number, segments = 24): number[][] {
  const [clng, clat] = center
  const clatRad = (clat * Math.PI) / 180
  const d = (radiusMeters / EARTH_RADIUS) * (180 / Math.PI) // 纬度方向角距（度）
  return Array.from({ length: segments }, (_, i) => {
    const theta = (2 * Math.PI * i) / segments
    return [
      clng + (d * Math.cos(theta)) / Math.max(Math.cos(clatRad), 1e-6),
      clat + d * Math.sin(theta),
    ]
  })
}

/** 球面大圆距离（米），用于从 中心+边缘点 恢复圆半径 */
function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const s =
    sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(s))
}

/** 生长指数 → 健康状态，镜像后端 growth_index_to_status（schemas/orange.py） */
export function growthIndexToHealth(index: number | null | undefined): HealthStatus {
  if (index == null) return 'warning'
  if (index >= 0.7) return 'healthy'
  if (index >= 0.4) return 'warning'
  return 'critical'
}

/**
 * 把任意拉框形状归一化为闭合平铺环 [[lng,lat],...]
 * - rectangle：对全部输入点取 min/max 构造 4 角 bbox 环（兼容 2 对角点 / 4 有序角）
 * - circle：半径优先取 range.radius，否则用 中心+边缘点 两点 haversine 恢复；取不到则抛错
 * - polygon：解包（若包裹）+ 闭合（若开环）
 *
 * @throws 圆形无法解析半径时抛错（不伪造小框，避免误导性结果）
 */
export function normalizeToClosedRing(range: SpatialRangeInput): number[][] {
  const flat = flattenRing(range.coordinates)

  if (range.type === 'rectangle') {
    const lngs = flat.map((p) => p[0])
    const lats = flat.map((p) => p[1])
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    return closeRing([
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
    ])
  }

  if (range.type === 'circle') {
    const center: [number, number] = [flat[0][0], flat[0][1]]
    let r = range.radius
    if (!r || r <= 0) {
      if (flat.length >= 2) {
        r = haversineMeters(center, [flat[1][0], flat[1][1]])
      }
    }
    if (!r || r <= 0) {
      throw new Error('无法获取圆形查询半径，请重新绘制选择范围')
    }
    return closeRing(circleRing(center, r))
  }

  // polygon：解包（若包裹）+ 闭合（若开环）
  return closeRing(flat)
}
