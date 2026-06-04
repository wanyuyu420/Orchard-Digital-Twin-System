/**
 * surfaceSampler.ts — 从 3D Tiles 模型表面采样高程
 *
 * 沿线段密集采样，使线条贴附在 3D 模型表面而非直线穿越空间。
 */
declare const Cesium: any

/**
 * 沿线段采样模型表面位置
 * @param scene - Cesium 场景对象
 * @param positions - 原始位置数组（Cartesian3）
 * @param maxSpacing - 最大采样间距（米，默认 5）
 * @returns 密集采样后的位置数组
 */
export function sampleSurfacePositions(
  scene: any,
  positions: any[],
  maxSpacing: number = 5
): any[] {
  if (positions.length < 2) return positions

  const result: any[] = []

  for (let i = 0; i < positions.length - 1; i++) {
    const p1 = positions[i]
    const p2 = positions[i + 1]

    // 转换为地理坐标
    const c1 = Cesium.Cartographic.fromCartesian(p1)
    const c2 = Cesium.Cartographic.fromCartesian(p2)

    const lon1 = Cesium.Math.toDegrees(c1.longitude)
    const lat1 = Cesium.Math.toDegrees(c1.latitude)
    const lon2 = Cesium.Math.toDegrees(c2.longitude)
    const lat2 = Cesium.Math.toDegrees(c2.latitude)

    // 计算水平距离
    const dist = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(lon1, lat1, 0),
      Cesium.Cartesian3.fromDegrees(lon2, lat2, 0)
    )

    // 计算采样点数
    const numSamples = Math.max(1, Math.ceil(dist / maxSpacing))

    // 添加起点
    if (i === 0) {
      result.push(p1.clone())
    }

    // 采样中间点
    for (let s = 1; s <= numSamples; s++) {
      const t = s / (numSamples + 1)
      const lon = lon1 + (lon2 - lon1) * t
      const lat = lat1 + (lat2 - lat1) * t

      const surfacePos = pickSurfacePosition(scene, lon, lat)
      if (surfacePos) {
        result.push(surfacePos)
      } else {
        // 后备：线性插值高度
        const h1 = c1.height || 0
        const h2 = c2.height || 0
        const h = h1 + (h2 - h1) * t
        result.push(Cesium.Cartesian3.fromDegrees(lon, lat, h))
      }
    }

    // 添加终点
    result.push(p2.clone())
  }

  return result
}

/**
 * 用射线检测获取模型表面位置
 * 从上方 10km 向下打射线，检测与 3D Tiles 的交点
 */
function pickSurfacePosition(scene: any, lon: number, lat: number): any | null {
  try {
    const origin = Cesium.Cartesian3.fromDegrees(lon, lat, 10000)
    const target = Cesium.Cartesian3.fromDegrees(lon, lat, -500)
    const dir = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(target, origin, dir)
    Cesium.Cartesian3.normalize(dir, dir)

    const ray = new Cesium.Ray(origin, dir)
    const result = scene.pickFromRay(ray, scene.primitives)

    if (result && result.position) {
      return result.position.clone()
    }
  } catch (e) {
    // 射线检测失败，忽略
  }
  return null
}
