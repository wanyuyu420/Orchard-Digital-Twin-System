/**
 * Basemap configuration data
 * Default: Original color basemap (no filter)
 * Filter toggle enables water-ink/tech style
 */

import type { MapImageryConfig, BaseMapConfig } from '@/utils/ctrlCesium/Controller'

// 天地图 API Key - 请替换为你自己的 Key
// 申请地址: https://console.tianditu.gov.cn/
const TIANDITU_KEY = import.meta.env.VITE_TIANDITU_KEY || 'YOUR_TIANDITU_KEY'

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

// Initial view settings (Xinjiang - Urumqi area)
export const MockMapView = {
  data: [
    { name: 'lat', value: '43.82' },
    { name: 'lng', value: '87.57' },
    { name: 'height', value: '50000' },
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

// Default AutoNavi basemap - NO filter applied initially (original color)
export const MockMapImageryList: { data: MapImageryConfig[] } = {
  data: [
    {
      type: 'UrlTemplateImageryProvider',
      classConfig: {
        url: 'https://webst0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&style=7',
        subdomains: ['1', '2', '3', '4'],
        maximumLevel: 18,
      },
      // Default: original color style (no filter)
      interfaceConfig: {
        saturation: 1.0, // Full color
        brightness: 1.0, // Normal brightness
        contrast: 1.0, // Normal contrast
        hue: 0.0, // No hue shift
        gamma: 1.0, // Normal gamma
      },
      offset: '0,0',
      invertswitch: false, // No color inversion
      filterRGB: '#ffffff', // No filter tint
    },
  ],
}

// Tianditu configuration (for basemap switching)
export const TiandituConfig = {
  vec: {
    type: 'UrlTemplateImageryProvider',
    classConfig: {
      url: `https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
    },
    interfaceConfig: {},
    offset: '0,0',
    invertswitch: false,
    filterRGB: '#ffffff',
  },
  cva: {
    type: 'UrlTemplateImageryProvider',
    classConfig: {
      url: `https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
    },
    interfaceConfig: {},
    offset: '0,0',
    invertswitch: false,
    filterRGB: '#ffffff',
  },
  img: {
    type: 'UrlTemplateImageryProvider',
    classConfig: {
      url: `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
    },
    interfaceConfig: {},
    offset: '0,0',
    invertswitch: false,
    filterRGB: '#ffffff',
  },
}

// Layer style presets
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
