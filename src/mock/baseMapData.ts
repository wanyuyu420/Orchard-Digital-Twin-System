/**
 * Basemap configuration data
 * 天地图底图
 */

import type { MapImageryConfig, BaseMapConfig } from '@/utils/ctrlCesium/Controller'

// Viewer configuration
export const MockMapConfig: { data: { name: string; value: string }[] } = {
  data: [
    { name: 'animation', value: '0' },
    { name: 'timeline', value: '0' },
    { name: 'baseLayerPicker', value: '0' },
    { name: 'fullscreenButton', value: '0' },
    { name: 'infoBox', value: '0' },
    { name: 'homeButton', value: '0' },
    { name: 'geocoder', value: '0' },
    { name: 'sceneModePicker', value: '0' },
    { name: 'selectionIndicator', value: '0' },
    { name: 'logo', value: '0' },
  ],
}

// Initial view settings (赣州 - 脐橙果园)
export const MockMapView = {
  data: [
    { name: 'lat', value: '27.13' },
    { name: 'lng', value: '116.5' },
    { name: 'height', value: '2000' },
    { name: 'direction_x', value: '0' },
    { name: 'direction_y', value: '-0.9' },
    { name: 'direction_z', value: '-0.1' },
    { name: 'up_x', value: '0' },
    { name: 'up_y', value: '0.1' },
    { name: 'up_z', value: '-0.9' },
    { name: 'flytoView', value: '1' },
    { name: 'duration', value: '3' },
    { name: 'showSaveButton', value: '1' },
  ],
}

// Empty — 无地球影像底图，GLB 模型作为主要内容
export const MockMapImageryList: { data: MapImageryConfig[] } = {
  data: [],
}

// 底图样式预设
export const baseInkStyle = {
  saturation: 0.0,
  brightness: 0.55,
  contrast: 1.6,
  gamma: 0.35,
  hue: 1.0,
}

export const baseColorStyle = {
  saturation: 1.0,
  brightness: 0.95,
  contrast: 1.0,
  gamma: 1.0,
  hue: 0.0,
}

// Helper to convert MockMapConfig to BaseMapConfig
export function getBaseMapConfig(): BaseMapConfig {
  const config: BaseMapConfig = {}
  MockMapConfig.data.forEach((item) => {
    ;(config as Record<string, boolean>)[item.name] = item.value === '1'
  })
  return config
}

// Get initial view parameters
export function getInitialView(): {
  lon: number
  lat: number
  height: number
  direction: [number, number, number]
  up: [number, number, number]
  flytoView: boolean
  duration: number
} {
  const viewData = MockMapView.data
  const getValue = (name: string) => {
    const item = viewData.find((d) => d.name === name)
    return item ? parseFloat(item.value) : 0
  }

  return {
    lon: getValue('lng'),
    lat: getValue('lat'),
    height: getValue('height'),
    direction: [getValue('direction_x'), getValue('direction_y'), getValue('direction_z')],
    up: [getValue('up_x'), getValue('up_y'), getValue('up_z')],
    flytoView: getValue('flytoView') === 1,
    duration: getValue('duration'),
  }
}

// Get imagery list
export function getBaseMapImageryList(): MapImageryConfig[] {
  return MockMapImageryList.data
}
