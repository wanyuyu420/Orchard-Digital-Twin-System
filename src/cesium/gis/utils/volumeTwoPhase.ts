import * as Cesium from 'cesium'

export interface VolumeDiffHistogramBin {
  start: number
  end: number
  center: number
  count: number
}

export interface VolumeTwoPhaseDiffMeta {
  requestedSpacingMeters: number
  effectiveSpacingMeters: number
  cellArea: number
  sampleCount: number
  minDiff: number
  maxDiff: number
  meanDiff: number
  histogram: VolumeDiffHistogramBin[]
}

export interface VolumeTwoPhaseDiffResult {
  area: number
  fillVolume: number
  cutVolume: number
  netVolume: number
  absVolume: number
  minHeight: number
  maxHeight: number
  diff: VolumeTwoPhaseDiffMeta
}

export interface ComputeTwoPhaseVolumeDiffOptions {
  /** 网格间距（米） */
  spacingMeters?: number
  /** 最大采样点数（防卡顿） */
  maxPoints?: number
  /** 直方图 bin 数 */
  histogramBins?: number
  /** 自定义二期面：基于局部 ENU 坐标 (m) 与一期高程 (m) 生成二期高程 (m) */
  surfaceB?: (args: { x: number; y: number; heightA: number }) => number
}

export type VolumeSurfaceB =
  | {
      kind: 'terrain'
      provider: Cesium.TerrainProvider
      name?: string
    }
  | {
      kind: 'function'
      name?: string
      fn: (args: {
        x: number
        y: number
        heightA: number
        cartographic: Cesium.Cartographic
      }) => number
    }

export interface ComputeTwoSurfaceVolumeDiffOptions {
  spacingMeters?: number
  maxPoints?: number
  histogramBins?: number
  surfaceA: {
    provider: Cesium.TerrainProvider
    name?: string
  }
  surfaceB: VolumeSurfaceB
  /** 返回采样点用于可视化（谨慎开启：可能较大） */
  returnSamples?: boolean
}

export interface VolumeDiffSamplePoint {
  cartographic: Cesium.Cartographic
  /** 局部 ENU X（m），相对 AOI 中心 */
  x: number
  /** 局部 ENU Y（m），相对 AOI 中心 */
  y: number
  diff: number
  heightA: number
  heightB: number
}

function isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function defaultSimulatedSurfaceB(args: { x: number; y: number; heightA: number }): number {
  const { x, y, heightA } = args

  // 组合一个“既有填方也有挖方”的扰动场（单位：m）
  const wave = 2.0 * Math.sin(x / 120.0) * Math.cos(y / 140.0)

  // 正向隆起
  const bump = 3.5 * Math.exp(-((x - 120) * (x - 120) + (y + 40) * (y + 40)) / (2 * 170 * 170))

  // 负向凹陷
  const hole = -2.8 * Math.exp(-((x + 140) * (x + 140) + (y - 60) * (y - 60)) / (2 * 210 * 210))

  const delta = wave + bump + hole
  return heightA + delta
}

async function sampleHeightsForCartographics(
  viewer: Cesium.Viewer,
  cartographics: Cesium.Cartographic[],
  provider: Cesium.TerrainProvider
): Promise<number[]> {
  // Ellipsoid: treat as 0m terrain (avoids sampleTerrain errors)
  if ((provider as any)?.constructor?.name === 'EllipsoidTerrainProvider') {
    return cartographics.map(() => 0)
  }

  // 1) Best effort: MostDetailed (requires tile availability)
  try {
    const availability = (provider as any)?.availability
    if (availability) {
      const updated = await Cesium.sampleTerrainMostDetailed(provider, cartographics)
      return updated.map((c) => c.height ?? 0)
    }
  } catch (e) {
    // Fall through to lower-fidelity options
    // (Common case: EllipsoidTerrainProvider / providers without availability)
    void e
  }

  // 2) Fallback: sampleTerrain with a reasonable fixed level
  try {
    const updated = await Cesium.sampleTerrain(provider, 12, cartographics)
    return updated.map((c) => c.height ?? 0)
  } catch (e) {
    void e
  }

  // 3) Last resort: globe.getHeight (may return undefined if no terrain)
  // 注意：这里是“兜底”，并不保证与 provider 一致；仅用于避免崩溃。
  return cartographics.map((c) => viewer.scene.globe.getHeight(c) ?? c.height ?? 0)
}

