<template>
	<div class="tileset-test-page">
		<div class="test-header">
			<h2>3D Tiles 测试页面</h2>
			<p>BIM 对齐 & OSGB 压平功能测试</p>
		</div>

		<!-- OSGB 控制 -->
		<div class="control-section">
			<h3>🏔️ OSGB 倾斜摄影</h3>
			<div class="status-row">
				<span>状态：</span>
				<span :class="osgbStatus.class">{{ osgbStatus.text }}</span>
			</div>
			<button @click="loadOSGB" :disabled="osgbLoading" class="btn-primary">
				{{ osgbLoading ? '加载中...' : '加载 OSGB' }}
			</button>
			<button @click="flyToOSGB" :disabled="!osgbReady" class="btn-secondary">
				飞行到 OSGB
			</button>
		</div>

		<!-- BIM 对齐控制 -->
		<div class="control-section">
			<h3>🏗️ BIM 模型对齐</h3>
			<div class="status-row">
				<span>状态：</span>
				<span :class="bimStatus.class">{{ bimStatus.text }}</span>
			</div>
			<button @click="loadBIM" :disabled="bimLoading" class="btn-primary">
				{{ bimLoading ? '加载中...' : '加载 BIM' }}
			</button>

			<div class="param-group" v-if="bimReady">
				<div class="param-row">
					<label>经度：</label>
					<input type="number" v-model.number="bimParams.longitude" step="0.0001" @change="applyBIMAlignment" />
				</div>
				<div class="param-row">
					<label>纬度：</label>
					<input type="number" v-model.number="bimParams.latitude" step="0.0001" @change="applyBIMAlignment" />
				</div>
				<div class="param-row">
					<label>高程 (m)：</label>
					<input type="number" v-model.number="bimParams.height" step="10" @change="applyBIMAlignment" />
				</div>
				<div class="param-row">
					<label>X轴旋转：</label>
					<input type="number" v-model.number="bimParams.rotationX" step="5" @change="applyBIMAlignment" />
				</div>
				<div class="param-row">
					<label>Z轴旋转：</label>
					<input type="number" v-model.number="bimParams.rotationZ" step="5" @change="applyBIMAlignment" />
				</div>
				<button @click="resetBIMParams" class="btn-secondary">重置参数</button>
			</div>
		</div>

		<!-- 压平控制 -->
		<div class="control-section">
			<h3>📐 压平工具</h3>
			<div class="param-row">
				<label>压平高度：</label>
				<input type="number" v-model.number="flatHeight" step="1" />
			</div>
			<button @click="toggleDrawing" :disabled="!osgbReady" :class="isDrawing ? 'btn-active' : 'btn-primary'">
				{{ isDrawing ? '停止绘制' : '开始绘制压平面' }}
			</button>
			<button @click="clearAllFlatten" :disabled="flattenRegions.length === 0" class="btn-danger">
				清除所有 ({{ flattenRegions.length }})
			</button>
			<p class="hint">{{ drawingHint }}</p>

			<!-- 压平区域列表 -->
			<div v-if="flattenRegions.length > 0" class="region-list">
				<div v-for="region in flattenRegions" :key="region.id" class="region-item">
					<span class="region-id">{{ region.id.substring(0, 12) }}...</span>
					<span class="region-height">H: {{ region.height }}m</span>
					<button @click="removeRegion(region.id)" class="btn-small">删除</button>
				</div>
			</div>
		</div>

		<!-- 状态信息 -->
		<div class="control-section status-section">
			<h3>📊 状态</h3>
			<div class="status-row">
				<span>Viewer：</span>
				<span :class="viewerReady ? 'status-ok' : 'status-error'">
					{{ viewerReady ? '已就绪' : '未初始化' }}
				</span>
			</div>
			<div class="status-row">
				<span>最后操作：</span>
				<span>{{ lastAction }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useFlattenStore } from '@/stores/flatten'
