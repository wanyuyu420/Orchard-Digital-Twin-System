/**
 * dem2.tif (GeoTIFF, UTM 50N) → dem.js 转换（Node 版，用项目内 geotiff + proj4）
 *
 * 输出格式严格对齐云服务器 /dem.js：
 *   window.DEM={"minLon":..,"minLat":..,"maxLon":..,"maxLat":..,"nx":100,"ny":100,"zMin":..,"data":[...]}
 *
 * 运行：node scripts/data-processing/dem_to_js.mjs
 */
import { fromFile } from 'geotiff'
import proj4 from 'proj4'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const INPUT = 'D:/Esri_data_4people/dem2.tif'
const OUTPUT = join(__dirname, 'dem.js')
const NX = 100
const NY = 100

const UTM50N = '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs'
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs'

const tiff = await fromFile(INPUT)
const img = await tiff.getImage()

// UTM 边界 → WGS84 经纬度
const bbox = img.getBoundingBox() // [minX, minY, maxX, maxY] (UTM meters)
const [minLon, minLat] = proj4(UTM50N, WGS84, [bbox[0], bbox[1]])
const [maxLon, maxLat] = proj4(UTM50N, WGS84, [bbox[2], bbox[3]])

// 降采样到 100x100
const rasters = await img.readRasters({
  width: NX,
  height: NY,
  samples: [0],
  interleave: false,
})
const raw = rasters[0] // [NY][NX] TypedArray

// nodata 识别（ArcGIS Float32 默认 -3.4e38）
const nodata = img.getGDALNoData()
const isNoData = (v) => {
  if (!Number.isFinite(v)) return true
  if (nodata !== null && nodata !== undefined && Math.abs(v - nodata) < 1e-6) return true
  if (v < -1e30) return true
  return false
}

// 一维化 + 过滤 nodata
const flat = new Float64Array(NY * NX)
let zmin = Infinity
for (let i = 0; i < raw.length; i++) {
  const v = raw[i]
  if (isNoData(v)) {
    flat[i] = NaN
  } else {
    flat[i] = v
    if (v < zmin) zmin = v
  }
}
if (!Number.isFinite(zmin)) zmin = 0
for (let i = 0; i < flat.length; i++) {
  if (!Number.isFinite(flat[i])) flat[i] = zmin
}

// 翻转行：geotiff row0=北 → dem.js 要求 data[0]=南
const flipped = new Float64Array(NY * NX)
for (let y = 0; y < NY; y++) {
  for (let x = 0; x < NX; x++) {
    flipped[y * NX + x] = flat[(NY - 1 - y) * NX + x]
  }
}

const arr = []
for (let i = 0; i < flipped.length; i++) arr.push(flipped[i].toFixed(2))

const content =
  `window.DEM={"minLon": ${minLon}, "minLat": ${minLat}, ` +
  `"maxLon": ${maxLon}, "maxLat": ${maxLat}, "nx": ${NX}, "ny": ${NY}, ` +
  `"zMin": ${zmin.toFixed(2)}, "data": [${arr.join(', ')}]}`

writeFileSync(OUTPUT, content, 'utf8')

console.log('[OK] dem.js 生成完成:', OUTPUT)
console.log(`  边界(WGS84): ${minLon.toFixed(8)}, ${minLat.toFixed(8)}, ${maxLon.toFixed(8)}, ${maxLat.toFixed(8)}`)
console.log(`  网格: ${NX} x ${NY}, zMin = ${zmin.toFixed(2)}`)
console.log(`  文件大小: ${(content.length / 1024).toFixed(1)} KB`)

tiff.close()
