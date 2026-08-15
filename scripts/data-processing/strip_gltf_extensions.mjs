/**
 * 剥离 ArcGIS Pro 导出的 3D Tiles glb 中的 EXT_structural_metadata 扩展和 uvRegions 属性，
 * 转成标准 glTF，使 Cesium 能正常加载。
 *
 * 输出到 3Dtiles_stripped/（保留原始 3Dtiles/），tileset.json 原样复制（uri 不变）。
 * 运行：node scripts/data-processing/strip_gltf_extensions.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
import { EXTStructuralMetadata } from '@gltf-transform/extensions'
import { readdir, mkdir, copyFile } from 'fs/promises'
import { join } from 'path'

const SRC = 'D:/Esri_data_4people/3Dtiles'
const DST = 'D:/Esri_data_4people/3Dtiles_stripped'

const io = new NodeIO().registerExtensions([EXTStructuralMetadata])

await mkdir(DST, { recursive: true })
await copyFile(join(SRC, 'tileset.json'), join(DST, 'tileset.json'))

let count = 0
let failed = 0
for (const dir of ['0', '1', '2']) {
  const srcDir = join(SRC, dir)
  const dstDir = join(DST, dir)
  await mkdir(dstDir, { recursive: true })
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.glb'))

  for (const f of files) {
    const srcPath = join(srcDir, f)
    const dstPath = join(dstDir, f)
    try {
      const doc = await io.read(srcPath)
      const root = doc.getRoot()

      // 移除 uvRegions 自定义属性
      for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          prim.setAttribute('uvRegions', null)
        }
      }

      // 移除 EXT_structural_metadata 扩展
      const ext = root.getExtension(EXTStructuralMetadata)
      if (ext) ext.dispose()

      // 清理不再被引用的 accessor / bufferView
      await doc.transform(prune())

      await io.write(dstPath, doc)
      count++
      if (count % 20 === 0) console.log(`已处理 ${count} 个...`)
    } catch (e) {
      failed++
      console.error(`处理失败 ${dir}/${f}:`, e.message)
    }
  }
}

console.log(`完成：成功 ${count} 个，失败 ${failed} 个 → ${DST}`)
