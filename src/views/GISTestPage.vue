<template>
  <div class="gis-test-page">
    <div class="test-header">
      <h2>GIS 工具测试页面</h2>
      <p>测试新实现的 Graphic 类（Point, Line, Circle, Rectangle, Polygon）</p>
    </div>

    <div class="test-controls">
      <div class="control-section">
        <h3>绘制工具</h3>
        <button @click="testDrawPoint" class="btn-test">测试点绘制</button>
        <button @click="testDrawLine" class="btn-test">测试线绘制</button>
        <button @click="testDrawCircle" class="btn-test">测试圆形</button>
        <button @click="testDrawRectangle" class="btn-test">测试矩形</button>
        <button @click="testDrawPolygon" class="btn-test">测试多边形</button>
      </div>

      <div class="control-section">
        <h3>Graphics 管理</h3>
        <button @click="clearAll" class="btn-danger">清除全部</button>
        <button @click="showGraphicsList" class="btn-test">显示列表</button>
      </div>

      <div class="status-section">
        <h3>状态信息</h3>
        <div class="status-item">
          <span>Cesium Viewer:</span>
          <span :class="viewerStatus">{{ viewerStatus }}</span>
        </div>
        <div class="status-item">
          <span>Graphics 数量:</span>
          <span>{{ graphicsCount }}</span>
        </div>
        <div class="status-item">
          <span>最后操作:</span>
          <span>{{ lastAction }}</span>
        </div>
      </div>
    </div>

    <div class="graphics-list" v-if="showList">
      <h3>已绘制 Graphics</h3>
      <div v-for="graphic in graphics" :key="graphic.id" class="graphic-item">
        <span class="graphic-type">{{ graphic.type }}</span>
        <span class="graphic-id">{{ graphic.id }}</span>
        <button @click="removeGraphic(graphic.id)" class="btn-small">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useGISStore } from '@/stores/gis'
import * as Cesium from 'cesium'

// Import Graphic classes
import { PointGraphic } from '@/cesium/gis/graphics/PointGraphic'
import { LineGraphic } from '@/cesium/gis/graphics/LineGraphic'
import { CircleGraphic } from '@/cesium/gis/graphics/CircleGraphic'
import { RectangleGraphic } from '@/cesium/gis/graphics/RectangleGraphic'
import { PolygonGraphic } from '@/cesium/gis/graphics/PolygonGraphic'
import type { Feature } from '@/types/feature'
import type { FeatureStyle } from '@/types/draw'
import type { Coordinate } from '@/types/geometry'

const cesiumStore = useCesiumStore()
const gisStore = useGISStore()

const lastAction = ref<string>('等待操作...')
const showList = ref(false)
const graphics = ref<any[]>([])

/** 测试用样式：统一填充/描边配置 */
function testStyle(stroke: string, fill = stroke): FeatureStyle {
  return {
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 2,
    pointSize: 10,
    opacity: 1,
    lineType: 'solid',
  }
}

/** Cartesian3 → 经纬度坐标 */
function toCoord(position: Cesium.Cartesian3): Coordinate {
  const carto = Cesium.Cartographic.fromCartesian(position)
  return {
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
  }
}

const viewer = computed(() => cesiumStore.viewer)
const viewerStatus = computed(() => (viewer.value ? '已加载' : '未加载'))
const graphicsCount = computed(() => gisStore.featureCount)

