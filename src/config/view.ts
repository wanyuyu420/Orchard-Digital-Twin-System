export interface ViewConfig {
  lon: number
  lat: number
  height: number
  heading: number
  pitch: number
  roll: number
}

/** 赣南脐橙核心产区坐标（与模型位置对齐） */
export const defaultView: ViewConfig = {
  lon: 116.4973,
  lat: 27.1322,
  height: 2000,
  heading: 0,
  pitch: -60,
  roll: 0,
}

/** 果园区域边界 */
export const gannanBounds = {
  west: 115.5,
  south: 26.5,
  east: 117.5,
  north: 27.8,
}
