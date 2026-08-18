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
// Set VITE_CESIUM_ION_TOKEN in your .env.local file
const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || ''

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
      imageryProvider: false, // Disable default imagery, add layers explicitly
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
      // 注意:skyBox 选项不传(保持默认)→ Viewer 自动 createEarthSkyBox()。
      // 若传 true 会被直接赋给 scene.skyBox 导致 "this.skyBox.update is not a function" 崩溃。
      infoBox: false,
      fullscreenButton: false,
      homeButton: true,
      geocoder: false,
      sceneModePicker: true,
    }

    // Merge with provided config
    vConfig = Object.assign(vConfig, baseMapConfig)

    const viewer = new Cesium.Viewer(mapID, vConfig)

    // 按需渲染：只有相机变化 / 瓦片就绪 / 显式 requestRender() 时才出帧，
    // 空闲不再 60fps 全速渲染（shouldAnimate 让时钟每帧跳动，若不设
    // maximumRenderTimeChange 为极大值，requestRenderMode 会被时间驱动渲染顶掉）。
    // 项目内 PolygonDrawer 已显式调用 scene.requestRender()，即按需渲染为预期模式。
    viewer.scene.requestRenderMode = true
    viewer.scene.maximumRenderTimeChange = Number.MAX_VALUE

    // WebGL 上下文丢失防护(见 installContextLossGuard 注释)
    this.installContextLossGuard(viewer)

    // Hide Cesium logo if configured
    if (!baseMapConfig.logo) {
      const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement
      creditContainer.style.display = 'none'
    }

    // Depth testing against terrain is disabled — the orchard GLB model provides its own terrain mesh
    viewer.scene.globe.depthTestAgainstTerrain = false

    // 对齐果园预览:关闭地面大气雾(预览 showGroundAtmosphere=false)
    viewer.scene.globe.showGroundAtmosphere = false

    // Globe base color — 对齐果园预览的 #20303a(深蓝灰,非近黑)
    this.setGlobeBaseColor(viewer, '#20303a')

    // Reduce scroll wheel zoom sensitivity (default 5.0 — too fast)
    viewer.scene.screenSpaceCameraController.zoomFactor = 2.0

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
   * Guard against WebGL context loss.
   *
   * On real GPUs, loading the heavy Orchard 3D Tiles (3.5 GB of b3dm geometry)
   * can crash the GPU process → WebGL context lost. The modified Cesium 1.136
   * build used here has NO context-lost handling: after loss the browser keeps
   * `drawingBufferWidth` at 0 while Cesium still renders (its `_canRender`
   * stays true) → GlobeDepth creates a 0-width texture → "Expected width to be
   * greater than 0" crash.
   *
   * Calling `preventDefault()` lets the browser restore the context; once
   * restored all GL resources are invalid, so we reload the page to rebuild.
   */
  private installContextLossGuard(viewer: any): void {
    const canvas = viewer.scene.canvas
    canvas.addEventListener('webglcontextlost', (e: any) => {
      e.preventDefault()
      console.warn('[ContextLoss] WebGL context lost — attempting to recover…')
      try {
        // 全屏提示,避免恢复/刷新期间黑屏造成困惑
        let el = document.getElementById('context-loss-overlay') as HTMLElement | null
        if (!el) {
          el = document.createElement('div')
          el.id = 'context-loss-overlay'
          el.style.cssText =
            'position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.85);' +
            'color:#a5d6a7;display:flex;align-items:center;justify-content:center;' +
            'font:14px/1.6 sans-serif;letter-spacing:.5px;'
          el.textContent = '地图渲染异常,正在自动恢复…'
          document.body.appendChild(el)
        }
      } catch (err) {
        /* ignore */
      }
      // 兜底:若浏览器一直无法恢复,5 秒后强制刷新
      setTimeout(() => window.location.reload(), 5000)
    })
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[ContextLoss] WebGL context restored — reloading to rebuild GL resources')
      window.location.reload()
    })
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
        requestVertexNormals: true,
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
        // Cesium ≥1.87 中 Rectangle.fromDegrees 是静态工厂方法(非构造函数),不能加 new
        defaultResetView: Cesium.Rectangle.fromDegrees(80, 22, 130, 50),
        enableCompass: true,
        enableZoomControls: true,
        enableDistanceLegend: true,
        enableCompassOuterRing: true,
      }
      new CesiumNavigation(viewer, options)
    } catch (error) {
      console.warn(
        'CesiumNavigation initialization failed (may be incompatible with Cesium 1.136):',
        error
      )
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
    const filterLayer = mapImageryList.find((elem) => elem.invertswitch)
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

  /**
   * Set globe base color for the ellipsoid when no imagery tiles are loaded
   * Gives a dark background that matches the app's dark theme
   * @param viewer Cesium viewer instance
   * @param color CSS color string (default: dark navy)
   */
  setGlobeBaseColor(viewer: any, color: string = '#020617'): void {
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(color)
  }

  removeJagged(viewer: any): void {
    // Enable FXAA for better edge smoothing
    viewer.scene.postProcessStages.fxaa.enabled = true
    viewer.scene.fxaa = true

    // Keep the drawing-buffer resolution at 1.0 (do NOT scale by devicePixelRatio).
    // On a real GPU, loading the Orchard 3D Tiles (3.5 GB b3dm) at a device-pixel
    // resolution frame buffer pushes GPU memory/driver pressure high enough to
    // crash the GPU process → WebGL context lost → width=0 render crash.
    // The working 果园 preview uses the default resolutionScale (1.0); matching it
    // cuts frame-buffer pixels ~56% and removes the context-loss trigger.
    viewer.resolutionScale = 1
  }

  // Get current view center coordinates
  getCurCenterLonLat(viewer: any): { lon: number; lat: number } | null {
    const result = viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
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
