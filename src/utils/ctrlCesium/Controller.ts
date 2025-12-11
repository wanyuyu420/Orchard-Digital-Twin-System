/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cesium Map Controller
 * Handles initialization, imagery providers, and color filters
 */

import { colorRgb } from '@/utils/color'
import { evil } from '@/utils/common'
import CesiumNavigation from 'cesium-navigation-es6'
import { init as initBaiduImageryProvider } from './imageryProvider/BaiduImageryProvider'

declare const Cesium: any

// Cesium Ion Access Token (for World Terrain and other Ion assets)
// Register at: https://cesium.com/ion/tokens
const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlY2ViYjQyYy0xMzIyLTRlYjAtODdhOS1lMTM2ZTFhYjdhYjAiLCJpZCI6MzQ3OTk2LCJpYXQiOjE3NTk4MjkzODR9.dCi1uXY8ZD6Fym41vwc4-aTTeCdMR1EXM27V82Fp0ZI'

// Set Ion default access token
Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN

// Register Baidu imagery provider
initBaiduImageryProvider()

export interface MapImageryConfig {
  type: string
  classConfig: {
    url: string
    subdomains?: string[]
    maximumLevel?: number
    customTags?: string
  }
  interfaceConfig?: {
    saturation?: number
    brightness?: number
    contrast?: number
    hue?: number
    gamma?: number
  }
  offset: string
  invertswitch: boolean
  filterRGB: string
}

export interface BaseMapConfig {
  animation?: boolean
  timeline?: boolean
  baseLayerPicker?: boolean
  fullscreenButton?: boolean
  infoBox?: boolean
  homeButton?: boolean
  geocoder?: boolean
  sceneModePicker?: boolean
  selectionIndicator?: boolean
  logo?: boolean
}

class Controller {
  viewer: any = null
  private terrainEnabled = false
  private terrainLoading = false

  constructor() {
    this.viewer = null
  }

  init(baseMapConfig: BaseMapConfig, mapImageryList: MapImageryConfig[]): any {
    const mapID = 'cesiumContainer'

    // Default viewer configuration - no imageryProvider, will be added via setConfigMapList
    let vConfig: any = {
      imageryProvider: false,  // Disable default imagery, add layers explicitly
      contextOptions: {
        webgl: {
          alpha: false,
        },
      },
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      shadows: false,
      shouldAnimate: true,
      skyBox: false,
      infoBox: false,
      fullscreenButton: false,
      homeButton: true,
      geocoder: false,
      sceneModePicker: true,
    }

    // Merge with provided config
    vConfig = Object.assign(vConfig, baseMapConfig)

    const viewer = new Cesium.Viewer(mapID, vConfig)

    // Hide Cesium logo if configured
    if (!baseMapConfig.logo) {
      const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement
      creditContainer.style.display = 'none'
    }

    // === Performance Optimizations ===
    const scene = viewer.scene

    // Enable explicit render mode - only render when needed
    scene.requestRenderMode = true
    // Maximum milliseconds to wait before rendering (when idle)
    scene.maximumRenderTimeChange = Infinity
    
    // Limit frame rate to reduce CPU usage
    viewer.targetFrameRate = 30

    // Disable expensive features
    viewer.scene.fog.enabled = false
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.skyAtmosphere.show = false

    // Optimize globe rendering
    viewer.scene.globe.tileCacheSize = 100
    viewer.scene.globe.maximumScreenSpaceError = 2

    // Enable depth testing against terrain
    viewer.scene.globe.depthTestAgainstTerrain = true

    // NOTE: Terrain is NOT loaded by default
    // Use enableTerrain() to load terrain when needed (e.g., for 3D analysis)
    // Vector base maps are incompatible with 3D terrain

    // Initialize navigation controls
    this.initCesiumNavigation(viewer)

    // Add configured imagery layers
    this.setConfigMapList(viewer, mapImageryList)

    // Anti-aliasing settings
    this.removeJagged(viewer)

    this.viewer = viewer
    return viewer
  }

  /**
   * Load Cesium World Terrain asynchronously (internal)
   */
  private async loadWorldTerrain(): Promise<void> {
    if (!this.viewer || this.terrainLoading) return
    
    this.terrainLoading = true
    try {
      const terrainProvider = await Cesium.createWorldTerrainAsync({
        requestWaterMask: true,
        requestVertexNormals: true
      })
      this.viewer.terrainProvider = terrainProvider
      this.terrainEnabled = true
      console.log('✓ Cesium World Terrain loaded')
    } catch (error) {
      console.warn('Failed to load World Terrain:', error)
      this.terrainEnabled = false
    } finally {
      this.terrainLoading = false
    }
  }

  /**
   * Enable 3D terrain
   * @returns Promise that resolves when terrain is loaded
   */
  async enableTerrain(): Promise<void> {
    if (this.terrainEnabled || this.terrainLoading) return
    await this.loadWorldTerrain()
  }

  /**
   * Disable 3D terrain, revert to ellipsoid
   */
  disableTerrain(): void {
    if (!this.viewer || !this.terrainEnabled) return
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
    this.terrainEnabled = false
    console.log('✓ Terrain disabled, using ellipsoid')
  }