import { TilesetFlatten } from '@/cesium/gis/tools/TilesetFlatten'
import { BIMAlignment, type AlignmentParams } from '@/cesium/gis/tools/BIMAlignment'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const flattenStore = useFlattenStore()

// 状态
const lastAction = ref('等待操作...')
const osgbLoading = ref(false)
const osgbReady = ref(false)
const bimLoading = ref(false)
const bimReady = ref(false)
const isDrawing = ref(false)
const flatHeight = ref(-10)

// BIM 对齐参数
const bimParams = reactive<AlignmentParams>(BIMAlignment.getDefaultParams())

// Tileset 引用
let osgbTileset: any = null
let bimTileset: any = null
let flattenInstance: TilesetFlatten | null = null

// 绘制相关
let drawingHandler: any = null
let drawingPoints: any[] = []
let tempEntities: any[] = []

// 计算属性
const viewerReady = computed(() => !!cesiumStore.viewer)
const flattenRegions = computed(() => flattenStore.regions)

const osgbStatus = computed(() => ({
	text: osgbLoading.value ? '加载中' : osgbReady.value ? '已加载' : '未加载',
	class: osgbReady.value ? 'status-ok' : 'status-pending',
}))

const bimStatus = computed(() => ({
	text: bimLoading.value ? '加载中' : bimReady.value ? '已加载' : '未加载',
	class: bimReady.value ? 'status-ok' : 'status-pending',
}))

const drawingHint = computed(() => {
	if (!osgbReady.value) return 'OSGB 模型需先加载完成'
	if (isDrawing.value) return '左键添加点，右键完成绘制'
	return '点击"开始绘制"在地图上绘制压平区域'
})

// OSGB 模型加载
async function loadOSGB() {
	if (!cesiumStore.viewer) {
		lastAction.value = '❌ Viewer 未就绪'
		return
	}

	osgbLoading.value = true
	try {
		osgbTileset = await Cesium.Cesium3DTileset.fromUrl(
			'http://localhost:8000/tiles/osgb/tileset.json',
			{
				maximumScreenSpaceError: 16,
				skipLevelOfDetail: true,
			}
		)
		cesiumStore.viewer.scene.primitives.add(osgbTileset)
		osgbReady.value = true

		// 初始化压平实例
		flattenInstance = new TilesetFlatten(osgbTileset, { flatHeight: flatHeight.value })

		await cesiumStore.viewer.flyTo(osgbTileset, { duration: 2 })
		lastAction.value = '✅ OSGB 加载完成'
	} catch (e: any) {
		lastAction.value = `❌ OSGB 加载失败: ${e.message}`
		console.error(e)
	} finally {
		osgbLoading.value = false
	}
}

function flyToOSGB() {
	if (osgbTileset && cesiumStore.viewer) {
		cesiumStore.viewer.flyTo(osgbTileset, { duration: 1.5 })
	}
}

// BIM 模型加载
async function loadBIM() {
	if (!cesiumStore.viewer) {
		lastAction.value = '❌ Viewer 未就绪'
		return
	}

	bimLoading.value = true
	try {
		bimTileset = await Cesium.Cesium3DTileset.fromUrl(
			'http://localhost:8000/tiles/bim/tileset.json',
			{
				maximumScreenSpaceError: 16,
			}
		)

		// 应用初始对齐
		BIMAlignment.applyToTileset(bimTileset, bimParams)

		cesiumStore.viewer.scene.primitives.add(bimTileset)
		bimReady.value = true

		await cesiumStore.viewer.flyTo(bimTileset, { duration: 2 })
		lastAction.value = '✅ BIM 加载完成'
	} catch (e: any) {
		lastAction.value = `❌ BIM 加载失败: ${e.message}`
		console.error(e)
	} finally {
		bimLoading.value = false
	}
}

