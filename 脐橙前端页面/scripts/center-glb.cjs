/**
 * center-glb.cjs — Center CityEngine GLB coordinates around (0,0,0)
 *
 * The original tree3D_0.glb has baked-in UTM coordinates (~450187, 187, -3001244).
 * This script subtracts the UTM origin from ALL vertex positions and node matrices,
 * making the geometry centered at (0,0,0) so Cesium Entity positioning works.
 */
const fs = require('fs')
const path = require('path')

// UTM origin from Node 0 matrix translation
const OX = 450187
const OY = 187
const OZ = -3001244

const GLB_PATH = path.resolve(__dirname, '../public/models/orchard/tree3D_0.glb')
const OUTPUT_PATH = path.resolve(__dirname, '../public/models/orchard/tree3D_0_centered.glb')

function main() {
  const buf = fs.readFileSync(GLB_PATH)
  const dv = new DataView(buf.buffer)

  // === 1. Find BIN chunk reliably ===
  let binDataOff = -1
  let binLen = -1
  for (let i = 0; i < buf.length - 8; i++) {
    if (dv.getUint32(i, true) === 0x004e4942) { // "BIN\0"
      binLen = dv.getUint32(i - 4, true)
      binDataOff = i + 4
      break
    }
  }
  if (binDataOff < 0) throw new Error('BIN chunk not found')
  console.log(`BIN data at file offset ${binDataOff}, length ${binLen}`)

  // === 2. Read JSON chunk ===
  const jsonChunkLen = dv.getUint32(12, true)
  const jsonStr = buf.toString('utf-8', 20, 20 + jsonChunkLen).replace(/\0+$/, '')
  const gltf = JSON.parse(jsonStr)
  console.log(`JSON chunk length: ${jsonChunkLen}`)

  // === 3. Modify node matrices (in JSON) ===
  let matrixCount = 0
  gltf.nodes.forEach((node) => {
    if (node.matrix) {
      node.matrix[12] -= OX
      node.matrix[13] -= OY
      node.matrix[14] -= OZ
      matrixCount++
    }
  })
  console.log(`Modified ${matrixCount} node matrices`)
  console.log(`  Node 0: (${gltf.nodes[0].matrix[12].toFixed(4)}, ${gltf.nodes[0].matrix[13].toFixed(4)}, ${gltf.nodes[0].matrix[14].toFixed(4)})`)

  // === 4. Modify terrain vertex positions (in BIN) ===
  const acc = gltf.accessors[6]
  const bv = gltf.bufferViews[acc.bufferView]
  const vertOff = binDataOff + (bv.byteOffset || 0) + (acc.byteOffset || 0)
  const count = acc.count

  console.log(`Terrain accessor 6: ${count} vertices at file offset ${vertOff}`)
  console.log(`  Original min: [${acc.min.map(v => v.toFixed(2)).join(', ')}]`)
  console.log(`  Original max: [${acc.max.map(v => v.toFixed(2)).join(', ')}]`)

  // Update accessor min/max
  acc.min = [acc.min[0] - OX, acc.min[1] - OY, acc.min[2] - OZ]
  acc.max = [acc.max[0] - OX, acc.max[1] - OY, acc.max[2] - OZ]

  // Read & modify vertex buffer
  const view = new DataView(buf.buffer, vertOff)
  for (let i = 0; i < count; i++) {
    const off = i * 12
    const x = view.getFloat32(off, true)
    const y = view.getFloat32(off + 4, true)
    const z = view.getFloat32(off + 8, true)
    view.setFloat32(off, x - OX, true)
    view.setFloat32(off + 4, y - OY, true)
    view.setFloat32(off + 8, z - OZ, true)
    if (i < 3) {
      console.log(`  Vertex ${i}: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) → (${(x-OX).toFixed(2)}, ${(y-OY).toFixed(2)}, ${(z-OZ).toFixed(2)})`)
    }
  }
  console.log(`  New min: [${acc.min.map(v => v.toFixed(2)).join(', ')}]`)
  console.log(`  New max: [${acc.max.map(v => v.toFixed(2)).join(', ')}]`)

  // === 5. Write back modified JSON (must fit within original length) ===
  const newJson = JSON.stringify(gltf)
  if (newJson.length > jsonChunkLen) {
    // Try removing all optional whitespace
    const compact = JSON.stringify(gltf)
    if (compact.length > jsonChunkLen) {
      console.error(`FATAL: JSON too long: ${newJson.length} > ${jsonChunkLen}. Cannot proceed.`)
      process.exit(1)
    }
    // Pad compact JSON to fill original chunk
    const jsonBuf = Buffer.alloc(jsonChunkLen)
    jsonBuf.write(compact, 0, compact.length, 'utf-8')
    jsonBuf.fill(0x20, compact.length)
    jsonBuf.copy(buf, 20, 0, jsonChunkLen)
    console.log(`  Used compact JSON: ${compact.length} bytes + padding = ${jsonChunkLen}`)
  } else {
    Buffer.from(newJson).copy(buf, 20, 0, newJson.length)
    buf.fill(0x20, 20 + newJson.length, 20 + jsonChunkLen)
    console.log(`  JSON written: ${newJson.length} bytes + padding = ${jsonChunkLen}`)
  }

  fs.writeFileSync(OUTPUT_PATH, buf)
  const outSize = fs.statSync(OUTPUT_PATH).size
  console.log(`\n✅ Written: ${OUTPUT_PATH}`)
  console.log(`   Size: ${outSize} bytes (original: ${buf.length})`)
}

main()
