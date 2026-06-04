export interface ViewConfig {
  lon: number
  lat: number
  height: number
  heading: number
  pitch: number
  roll: number
}

/** 果园3D模型中心坐标 (CityEngine UTM zone 50N → WGS84) */
export const defaultView: ViewConfig = {
  lon: 116.5,
  lat: 27.13,
  height: 3000,
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