function applyBIMAlignment() {
	if (bimTileset) {
		BIMAlignment.applyToTileset(bimTileset, bimParams)
		lastAction.value = `✅ BIM 对齐更新`
	}
}

function resetBIMParams() {
	const defaults = BIMAlignment.getDefaultParams()
	Object.assign(bimParams, defaults)
	applyBIMAlignment()
}

// 压平绘制
function toggleDrawing() {
	if (isDrawing.value) {
		stopDrawing()
	} else {
		startDrawing()
	}
	isDrawing.value = !isDrawing.value
}

function startDrawing() {
	if (!cesiumStore.viewer) return

	drawingPoints = []
	clearTempEntities()

	drawingHandler = new Cesium.ScreenSpaceEventHandler(cesiumStore.viewer.scene.canvas)

	// 左键添加点
	drawingHandler.setInputAction((event: any) => {
		const ray = cesiumStore.viewer.camera.getPickRay(event.position)
		const position = cesiumStore.viewer.scene.globe.pick(ray, cesiumStore.viewer.scene)

		if (position) {
			drawingPoints.push(position.clone())

			// 添加点标记
			const entity = cesiumStore.viewer.entities.add({
				position,
				point: {
					pixelSize: 8,
					color: Cesium.Color.YELLOW,
					outlineColor: Cesium.Color.BLACK,
					outlineWidth: 2,
				},
			})
			tempEntities.push(entity)

			// 添加连线
			if (drawingPoints.length > 1) {
				const lineEntity = cesiumStore.viewer.entities.add({
					polyline: {
						positions: [drawingPoints[drawingPoints.length - 2], position],
						width: 3,
						material: Cesium.Color.CYAN,
						clampToGround: true,
					},
				})
				tempEntities.push(lineEntity)
			}
		}
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK)

	// 右键完成
	drawingHandler.setInputAction(() => {
		if (drawingPoints.length >= 3) {
			// 闭合多边形
			const closeEntity = cesiumStore.viewer.entities.add({
				polyline: {
					positions: [drawingPoints[drawingPoints.length - 1], drawingPoints[0]],
					width: 3,
					material: Cesium.Color.CYAN,
					clampToGround: true,
				},
			})
			tempEntities.push(closeEntity)

			// 添加压平区域
			if (flattenInstance) {
				const id = flattenInstance.addRegion({
					positions: drawingPoints,
					height: flatHeight.value,
				})

				// 同步到 store
				flattenStore.addRegion({
					id,
					positions: drawingPoints,
					height: flatHeight.value,
				})

				lastAction.value = `✅ 创建压平区域: ${id.substring(0, 12)}...`
			}

			// 显示多边形
			const polygonEntity = cesiumStore.viewer.entities.add({
				polygon: {
					hierarchy: new Cesium.PolygonHierarchy(drawingPoints),
					material: Cesium.Color.GREEN.withAlpha(0.3),
					outline: true,
					outlineColor: Cesium.Color.GREEN,
				},
			})
			tempEntities.push(polygonEntity)
		}

		stopDrawing()
		isDrawing.value = false
	}, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

function stopDrawing() {
	if (drawingHandler) {
		drawingHandler.destroy()
		drawingHandler = null
	}
}

function clearTempEntities() {
	if (cesiumStore.viewer) {
		tempEntities.forEach((entity) => {
			cesiumStore.viewer.entities.remove(entity)
		})
	}
	tempEntities = []
}

function removeRegion(id: string) {
	if (flattenInstance) {
		flattenInstance.removeRegionById(id)
		flattenStore.removeRegion(id)
		lastAction.value = `✅ 删除区域: ${id.substring(0, 12)}...`
	}
}

function clearAllFlatten() {
	if (flattenInstance) {
		flattenInstance.clearAll()
		flattenStore.clearRegions()
		clearTempEntities()
		lastAction.value = '✅ 已清除所有压平区域'
	}
}

// 生命周期
onMounted(() => {
	if (!cesiumStore.viewer) {
		lastAction.value = '等待 Cesium Viewer...'
	}
})

onUnmounted(() => {
	stopDrawing()
	clearTempEntities()

	if (flattenInstance) {
		flattenInstance.destroy()
	}

	if (osgbTileset && cesiumStore.viewer) {
		cesiumStore.viewer.scene.primitives.remove(osgbTileset)
		osgbTileset.destroy()
	}

	if (bimTileset && cesiumStore.viewer) {
		cesiumStore.viewer.scene.primitives.remove(bimTileset)
		bimTileset.destroy()
	}
})
</script>

<style scoped lang="scss">
.tileset-test-page {
	position: fixed;
	top: 80px;
	right: 20px;
	width: 360px;
	max-height: calc(100vh - 100px);
	overflow-y: auto;
	background: rgba(20, 20, 40, 0.98);
	border: 1px solid rgba(34, 211, 238, 0.3);
	border-radius: 8px;
	padding: 16px;
	color: #e0e7ff;
	font-size: 13px;
	z-index: 1000;
	pointer-events: auto;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.test-header {
	margin-bottom: 16px;
	border-bottom: 1px solid rgba(34, 211, 238, 0.2);
	padding-bottom: 12px;

	h2 {
		margin: 0 0 4px;
		font-size: 16px;
		color: #22d3ee;
	}

	p {
		margin: 0;
		font-size: 11px;
		color: #94a3b8;
	}
}

.control-section {
	margin-bottom: 16px;
	padding: 12px;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 6px;

	h3 {
		margin: 0 0 10px;
		font-size: 13px;
		color: #fcd34d;
	}
}

.status-row {
	display: flex;
	justify-content: space-between;
	margin-bottom: 8px;
	font-size: 12px;
}

.status-ok {
	color: #10b981;
}

.status-error {
	color: #ef4444;
}

.status-pending {
	color: #94a3b8;
}

.param-group {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.param-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;

	label {
		flex: 0 0 80px;
		font-size: 12px;
		color: #94a3b8;
	}

	input {
		flex: 1;
		padding: 6px 8px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: #e0e7ff;
		font-size: 12px;

		&:focus {
			outline: none;
			border-color: #22d3ee;
		}
	}
}

button {
	width: 100%;
	padding: 8px 12px;
	margin-bottom: 6px;
	border: none;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	transition: all 0.2s;

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.btn-primary {
	background: rgba(34, 211, 238, 0.15);
	color: #22d3ee;
	border: 1px solid rgba(34, 211, 238, 0.3);

	&:hover:not(:disabled) {
		background: rgba(34, 211, 238, 0.25);
	}
}

.btn-secondary {
	background: rgba(148, 163, 184, 0.1);
	color: #94a3b8;
	border: 1px solid rgba(148, 163, 184, 0.2);

	&:hover:not(:disabled) {
		background: rgba(148, 163, 184, 0.2);
	}
}

.btn-active {
	background: rgba(34, 211, 238, 0.3);
	color: #22d3ee;
	border: 1px solid #22d3ee;
}

.btn-danger {
	background: rgba(239, 68, 68, 0.1);
	color: #ef4444;
	border: 1px solid rgba(239, 68, 68, 0.3);

	&:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.2);
	}
}

.btn-small {
	width: auto;
	padding: 2px 8px;
	font-size: 11px;
	margin: 0;
}

.hint {
	margin: 8px 0 0;
	font-size: 11px;
	color: #94a3b8;
	text-align: center;
}

.region-list {
	margin-top: 12px;
	max-height: 150px;
	overflow-y: auto;
}

.region-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 8px;
	margin-bottom: 4px;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 4px;
	font-size: 11px;

	.region-id {
		flex: 1;
		color: #94a3b8;
		font-family: monospace;
	}

	.region-height {
		color: #22d3ee;
	}
}

.status-section {
	background: rgba(0, 0, 0, 0.3);
}
</style>
