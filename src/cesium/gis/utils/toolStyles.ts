/**
 * 3D分析工具统一样式配置
 *
 * 为所有3D分析工具提供一致的视觉风格
 * 包含颜色、字体、图标和格式化函数
 */

import * as Cesium from 'cesium'

/**
 * 工具专属配色方案 - 恢复彩色主题
 */
export const TOOL_COLORS = {
  volume: {
    fill: 'rgba(34, 211, 238, 0.3)', // 青色填充
    stroke: '#22D3EE', // 青色边框
    accent: '#22D3EE',
    glow: 'rgba(34, 211, 238, 0.4)',
    light: 'rgba(34, 211, 238, 0.3)',
  },
  flood: {
    fill: 'rgba(59, 130, 246, 0.3)', // 蓝色填充
    stroke: '#3B82F6', // 蓝色边框
    accent: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.4)',
    light: 'rgba(59, 130, 246, 0.3)',
  },
  profile: {
    fill: 'rgba(34, 197, 94, 0.3)', // 绿色填充
    stroke: '#22C55E', // 绿色边框
    accent: '#22C55E',
    glow: 'rgba(34, 197, 94, 0.4)',
    light: 'rgba(34, 197, 94, 0.3)',
  },
  measure3d: {
    fill: 'rgba(249, 115, 22, 0.3)', // 橙色填充
    stroke: '#F97316', // 橙色边框
    accent: '#F97316',
    glow: 'rgba(249, 115, 22, 0.4)',
    light: 'rgba(249, 115, 22, 0.3)',
  },
  // 通用色
  common: {
    primary: '#22D3EE', // 青色主色
    secondary: '#666666',
    white: '#FFFFFF',
    black: '#000000',
    bgDark: 'rgba(15, 23, 42, 0.9)',
    bgSemi: 'rgba(15, 23, 42, 0.8)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
} as const

/**
 * 标签样式配置 - 黑色主题
 */
export const LABEL_STYLES = {
  // 结果标签（主要展示）
  result: {
    font: 'bold 18px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fillColor: '#000000',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    outlineWidth: 2,
    outlineColor: 'rgba(0, 0, 0, 0.8)',
    padding: new Cesium.Cartesian2(20, 14),
    pixelOffset: new Cesium.Cartesian2(0, -30),
  },
  // 实时提示标签
  hint: {
    font: '1 4px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fillColor: '#000000',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    outlineWidth: 2,
    outlineColor: 'rgba(0, 0, 0, 0.6)',
    padding: new Cesium.Cartesian2(14, 10),
    pixelOffset: new Cesium.Cartesian2(20, -20),
  },
  // 紧凑型标签（小尺寸）
  compact: {
    font: '12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fillColor: '#000000',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    outlineWidth: 2,
    outlineColor: 'rgba(0, 0, 0, 0.8)',
    padding: new Cesium.Cartesian2(10, 6),
    pixelOffset: new Cesium.Cartesian2(15, -15),
  },
} as const

/**
 * 点标记样式 - 黑色主题
 */
