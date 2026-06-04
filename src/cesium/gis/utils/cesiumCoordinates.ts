/**
 * Cesium坐标转换工具
 */
import * as Cesium from 'cesium'

/**
 * 将Cesium 3D坐标转换为屏幕坐标
 *
 * @param viewer Cesium Viewer实例
 * @param position Cesium.Cartesian3 3D坐标
 * @returns 屏幕坐标 {x, y} 或 null（如果坐标不可见）
 */
export function cartesianToScreen(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian3
): { x: number; y: number } | null {
  if (!viewer || !viewer.scene || !position) {
    return null
  }

  // 使用Cesium的内置方法转换到屏幕坐标
  const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position)

  if (!screenPosition) {
    return null
  }

  return {
    x: screenPosition.x,
    y: screenPosition.y,
  }
}

/**
 * 检查坐标是否在屏幕范围内
 */
export function isPositionOnScreen(viewer: Cesium.Viewer, position: Cesium.Cartesian3): boolean {
  const screenPos = cartesianToScreen(viewer, position)

  if (!screenPos) return false

  const canvas = viewer.scene.canvas
  return (
    screenPos.x >= 0 &&
    screenPos.x <= canvas.clientWidth &&
    screenPos.y >= 0 &&
    screenPos.y <= canvas.clientHeight
  )
}

/**
 * 计算多个坐标的中心点对应的屏幕坐标
 */
export function getCenterScreenPosition(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[]
): { x: number; y: number } | null {
  if (!positions || positions.length === 0) {
    return null
  }

  // 计算3D中心点
  const center = Cesium.BoundingSphere.fromPoints(positions).center

  // 转换为屏幕坐标
  return cartesianToScreen(viewer, center)
}
