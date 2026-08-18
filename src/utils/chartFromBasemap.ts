/**
 * 从底图(已加载的 trees 3D Tiles)读取每棵树的属性,直接生成冠层图表统计。
 *
 * 绕开后端 /orchard/chart-data(后端目前未实现该接口,拿不到数据)。
 * 数据来源:window.__orchardTreesTileset 中每棵树的 batch table 字段
 *  (冠层高度/冠层体积/冠幅面积,由 OrchardTilesetLayer 注入)。
 *
 * 注意:折线图(trend)需要时间序列历史数据,底图是单时点快照 → trend 返回空,
 *      前端 OrchardChartDialog 会自动隐藏"折线图"标签。
 */

import type { ChartStatistics, ChartMetricData } from '@/types/orchard'

/** 从已加载的 trees 瓦片树中收集所有 feature */
function collectFeatures(tileset: any): any[] {
  const features: any[] = []
  const walk = (tile: any): void => {
    const content = tile?.content
    if (content && typeof content.featuresLength === 'number' && content.featuresLength > 0) {
      for (let i = 0; i < content.featuresLength; i++) {
        try {
          const f = content.getFeature(i)
          if (f) features.push(f)
        } catch {
          /* 单个 feature 读取失败忽略 */
        }
      }
    }
    if (Array.isArray(tile.children)) tile.children.forEach(walk)
  }
  walk(tileset.root)
  return features
}

function readNumber(f: any, name: string): number | null {
  try {
    const v = f.getProperty(name)
    return typeof v === 'number' && isFinite(v) ? v : null
  } catch {
    return null
  }
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** 单个指标的直方图分桶(等宽分桶 → 柱状图 + 饼状图共用) */
function buildMetric(
  key: ChartMetricData['key'],
  label: string,
  unit: string,
  values: number[],
  binWidth: number,
): ChartMetricData & { count: number } {
  const count = values.length
  if (!count) {
    return { key, label, unit, avg: 0, min_val: 0, max_val: 0, distribution: [], pieData: [], trend: [], count: 0 }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((s, v) => s + v, 0) / count

  const bins = new Map<number, number>()
  for (const v of values) {
    const b = Math.floor(v / binWidth) * binWidth
    bins.set(b, (bins.get(b) || 0) + 1)
  }
  const keys = [...bins.keys()].sort((a, b) => a - b)
  const distribution = keys.map((b) => ({
    name: `${formatNum(b)}~${formatNum(b + binWidth)}`,
    value: bins.get(b)!,
  }))

  return {
    key,
    label,
    unit,
    avg: +avg.toFixed(2),
    min_val: min,
    max_val: max,
    distribution,
    pieData: distribution.map((d) => ({ ...d })),
    trend: [],
    count,
  }
}

/**
 * 从底图生成图表统计;瓦片未加载或读不到任何属性时返回 null。
 */
export function buildChartFromLoadedTileset(): ChartStatistics | null {
  const tileset = (window as any).__orchardTreesTileset
  if (!tileset?.root) return null

  const features = collectFeatures(tileset)
  if (features.length === 0) return null

  const heights: number[] = []
  const volumes: number[] = []
  const areas: number[] = []
  for (const f of features) {
    const h = readNumber(f, '冠层高度')
    const v = readNumber(f, '冠层体积')
    const a = readNumber(f, '冠幅面积')
    if (h !== null) heights.push(h)
    if (v !== null) volumes.push(v)
    if (a !== null) areas.push(a)
  }

  const metrics: (ChartMetricData & { count: number })[] = [
    buildMetric('canopyHeight', '冠层高度', 'm', heights, 1),
    buildMetric('canopyVolume', '冠层体积', 'm³', volumes, 10),
    buildMetric('canopyArea', '冠幅面积', 'm²', areas, 2),
  ].filter((m) => m.count > 0)

  if (!metrics.length) return null
  if (metrics.length < features.length * 0.5) {
    console.warn(
      `[chartFromBasemap] 仅读到 ${metrics.reduce((s, m) => s + m.count, 0)}/${features.length} 棵树的属性,分布可能不完整`,
    )
  }

  return {
    metrics: metrics.map(({ count, ...m }) => m),
    timestamp: new Date().toISOString(),
  }
}
