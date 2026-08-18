/**
 * 从底图数据读取驾驶舱统计（果树总数 / 种植面积）。
 *
 * 绕开当前挂起的 GeoScene FeatureServer（/0/query 超时）：
 *  - 果树总数 ← trees/tileset.json 递归统计 content 条目（地1 树精模数量）
 *  - 种植面积 ← window.DEM 范围近似（果园地表范围，球面矩形面积）
 *
 * 依赖：与 OrchardTilesetLayer 同一数据源（serve_orchard.py, 默认 8766 端口）。
 */

/** 递归统计 tileset 的 content 条目数（每棵树的 b3dm 算一条） */
export function countTilesetContent(tileset: any): number {
  let n = 0
  const walk = (node: any): void => {
    if (!node) return
    if (node.content) n += Array.isArray(node.content) ? node.content.length : 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  walk(tileset?.root)
  return n
}

/** 从 DEM 范围计算果园地表面积（亩），1 亩 ≈ 666.667 m² */
export function computeAreaFromDem(dem: any): number {
  if (!dem || typeof dem.minLon !== 'number' || typeof dem.maxLat !== 'number') return 0
  const avgLat = ((dem.minLat + dem.maxLat) / 2) * (Math.PI / 180)
  const widthM = (dem.maxLon - dem.minLon) * 111320 * Math.cos(avgLat)
  const heightM = (dem.maxLat - dem.minLat) * 111320
  return (widthM * heightM) / 666.6667
}

/**
 * 从 WGS84 包络矩形 [west, south, east, north] 计算面积（亩）。
 * 用于上传地块（地2）的 domRect：几何近似（与 computeAreaFromDem 同公式），
 * 单景 TIF 范围较小，误差可忽略。
 */
export function computeAreaFromRect(
  rect: [number, number, number, number] | null | undefined,
): number {
  if (!rect || rect.length !== 4) return 0
  const [west, south, east, north] = rect
  if (!isFinite(west) || !isFinite(south) || !isFinite(east) || !isFinite(north)) return 0
  if (east <= west || north <= south) return 0
  const avgLat = ((south + north) / 2) * (Math.PI / 180)
  const widthM = (east - west) * 111320 * Math.cos(avgLat)
  const heightM = (north - south) * 111320
  return (widthM * heightM) / 666.6667
}