function testDrawPoint() {
  if (!viewer.value) {
    lastAction.value = '错误：Cesium Viewer 未加载'
    return
  }

  try {
    const point = new PointGraphic(viewer.value as Cesium.Viewer, {
      name: '测试点',
      style: {
        pointColor: '#22D3EE',
        pointSize: 10,
      },
    })

    // 在武汉市中心创建一个点
    const position = Cesium.Cartesian3.fromDegrees(114.3055, 30.5928, 100)
    point.create([position])

    // 注册到 GISStore
    const feature = {
      id: point.id,
      type: 'point',
      name: point.name,
      position: toCoord(position),
      style: testStyle('#22D3EE'),
      properties: {},
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Feature
    gisStore.addFeature(feature, point)

    lastAction.value = `✅ 创建点: ${point.id}`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 错误: ${error}`
    console.error('Point creation error:', error)
  }
}

function testDrawLine() {
  if (!viewer.value) {
    lastAction.value = '错误：Cesium Viewer 未加载'
    return
  }

  try {
    const line = new LineGraphic(viewer.value as Cesium.Viewer, {
      name: '测试线',
      style: {
        strokeColor: '#FCD34D',
        strokeWidth: 3,
      },
    })

    // 创建一条简单的线
    const positions = [
      Cesium.Cartesian3.fromDegrees(114.3, 30.59, 100),
      Cesium.Cartesian3.fromDegrees(114.31, 30.595, 100),
      Cesium.Cartesian3.fromDegrees(114.32, 30.59, 100),
    ]
    line.create(positions)

    // 注册到 GISStore
    const feature = {
      id: line.id,
      type: 'line',
      name: line.name,
      vertices: positions.map(toCoord),
      length: 0,
      lineType: 'solid',
      style: testStyle('#FCD34D'),
      properties: {},
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Feature
    gisStore.addFeature(feature, line)

    lastAction.value = `✅ 创建线: ${line.id} (${positions.length} 点)`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 错误: ${error}`
    console.error('Line creation error:', error)
  }
}

function testDrawCircle() {
  if (!viewer.value) {
    lastAction.value = '错误：Cesium Viewer 未加载'
    return
  }

  try {
    const circle = new CircleGraphic(viewer.value as Cesium.Viewer, {
      name: '测试圆',
      style: {
        fillColor: '#F472B6',
        strokeColor: '#EC4899',
        strokeWidth: 2,
      },
    })

    // 创建一个圆：圆心 + 边界点
    const center = Cesium.Cartesian3.fromDegrees(114.305, 30.593, 100)
    const edge = Cesium.Cartesian3.fromDegrees(114.308, 30.593, 100)
    circle.create([center, edge])

    // 注册到 GISStore
    const feature = {
      id: circle.id,
      type: 'circle',
      name: circle.name,
      center: toCoord(center),
      radius: 0,
      area: 0,
      style: testStyle('#EC4899', '#F472B6'),
      properties: {},
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Feature
    gisStore.addFeature(feature, circle)

    lastAction.value = `✅ 创建圆: ${circle.id}`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 错误: ${error}`
    console.error('Circle creation error:', error)
  }
}

function testDrawRectangle() {
  if (!viewer.value) {
    lastAction.value = '错误：Cesium Viewer 未加载'
    return
  }

  try {
    const rectangle = new RectangleGraphic(viewer.value as Cesium.Viewer, {
      name: '测试矩形',
      style: {
        fillColor: '#A78BFA',
        strokeColor: '#8B5CF6',
        strokeWidth: 2,
      },
    })

    // 创建矩形：对角两点
    const corner1 = Cesium.Cartesian3.fromDegrees(114.3, 30.585, 100)
    const corner2 = Cesium.Cartesian3.fromDegrees(114.308, 30.59, 100)
    rectangle.create([corner1, corner2])

    // 注册到 GISStore
    const feature = {
      id: rectangle.id,
      type: 'rectangle',
      name: rectangle.name,
      southwest: toCoord(corner1),
      northeast: toCoord(corner2),
      width: 0,
      height: 0,
      area: 0,
      style: testStyle('#8B5CF6', '#A78BFA'),
      properties: {},
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Feature
    gisStore.addFeature(feature, rectangle)

    lastAction.value = `✅ 创建矩形: ${rectangle.id}`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 错误: ${error}`
    console.error('Rectangle creation error:', error)
  }
}

function testDrawPolygon() {
  if (!viewer.value) {
    lastAction.value = '错误：Cesium Viewer 未加载'
    return
  }

  try {
    const polygon = new PolygonGraphic(viewer.value as Cesium.Viewer, {
      name: '测试多边形',
      style: {
        fillColor: '#34D399',
        strokeColor: '#10B981',
        strokeWidth: 2,
      },
    })

    // 创建一个五边形
    const positions = [
      Cesium.Cartesian3.fromDegrees(114.312, 30.595, 100),
      Cesium.Cartesian3.fromDegrees(114.318, 30.597, 100),
      Cesium.Cartesian3.fromDegrees(114.32, 30.592, 100),
      Cesium.Cartesian3.fromDegrees(114.316, 30.588, 100),
      Cesium.Cartesian3.fromDegrees(114.31, 30.59, 100),
    ]
    polygon.create(positions)

    // 注册到 GISStore
    const feature = {
      id: polygon.id,
      type: 'polygon',
      name: polygon.name,
      vertices: positions.map(toCoord),
      area: 0,
      style: testStyle('#10B981', '#34D399'),
      properties: {},
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Feature
    gisStore.addFeature(feature, polygon)

    lastAction.value = `✅ 创建多边形: ${polygon.id} (${positions.length} 点)`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 错误: ${error}`
    console.error('Polygon creation error:', error)
  }
}

function clearAll() {
  try {
    gisStore.clearFeatures()
    graphics.value = []
    lastAction.value = '✅ 已清除所有 Graphics'
  } catch (error) {
    lastAction.value = `❌ 清除失败: ${error}`
  }
}

function showGraphicsList() {
  showList.value = !showList.value
  if (showList.value) {
    updateGraphicsList()
  }
}

function updateGraphicsList() {
  graphics.value = gisStore.featuresArray.map((f) => ({
    id: f.id,
    type: f.type,
    name: f.name,
  }))
}

function removeGraphic(id: string) {
  try {
    gisStore.removeFeature(id)
    lastAction.value = `✅ 删除 Graphic: ${id}`
    updateGraphicsList()
  } catch (error) {
    lastAction.value = `❌ 删除失败: ${error}`
  }
}

onMounted(() => {
  // 设置 viewer 到 GISStore
  if (viewer.value) {
    gisStore.setViewer(viewer.value as Cesium.Viewer)
    lastAction.value = '✅ GISStore Viewer 已初始化'
  }
})

onUnmounted(() => {
  clearAll()
})
</script>

<style scoped lang="scss">
.gis-test-page {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 400px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  background: rgba(20, 20, 40, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 8px;
  padding: 20px;
  color: #e0e7ff;
  font-size: 14px;
  z-index: 1000;
  pointer-events: auto; /* Enable click events (parent has pointer-events: none) */
}

.test-header {
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(34, 211, 238, 0.2);
  padding-bottom: 15px;

  h2 {
    margin: 0 0 8px;
    color: #22d3ee;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: #94a3b8;
    font-size: 12px;
  }
}

.test-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-section {
  h3 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #fcd34d;
  }

  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-test,
.btn-danger,
.btn-small {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-test {
  background: rgba(34, 211, 238, 0.1);
  color: #22d3ee;
  border: 1px solid rgba(34, 211, 238, 0.3);

  &:hover {
    background: rgba(34, 211, 238, 0.2);
    border-color: rgba(34, 211, 238, 0.5);
  }
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }
}

.btn-small {
  padding: 4px 8px;
  font-size: 11px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-section {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;

  h3 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #a78bfa;
  }
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;

  span:first-child {
    color: #94a3b8;
  }

  span:last-child {
    color: #e0e7ff;
    font-weight: 500;
  }
}

.graphics-list {
  margin-top: 20px;
  border-top: 1px solid rgba(34, 211, 238, 0.2);
  padding-top: 15px;

  h3 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #10b981;
  }
}

.graphic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 12px;

  .graphic-type {
    padding: 2px 8px;
    background: rgba(34, 211, 238, 0.2);
    color: #22d3ee;
    border-radius: 3px;
    font-size: 11px;
  }

  .graphic-id {
    flex: 1;
    color: #94a3b8;
    font-family: monospace;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
