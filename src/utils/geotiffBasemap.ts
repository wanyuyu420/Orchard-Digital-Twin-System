/**
 * GeoTIFF Basemap Loader
 *
 * Loads a remote GeoTIFF (JPEG-compressed) using geotiff.js in the browser,
 * which uses the browser's native JPEG decoder for reliable decompression.
 * The image is downsampled and added to Cesium as a SingleTileImageryProvider.
 */
import { fromArrayBuffer } from 'geotiff'

// GeoTIFF bounds in WGS84 (converted from EPSG:32650 / UTM zone 50N)
const WEST = 116.496487
const SOUTH = 27.131343
const EAST = 116.498593
const NORTH = 27.133233

// Downsampling factor (1 = full resolution, 4 = 1/4 scale, etc.)
// Full: 14412 × 14513 → too large for canvas
// 1/4:  3603  × 3628  → ~39 MB RGB → borderline
// 1/8:  1802  × 1814  → ~9.8 MB RGB → good
// 1/16: 901   × 907   → ~2.5 MB RGB → OK for overview
const DOWNSAMPLE = 8

export async function addGeotiffBasemap(viewer: any): Promise<void> {
  const Cesium = (window as any).Cesium
  if (!Cesium) {
    console.warn('[GeoTIFF] Cesium not found on window')
    return
  }

  try {
    // 1. Fetch the TIFF through Vite proxy (avoids CORS issues)
    console.log('[GeoTIFF] Fetching base map …')
    const response = await fetch('/geotiff-proxy/ditu.tif')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    console.log(`[GeoTIFF] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`)

    // 2. Parse the GeoTIFF
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    const origWidth = image.getWidth()
    const origHeight = image.getHeight()
    console.log(`[GeoTIFF] Parsed: ${origWidth} × ${origHeight}`)

    // 3. Read rasters at reduced resolution
    const targetWidth = Math.round(origWidth / DOWNSAMPLE)
    const targetHeight = Math.round(origHeight / DOWNSAMPLE)
    console.log(`[GeoTIFF] Reading at ${targetWidth} × ${targetHeight} (1/${DOWNSAMPLE})`)

    const data = await image.readRasters({
      width: targetWidth,
      height: targetHeight,
      samples: [0, 1, 2], // R, G, B bands
      interleave: true,    // returns a single flat array R,G,B,R,G,B,...
    })

    console.log(`[GeoTIFF] Raster data loaded, length: ${(data as any as Uint8Array).length}`)

    // 4. Create canvas and render the image
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(targetWidth, targetHeight)
    const pixels = imageData.data
    const source = data as any as Uint8Array

    // geotiff.js with interleave: true returns R,G,B,R,G,B,... (3 bytes per pixel)
    // ImageData expects R,G,B,A,R,G,B,A,... (4 bytes per pixel)
    for (let i = 0; i < targetWidth * targetHeight; i++) {
      const srcIdx = i * 3
      const dstIdx = i * 4
      pixels[dstIdx] = source[srcIdx]       // R
      pixels[dstIdx + 1] = source[srcIdx + 1] // G
      pixels[dstIdx + 2] = source[srcIdx + 2] // B
      pixels[dstIdx + 3] = 255               // A
    }

    ctx.putImageData(imageData, 0, 0)
    console.log(`[GeoTIFF] Canvas rendered: ${targetWidth} × ${targetHeight}`)

    // 5. Add as Cesium imagery layer
    const rectangle = Cesium.Rectangle.fromDegrees(WEST, SOUTH, EAST, NORTH)
    const provider = new Cesium.SingleTileImageryProvider({
      image: canvas,
      rectangle: rectangle,
    })

    const layer = viewer.imageryLayers.addImageryProvider(provider)
    console.log('[GeoTIFF] Base map layer added to Cesium')

    tiff.close()
  } catch (err) {
    console.error('[GeoTIFF] Failed to load base map:', err)
  }
}