export const POINT_STYLES = {
  // 顶点标记（绘制中）
  vertex: {
    pixelSize: 12,
    color: '#000000', // 黑色
    outlineColor: '#FFFFFF',
    outlineWidth: 2.5,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  // 普通标记点
  marker: {
    pixelSize: 10,
    color: '#000000', // 黑色
    outlineColor: '#FFFFFF',
    outlineWidth: 2,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  // 高亮标记点
  highlight: {
    pixelSize: 14,
    color: '#000000',
    outlineColor: '#FFFFFF',
    outlineWidth: 3,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
} as const

/**
 * 线条样式
 */
export const LINE_STYLES = {
  preview: {
    width: 3,
    dashLength: 16,
  },
  result: {
    width: 4,
  },
  thin: {
    width: 2,
  },
} as const

/**
 * 图标映射（FontAwesome图标类名）
 */
export const TOOL_ICONS = {
  volume: '📊', // 可选替换为: fa-chart-area
  flood: '💧', // 可选替换为: fa-water
  profile: '📈', // 可选替换为: fa-chart-line
  measure3d: '📏', // 可选替换为: fa-ruler-combined
  area: '⬛',
  length: '📐',
  height: '↕️',
  triangle: '△',
} as const

/**
 * 创建标准化结果标签
 *
 * @param title 标题
 * @param icon 图标
 * @param data 数据项数组
 * @returns 格式化的标签文本
 */
export function createResultLabel(
  title: string,
  icon: string,
  data: Array<{ label: string; value: string | number; unit?: string; highlight?: boolean }>
): string {
  const separator = '═'.repeat(18)
  const lines = [`${icon}  ${title}`, separator]

  data.forEach((item) => {
    const valueStr =
      typeof item.value === 'number'
        ? item.value.toFixed(item.value >= 100 ? 0 : item.value >= 10 ? 1 : 2)
        : item.value
    const unit = item.unit || ''
    const prefix = item.highlight ? '▸' : '•'
    lines.push(`${prefix} ${item.label}: ${valueStr}${unit}`)
  })

  return lines.join('\n')
}

/**
 * 创建提示标签
 */
export function createHintLabel(message: string, count?: number): string {
  if (count !== undefined) {
    return `${message} (${count})\n双击完成`
  }
  return message
}

/**
 * 创建标签实体配置
 */
export function createLabelEntity(
  text: string | Cesium.CallbackProperty,
  position: Cesium.Cartesian3 | Cesium.CallbackProperty,
  style: 'result' | 'hint' | 'compact' = 'result'
): any {
  const labelStyle = LABEL_STYLES[style]

  return {
    position:
      position instanceof Cesium.CallbackProperty
        ? (position as unknown as Cesium.PositionProperty)
        : position,
    label: {
      text: text instanceof Cesium.CallbackProperty ? text : text,
      font: labelStyle.font,
      fillColor: Cesium.Color.fromCssColorString(labelStyle.fillColor),
      outlineColor: Cesium.Color.fromCssColorString(labelStyle.outlineColor),
      outlineWidth: labelStyle.outlineWidth,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: labelStyle.pixelOffset,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString(labelStyle.backgroundColor),
      backgroundPadding: labelStyle.padding,
      scale: style === 'result' ? 1.0 : 0.95,
      translucencyByDistance: new Cesium.NearFarScalar(1000, 1.0, 5000, 0.7),
      scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 5000, 0.8),
    },
  }
}

/**
 * 创建点标记实体配置
 */
export function createPointMarker(
  position: Cesium.Cartesian3,
  type: 'vertex' | 'marker' | 'highlight' = 'marker'
): any {
  const pointStyle = POINT_STYLES[type]

  return {
    position,
    point: {
      pixelSize: pointStyle.pixelSize,
      color: Cesium.Color.fromCssColorString(pointStyle.color),
      outlineColor: Cesium.Color.fromCssColorString(pointStyle.outlineColor),
      outlineWidth: pointStyle.outlineWidth,
      disableDepthTestDistance: pointStyle.disableDepthTestDistance,
    },
  }
}

/**
 * 创建发光线条材质
 */
export function createGlowLineMaterial(
  color: string,
  glowPower: number = 0.25
): Cesium.PolylineGlowMaterialProperty {
  return new Cesium.PolylineGlowMaterialProperty({
    glowPower,
    color: Cesium.Color.fromCssColorString(color),
    taperPower: 1.0,
  })
}

/**
 * 创建多边形填充材质
 */
export function createPolygonMaterial(color: string, opacity: number = 0.3): Cesium.Color {
  return Cesium.Color.fromCssColorString(color).withAlpha(opacity)
}

/**
 * 格式化体积值
 */
export function formatVolumeValue(cubic: number): string {
  if (cubic >= 1e6) {
    return `${(cubic / 1e6).toFixed(2)} km³`
  } else if (cubic >= 1e3) {
    return `${(cubic / 1e3).toFixed(1)} 千m³`
  }
  return `${cubic.toFixed(1)} m³`
}

/**
 * 格式化面积值
 */
export function formatAreaValue(sqMeters: number): string {
  if (sqMeters >= 1e6) {
    return `${(sqMeters / 1e6).toFixed(2)} km²`
  } else if (sqMeters >= 1e4) {
    return `${(sqMeters / 1e4).toFixed(2)} 公顷`
  }
  return `${sqMeters.toFixed(0)} m²`
}

/**
 * 格式化长度值
 */
export function formatLengthValue(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(1)} m`
}

/**
 * 格式化高度值
 */
export function formatHeightValue(meters: number): string {
  return `${meters.toFixed(1)} m`
}