export async function computeTwoSurfaceVolumeDiff(
  viewer: Cesium.Viewer,
  polygonPositions: Cesium.Cartesian3[],
  options: ComputeTwoSurfaceVolumeDiffOptions
): Promise<{ result: VolumeTwoPhaseDiffResult; samples?: VolumeDiffSamplePoint[] }> {
  const spacingMeters = options.spacingMeters ?? 30
  const maxPoints = options.maxPoints ?? 4000
  const histogramBins = options.histogramBins ?? 24

  if (polygonPositions.length < 3) {
    throw new Error('AOI 顶点不足（需要至少3个点）')
  }

  const ellipsoid = Cesium.Ellipsoid.WGS84
  const center = Cesium.BoundingSphere.fromPoints(polygonPositions).center
  const originOnSurface = ellipsoid.scaleToGeodeticSurface(center, new Cesium.Cartesian3())
  if (!originOnSurface) {
    throw new Error('无法在椭球面上定位 AOI（originOnSurface 为空）')
  }

  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originOnSurface)
  const invEnu = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())

  const polygon2D: Array<{ x: number; y: number }> = polygonPositions.map((p) => {
    const local = Cesium.Matrix4.multiplyByPoint(invEnu, p, new Cesium.Cartesian3())
    return { x: local.x, y: local.y }
  })

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of polygon2D) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)
  if (width === 0 || height === 0) {
    throw new Error('AOI 边界无效（宽或高为0）')
  }

  const approxCount = Math.ceil(width / spacingMeters) * Math.ceil(height / spacingMeters)
  const effectiveSpacingMeters =
    approxCount > maxPoints
      ? spacingMeters * Math.sqrt(approxCount / Math.max(1, maxPoints))
      : spacingMeters
  const cellArea = effectiveSpacingMeters * effectiveSpacingMeters

  const cartographics: Cesium.Cartographic[] = []
  const localXY: Array<{ x: number; y: number }> = []

  for (let x = minX; x <= maxX; x += effectiveSpacingMeters) {
    for (let y = minY; y <= maxY; y += effectiveSpacingMeters) {
      const px = x + effectiveSpacingMeters / 2
      const py = y + effectiveSpacingMeters / 2
      if (!isPointInPolygon(px, py, polygon2D)) continue

      const world = Cesium.Matrix4.multiplyByPoint(
        enu,
        new Cesium.Cartesian3(px, py, 0),
        new Cesium.Cartesian3()
      )
      cartographics.push(Cesium.Cartographic.fromCartesian(world))
      localXY.push({ x: px, y: py })

      if (cartographics.length >= maxPoints) break
    }
    if (cartographics.length >= maxPoints) break
  }

  if (cartographics.length === 0) {
    throw new Error('AOI 内未生成有效采样点（可能过小或不在当前场景范围内）')
  }

  const heightsA = await sampleHeightsForCartographics(viewer, cartographics, options.surfaceA.provider)

  let heightsB: number[] | null = null
  if (options.surfaceB.kind === 'terrain') {
    heightsB = await sampleHeightsForCartographics(viewer, cartographics, options.surfaceB.provider)
  }

  let fillVolume = 0
  let cutVolume = 0
  let minHeight = Number.POSITIVE_INFINITY
  let maxHeight = Number.NEGATIVE_INFINITY

  const diffs: number[] = []
  let minDiff = Number.POSITIVE_INFINITY
  let maxDiff = Number.NEGATIVE_INFINITY
  let sumDiff = 0

  const samples: VolumeDiffSamplePoint[] = []

  for (let i = 0; i < heightsA.length; i++) {
    const heightA = heightsA[i] ?? 0
    const heightB =
      options.surfaceB.kind === 'terrain'
        ? (heightsB?.[i] ?? heightA)
        : options.surfaceB.fn({
            x: localXY[i].x,
            y: localXY[i].y,
            heightA,
            cartographic: cartographics[i],
          })

    const diff = heightB - heightA

    diffs.push(diff)
    minDiff = Math.min(minDiff, diff)
    maxDiff = Math.max(maxDiff, diff)
    sumDiff += diff

    minHeight = Math.min(minHeight, heightA)
    maxHeight = Math.max(maxHeight, heightA)

    if (diff >= 0) {
      fillVolume += diff * cellArea
    } else {
      cutVolume += -diff * cellArea
    }

    if (options.returnSamples) {
      samples.push({
        cartographic: cartographics[i],
        x: localXY[i].x,
        y: localXY[i].y,
        diff,
        heightA,
        heightB,
      })
    }
  }

  const sampleCount = diffs.length
  const meanDiff = sumDiff / Math.max(1, sampleCount)
  const netVolume = fillVolume - cutVolume
  const absVolume = fillVolume + cutVolume
  const area = sampleCount * cellArea

  // 直方图
  let rangeMin = minDiff
  let rangeMax = maxDiff
  if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
    rangeMin = -1
    rangeMax = 1
  }
  if (rangeMin === rangeMax) {
    rangeMin -= 1
    rangeMax += 1
  }

  const bins = Math.max(6, Math.min(60, histogramBins))
  const binSize = (rangeMax - rangeMin) / bins

  const counts = new Array<number>(bins).fill(0)
  for (const d of diffs) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((d - rangeMin) / binSize)))
    counts[idx]++
  }

  const histogram: VolumeDiffHistogramBin[] = counts.map((count, idx) => {
    const start = rangeMin + idx * binSize
    const end = start + binSize
    return {
      start,
      end,
      center: (start + end) / 2,
      count,
    }
  })

  const result: VolumeTwoPhaseDiffResult = {
    area,
    fillVolume,
    cutVolume,
    netVolume,
    absVolume,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
    diff: {
      requestedSpacingMeters: spacingMeters,
      effectiveSpacingMeters,
      cellArea,
      sampleCount,
      minDiff,
      maxDiff,
      meanDiff,
      histogram,
    },
  }

  return {
    result,
    samples: options.returnSamples ? samples : undefined,
  }
}

