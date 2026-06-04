/**
 * Manual Test Runner (Without Test Framework)
 *
 * 在没有测试框架的情况下，手动验证向后兼容性
 */

console.log('========================================')
console.log('  Manual Compatibility Test')
console.log('========================================\n')

let passCount = 0
let failCount = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ PASS: ${name}`)
    passCount++
  } catch (error) {
    console.log(`❌ FAIL: ${name}`)
    console.log(`   Error: ${error.message}`)
    failCount++
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`)
  }
}

// Test 1: 文件存在性检查
console.log('📁 Test Group 1: File Existence\n')

const fs = require('fs')
const path = require('path')

test('BaseTool.ts exists', () => {
  const filePath = path.join(__dirname, '../core/BaseTool.ts')
  assertTrue(fs.existsSync(filePath), 'BaseTool.ts should exist')
})

test('BaseGraphic.ts exists', () => {
  const filePath = path.join(__dirname, '../core/BaseGraphic.ts')
  assertTrue(fs.existsSync(filePath), 'BaseGraphic.ts should exist')
})

test('MeasureTool.ts exists', () => {
  const filePath = path.join(__dirname, '../tools/MeasureTool.ts')
  assertTrue(fs.existsSync(filePath), 'MeasureTool.ts should exist')
})

test('volume.ts exists', () => {
  const filePath = path.join(__dirname, '../utils/volume.ts')
  assertTrue(fs.existsSync(filePath), 'volume.ts should exist')
})

test('gis.ts store exists', () => {
  const filePath = path.join(__dirname, '../../../stores/gis.ts')
  assertTrue(fs.existsSync(filePath), 'gis.ts store should exist')
})

test('geometry.ts types exist', () => {
  const filePath = path.join(__dirname, '../../../types/geometry.ts')
  assertTrue(fs.existsSync(filePath), 'geometry.ts should exist')
})

// Test 2: 类型定义检查
console.log('\n📝 Test Group 2: Type Definitions\n')

test('geometry.ts exports Coordinate3D', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../types/geometry.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export interface Coordinate3D'),
    'Should export Coordinate3D interface'
  )
})

test('geometry.ts exports HeightReference', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../types/geometry.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export enum HeightReference'),
    'Should export HeightReference enum'
  )
})

test('geometry.ts has is3D type guard', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../types/geometry.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export function is3D'),
    'Should have is3D type guard'
  )
})

// Test 3: Store 向后兼容性
console.log('\n🏪 Test Group 3: Store Backward Compatibility\n')

test('gis.ts exports useGISStore', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../stores/gis.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export const useGISStore'),
    'Should export useGISStore'
  )
})

test('gis.ts exports useMeasureStore alias', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../stores/gis.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export const useMeasureStore = useGISStore'),
    'Should export useMeasureStore alias'
  )
})

test('gis.ts has measurements array', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../stores/gis.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('measurements = ref<Measurement[]>'),
    'Should have measurements array'
  )
})

test('gis.ts has addMeasurement method', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../stores/gis.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('function addMeasurement'),
    'Should have addMeasurement method'
  )
})

test('gis.ts has clearAll method', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../stores/gis.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('function clearAll'),
    'Should have clearAll method'
  )
})

// Test 4: 组件更新检查
console.log('\n🔄 Test Group 4: Component Updates\n')

test('MeasurePanel.vue imports from gis store', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../components/common/MeasurePanel.vue'),
    'utf-8'
  )
  assertTrue(
    content.includes("from '@/stores/gis'"),
    'MeasurePanel should import from gis store'
  )
})

test('MeasureLayer.vue imports useGISStore', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../components/cesium/MeasureLayer.vue'),
    'utf-8'
  )
  assertTrue(
    content.includes('useGISStore'),
    'MeasureLayer should use useGISStore'
  )
})

test('MeasureLayer.vue imports MeasureTool', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../../../components/cesium/MeasureLayer.vue'),
    'utf-8'
  )
  assertTrue(
    content.includes('MeasureTool'),
    'MeasureLayer should import MeasureTool'
  )
})

// Test 5: 开源归属检查
console.log('\n📜 Test Group 5: Open Source Attribution\n')

test('cesium-drawer ATTRIBUTION.md exists', () => {
  const filePath = path.join(__dirname, '../vendor/cesium-drawer/ATTRIBUTION.md')
  assertTrue(fs.existsSync(filePath), 'cesium-drawer attribution should exist')
})

test('cesium_dev_kit ATTRIBUTION.md exists', () => {
  const filePath = path.join(__dirname, '../vendor/ATTRIBUTION_cesium_dev_kit.md')
  assertTrue(fs.existsSync(filePath), 'cesium_dev_kit attribution should exist')
})

test('cesium-drawer attribution mentions MIT', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../vendor/cesium-drawer/ATTRIBUTION.md'),
    'utf-8'
  )
  assertTrue(
    content.includes('MIT License'),
    'Attribution should mention MIT License'
  )
})

// Test 6: 核心类结构检查
console.log('\n🏗️  Test Group 6: Core Class Structure\n')

test('BaseTool has activate method', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../core/BaseTool.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('public activate()'),
    'BaseTool should have activate method'
  )
})

test('BaseTool has deactivate method', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../core/BaseTool.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('public deactivate()'),
    'BaseTool should have deactivate method'
  )
})

test('BaseGraphic has create method', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../core/BaseGraphic.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('public abstract create'),
    'BaseGraphic should have abstract create method'
  )
})

test('MeasureTool extends BaseTool', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../tools/MeasureTool.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('extends BaseTool'),
    'MeasureTool should extend BaseTool'
  )
})

// Test 7: 工具函数检查
console.log('\n🔧 Test Group 7: Utility Functions\n')

test('volume.ts exports computeCutVolume', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../utils/volume.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export function computeCutVolume'),
    'Should export computeCutVolume function'
  )
})

test('volume.ts exports formatVolume', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../utils/volume.ts'),
    'utf-8'
  )
  assertTrue(
    content.includes('export function formatVolume'),
    'Should export formatVolume function'
  )
})

// Summary
console.log('\n========================================')
console.log('  Test Summary')
console.log('========================================')
console.log(`Total:  ${passCount + failCount} tests`)
console.log(`Passed: ${passCount} tests`)
console.log(`Failed: ${failCount} tests`)
console.log('========================================\n')

if (failCount === 0) {
  console.log('✅ All tests passed!\n')
  process.exit(0)
} else {
  console.log('❌ Some tests failed!\n')
  process.exit(1)
}