  /**
   * Check if terrain is enabled
   */
  isTerrainEnabled(): boolean {
    return this.terrainEnabled
  }

  /**
   * Check if terrain is currently loading
   */
  isTerrainLoading(): boolean {
    return this.terrainLoading
  }

  initCesiumNavigation(viewer: any): void {
    try {
      const options: any = {
        // Default view reset rectangle (China region)
        defaultResetView: new Cesium.Rectangle.fromDegrees(80, 22, 130, 50),
        enableCompass: true,
        enableZoomControls: true,
        enableDistanceLegend: true,
        enableCompassOuterRing: true,
      }
      new CesiumNavigation(viewer, options)
    } catch (error) {
      console.warn('CesiumNavigation initialization failed (may be incompatible with Cesium 1.136):', error)
    }
  }

  setOneimageryProvider(mapImagery: MapImageryConfig): any {
    const config = { ...mapImagery.classConfig }
    if (config.customTags) {
      config.customTags = evil('(' + config.customTags + ')') as string
    }
    return new Cesium[mapImagery.type](config)
  }

  setConfigMapList(viewer: any, mapImageryList: MapImageryConfig[]): void {
    const imageryLayers = viewer.imageryLayers

    // In Cesium 1.136+, imageryProvider in Viewer config may not auto-add to imageryLayers
    // Add all imagery layers explicitly
    mapImageryList.forEach((elem) => {
      imageryLayers.addImageryProvider(this.setOneimageryProvider(elem))
    })

    // Apply settings to each layer
    mapImageryList.forEach((elem, index) => {
      const baseLayer = viewer.imageryLayers.get(index)
      if (!baseLayer) return

      // Apply offset if specified
      const offset = elem.offset.split(',')
      if (offset.length === 2) {
        try {
          const oxy = [parseFloat(offset[0]), parseFloat(offset[1])]
          baseLayer._imageryProvider._tilingScheme._rectangleNortheastInMeters.x += oxy[0]
          baseLayer._imageryProvider._tilingScheme._rectangleNortheastInMeters.y += oxy[1]
        } catch (error) {
          console.warn('Failed to apply offset:', error)
        }
      }

      // Apply interface config (saturation, brightness, etc.)
      if (elem.interfaceConfig) {
        Object.entries(elem.interfaceConfig).forEach(([key, value]) => {
          baseLayer[key] = value
        })
      }
    })

    // Apply globe filter (tech/ink style) - uses new Globe filter API
    // Find first layer with filter enabled
    const filterLayer = mapImageryList.find(elem => elem.invertswitch)
    if (filterLayer) {
      this.setGlobeFilter(viewer, true, filterLayer.filterRGB)
    }
  }

  /**
   * Set globe filter for tech/ink style effect
   * @param viewer Cesium viewer instance
   * @param enabled Enable/disable filter
   * @param filterRGB Filter color in hex format (e.g., '#00ff00')
   * @param exposure Exposure value (default 1.0)
   * @param contrast Contrast value (default 1.0)
   */
  setGlobeFilter(
    viewer: any,
    enabled: boolean,
    filterRGB: string = '#ffffff',
    exposure: number = 1.0,
    contrast: number = 1.0
  ): void {
    const globe = viewer.scene.globe

    globe.filterEnabled = enabled

    if (enabled) {
      // Convert hex to RGB normalized (0-1)
      let rgb = [1.0, 1.0, 1.0]
      if (filterRGB !== '#000000' && filterRGB !== '#ffffff') {
        const rgbArray = colorRgb(filterRGB)
        rgb = [rgbArray[0] / 255.0, rgbArray[1] / 255.0, rgbArray[2] / 255.0]
      }
      globe.filterColor = new Cesium.Cartesian3(rgb[0], rgb[1], rgb[2])
      globe.filterExposure = exposure
      globe.filterContrast = contrast
    }
  }

  removeJagged(viewer: any): void {
    // Disable FXAA for performance
    viewer.scene.postProcessStages.fxaa.enabled = false
    viewer.scene.fxaa = false

    // Adjust resolution for high-DPI displays
    const supportsImageRenderingPixelated = viewer.cesiumWidget._supportsImageRenderingPixelated
    if (supportsImageRenderingPixelated) {
      let dpr = window.devicePixelRatio
      while (dpr >= 2.0) {
        dpr /= 2.0
      }
      viewer.resolutionScale = dpr
    }
  }

  // Get current view center coordinates
  getCurCenterLonLat(viewer: any): { lon: number; lat: number } | null {
    const result = viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(
        viewer.canvas.clientWidth / 2,
        viewer.canvas.clientHeight / 2
      )
    )
    if (!result) return null

    const curPosition = Cesium.Ellipsoid.WGS84.cartesianToCartographic(result)
    return {
      lon: (curPosition.longitude * 180) / Math.PI,
      lat: (curPosition.latitude * 180) / Math.PI,
    }
  }

  // Fly to location
  flyTo(lon: number, lat: number, height: number, duration = 3): void {
    if (!this.viewer) return
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration,
    })
  }

  // Destroy viewer
  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy()
      this.viewer = null
    }
  }
}

export const GController = new Controller()
export default Controller