export async function computeTwoPhaseVolumeDiff(
  viewer: Cesium.Viewer,
  polygonPositions: Cesium.Cartesian3[],
  options: ComputeTwoPhaseVolumeDiffOptions = {}
): Promise<VolumeTwoPhaseDiffResult> {
  const spacingMeters = options.spacingMeters ?? 30
  const maxPoints = options.maxPoints ?? 4000
  const histogramBins = options.histogramBins ?? 24
  const surfaceB = options.surfaceB ?? defaultSimulatedSurfaceB

  if (polygonPositions.length < 3) {
    throw new Error('AOI 顶点不足（需要至少3个点）')
  }

  const ellipsoid = Cesium.Ellipsoid.WGS84
  const center = Cesium.BoundingSphere.fromPoints(polygonPositions).center
  const originOnSurface = ellipsoid.scaleToGeodeticSurface(center, new Cesium.Cartesian3())
  if (!originOnSurface) {
    throw new Error('无法在椭球面上定位 AOI（originOnSurface 为空）')
  }

  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originOnSurface)
  const invEnu = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())

  const polygon2D: Array<{ x: number; y: number }> = polygonPositions.map((p) => {
    const local = Cesium.Matrix4.multiplyByPoint(invEnu, p, new Cesium.Cartesian3())
    return { x: local.x, y: local.y }
  })

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of polygon2D) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)
  if (width === 0 || height === 0) {
    throw new Error('AOI 边界无效（宽或高为0）')
  }

  const approxCount = Math.ceil(width / spacingMeters) * Math.ceil(height / spacingMeters)
  const effectiveSpacingMeters =
    approxCount > maxPoints
      ? spacingMeters * Math.sqrt(approxCount / Math.max(1, maxPoints))
      : spacingMeters
  const cellArea = effectiveSpacingMeters * effectiveSpacingMeters

  const cartographics: Cesium.Cartographic[] = []
  const localXY: Array<{ x: number; y: number }> = []

  for (let x = minX; x <= maxX; x += effectiveSpacingMeters) {
    for (let y = minY; y <= maxY; y += effectiveSpacingMeters) {
      const px = x + effectiveSpacingMeters / 2
      const py = y + effectiveSpacingMeters / 2
      if (!isPointInPolygon(px, py, polygon2D)) continue

      const world = Cesium.Matrix4.multiplyByPoint(
        enu,
        new Cesium.Cartesian3(px, py, 0),
        new Cesium.Cartesian3()
      )
      cartographics.push(Cesium.Cartographic.fromCartesian(world))
      localXY.push({ x: px, y: py })

      if (cartographics.length >= maxPoints) break
    }
    if (cartographics.length >= maxPoints) break
  }

  if (cartographics.length === 0) {
    throw new Error('AOI 内未生成有效采样点（可能过小或不在当前场景范围内）')
  }

  // 一期：地形采样（可能遇到无 availability 的 terrainProvider，需降级处理）
  const heightsA = await sampleHeightsForCartographics(viewer, cartographics, viewer.terrainProvider)

  let fillVolume = 0
  let cutVolume = 0
  let minHeight = Number.POSITIVE_INFINITY
  let maxHeight = Number.NEGATIVE_INFINITY

  const diffs: number[] = []
  let minDiff = Number.POSITIVE_INFINITY
  let maxDiff = Number.NEGATIVE_INFINITY
  let sumDiff = 0

  for (let i = 0; i < heightsA.length; i++) {
    const heightA = heightsA[i] ?? 0
    const b = surfaceB({ x: localXY[i].x, y: localXY[i].y, heightA })
    const diff = b - heightA

    diffs.push(diff)
    minDiff = Math.min(minDiff, diff)
    maxDiff = Math.max(maxDiff, diff)
    sumDiff += diff

    minHeight = Math.min(minHeight, heightA)
    maxHeight = Math.max(maxHeight, heightA)

    if (diff >= 0) {
      fillVolume += diff * cellArea
    } else {
      cutVolume += -diff * cellArea
    }
  }

  const sampleCount = diffs.length
  const meanDiff = sumDiff / Math.max(1, sampleCount)
  const netVolume = fillVolume - cutVolume
  const absVolume = fillVolume + cutVolume
  const area = sampleCount * cellArea

  // 直方图
  let rangeMin = minDiff
  let rangeMax = maxDiff
  if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
    rangeMin = -1
    rangeMax = 1
  }
  if (rangeMin === rangeMax) {
    rangeMin -= 1
    rangeMax += 1
  }

  const bins = Math.max(6, Math.min(60, histogramBins))
  const binSize = (rangeMax - rangeMin) / bins

  const counts = new Array<number>(bins).fill(0)
  for (const d of diffs) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((d - rangeMin) / binSize)))
    counts[idx]++
  }

  const histogram: VolumeDiffHistogramBin[] = counts.map((count, idx) => {
    const start = rangeMin + idx * binSize
    const end = start + binSize
    return {
      start,
      end,
      center: (start + end) / 2,
      count,
    }
  })

  return {
    area,
    fillVolume,
    cutVolume,
    netVolume,
    absVolume,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
    diff: {
      requestedSpacingMeters: spacingMeters,
      effectiveSpacingMeters,
      cellArea,
      sampleCount,
      minDiff,
      maxDiff,
      meanDiff,
      histogram,
    },
  }
}
