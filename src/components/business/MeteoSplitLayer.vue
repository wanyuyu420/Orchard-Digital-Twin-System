<template>
	<div class="split-container">
		<!-- Cesium 容器 -->
		<div ref="cesiumContainer" class="cesium-full"></div>

		<!-- 分割线（纯视觉） -->
		<div class="split-line" :style="{ left: splitPos + '%' }"></div>

		<!-- 分割手柄（只有手柄可拖拽） -->
		<div class="split-handle" :style="{ left: splitPos + '%' }" @mousedown="startDrag">
			<i class="fa-solid fa-left-right"></i>
		</div>


		<!-- 左下角：雷达图例 -->
		<div class="legend-group left">
			<div class="legend-title">
				<i class="fa-solid fa-satellite-dish"></i>
				雷达回波 (dBZ)
			</div>
			<div class="legend-bar radar-bar"></div>
			<div class="legend-labels">
				<span>10</span>
				<span>25</span>
				<span>40</span>
				<span>55</span>
			</div>
		</div>

		<!-- 右下角：降雨图例 -->
		<div class="legend-group right">
			<div class="legend-title">
				<i class="fa-solid fa-cloud-rain"></i>
				降雨强度 (mm/h)
			</div>
			<div class="legend-bar rainfall-bar"></div>
			<div class="legend-labels">
				<span>0.1</span>
				<span>5</span>
				<span>25</span>
				<span>50</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useMeteoMapStore } from '@/stores/meteoMap'
import { useCesiumStore } from '@/stores/cesium'

declare const Cesium: any

const cesiumContainer = ref<HTMLDivElement | null>(null)
const meteoMapStore = useMeteoMapStore()
const cesiumStore = useCesiumStore()

const splitPos = ref(50) // 分割位置百分比

let viewer: any = null
let radarImageryLayer: any = null
let rainfallImageryLayer: any = null
let particleSystem: any = null

// 默认视角
const DEFAULT_CENTER = { lon: 87.57, lat: 43.82 }
const DEFAULT_HEIGHT = 80000

// 暴露方法给父组件
defineExpose({
	syncFromMain,
	resetView,
	resetSplit,
	setRainfallMode,
	toggleRadarLayer,
	toggleRainfallLayer,
})

onMounted(() => {
	if (!cesiumContainer.value) return

	// 创建独立的Cesium Viewer
	viewer = new Cesium.Viewer(cesiumContainer.value, {
		animation: false,
		timeline: false,
		baseLayerPicker: false,
		fullscreenButton: false,
		infoBox: false,
		homeButton: false,
		geocoder: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		creditContainer: document.createElement('div'),
		imageryProvider: false,
	})

	// 隐藏logo
	const creditDisplay = viewer.cesiumWidget.creditContainer as HTMLElement
	if (creditDisplay) creditDisplay.style.display = 'none'

	// 隐藏导航控件（罗盘、缩放按钮等）
	const navContainer = cesiumContainer.value.querySelector('.cesium-viewer-navigationContainer') as HTMLElement
	if (navContainer) navContainer.style.display = 'none'
	// 备用选择器
	const compassWidget = cesiumContainer.value.querySelector('.compass') as HTMLElement
	if (compassWidget) compassWidget.style.display = 'none'
	const zoomWidget = cesiumContainer.value.querySelector('.navigation-controls') as HTMLElement
	if (zoomWidget) zoomWidget.style.display = 'none'

	// 使用天地图卫星底图（替代ArcGIS，Cesium 1.136兼容）
	// 天地图 Key 请在 .env 中配置 VITE_TIANDITU_KEY
	const tdtKey = import.meta.env.VITE_TIANDITU_KEY || 'YOUR_TIANDITU_KEY'
	const baseLayer = viewer.imageryLayers.addImageryProvider(
		new Cesium.UrlTemplateImageryProvider({
			url: `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tdtKey}`,
			subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
			maximumLevel: 18,
		})
	)
	baseLayer.splitDirection = Cesium.SplitDirection.NONE

	// 设置初始视角
	viewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(
			DEFAULT_CENTER.lon,
			DEFAULT_CENTER.lat,
			DEFAULT_HEIGHT
		),
		orientation: {
			heading: 0,
			pitch: Cesium.Math.toRadians(-60),
			roll: 0,
		},
	})

	// 添加雷达回波图层 (左侧)
	addRadarLayer()

	// 添加降雨图层 (右侧)
	addRainfallLayer()

	// 设置初始分割位置（Cesium 1.136 使用 scene.splitPosition）
	viewer.scene.splitPosition = splitPos.value / 100

	// 监听splitPos变化
	watch(splitPos, (newVal) => {
		if (viewer) {
			viewer.scene.splitPosition = newVal / 100
		}
	})

	// 注册到store
	meteoMapStore.setViewer(viewer)

		// DEBUG: 暴露到window以便调试
		; (window as any).MeteoViewer = viewer
	console.log('[MeteoSplitLayer] Viewer created, layers:', viewer.imageryLayers.length)
})

// 创建雷达回波SingleTileImageryProvider
function createRadarImageryProvider() {
	const canvas = document.createElement('canvas')
	canvas.width = 512
	canvas.height = 512
	const ctx = canvas.getContext('2d')

	if (ctx) {
		ctx.clearRect(0, 0, 512, 512)

		// 雷达回波 - 红黄绿色系
		const gradient1 = ctx.createRadialGradient(180, 230, 10, 180, 230, 180)
		gradient1.addColorStop(0, 'rgba(255, 0, 0, 0.85)')
		gradient1.addColorStop(0.25, 'rgba(255, 100, 0, 0.75)')
		gradient1.addColorStop(0.5, 'rgba(255, 200, 0, 0.65)')
		gradient1.addColorStop(0.75, 'rgba(100, 255, 0, 0.5)')
		gradient1.addColorStop(1, 'rgba(0, 255, 0, 0)')
		ctx.fillStyle = gradient1
		ctx.fillRect(0, 0, 512, 512)

		// 第二个回波中心
		const gradient2 = ctx.createRadialGradient(350, 150, 5, 350, 150, 100)
		gradient2.addColorStop(0, 'rgba(255, 150, 0, 0.8)')
		gradient2.addColorStop(0.5, 'rgba(255, 220, 0, 0.5)')
		gradient2.addColorStop(1, 'rgba(200, 255, 0, 0)')
		ctx.fillStyle = gradient2
		ctx.fillRect(0, 0, 512, 512)

		// 第三个小回波
		const gradient3 = ctx.createRadialGradient(280, 350, 5, 280, 350, 80)
		gradient3.addColorStop(0, 'rgba(255, 200, 0, 0.7)')
		gradient3.addColorStop(0.6, 'rgba(150, 255, 0, 0.4)')
		gradient3.addColorStop(1, 'rgba(0, 255, 0, 0)')
		ctx.fillStyle = gradient3
		ctx.fillRect(0, 0, 512, 512)
	}

	return new Cesium.SingleTileImageryProvider({
		url: canvas.toDataURL(),
		rectangle: Cesium.Rectangle.fromDegrees(85.5, 42.5, 89.5, 45.0),
		tileWidth: 512,
		tileHeight: 512,
	})
}

// 创建降雨栅格SingleTileImageryProvider
function createRainfallImageryProvider() {
	const canvas = document.createElement('canvas')
	canvas.width = 512
	canvas.height = 512
	const ctx = canvas.getContext('2d')

	if (ctx) {
		ctx.clearRect(0, 0, 512, 512)

		// 降雨 - 蓝色系
		const gradient1 = ctx.createRadialGradient(180, 230, 10, 180, 230, 180)
		gradient1.addColorStop(0, 'rgba(0, 50, 150, 0.85)')
		gradient1.addColorStop(0.25, 'rgba(0, 100, 200, 0.75)')
		gradient1.addColorStop(0.5, 'rgba(50, 150, 230, 0.6)')
		gradient1.addColorStop(0.75, 'rgba(100, 200, 255, 0.4)')
		gradient1.addColorStop(1, 'rgba(150, 220, 255, 0)')
		ctx.fillStyle = gradient1
		ctx.fillRect(0, 0, 512, 512)

		// 第二个降雨中心
		const gradient2 = ctx.createRadialGradient(350, 150, 5, 350, 150, 100)
		gradient2.addColorStop(0, 'rgba(0, 80, 180, 0.75)')
		gradient2.addColorStop(0.5, 'rgba(50, 130, 220, 0.5)')
		gradient2.addColorStop(1, 'rgba(100, 180, 255, 0)')
		ctx.fillStyle = gradient2
		ctx.fillRect(0, 0, 512, 512)

		// 第三个
		const gradient3 = ctx.createRadialGradient(280, 350, 5, 280, 350, 80)
		gradient3.addColorStop(0, 'rgba(30, 100, 200, 0.7)')
		gradient3.addColorStop(0.6, 'rgba(80, 160, 240, 0.4)')
		gradient3.addColorStop(1, 'rgba(120, 200, 255, 0)')
		ctx.fillStyle = gradient3
		ctx.fillRect(0, 0, 512, 512)
	}

	return new Cesium.SingleTileImageryProvider({
		url: canvas.toDataURL(),
		rectangle: Cesium.Rectangle.fromDegrees(85.5, 42.5, 89.5, 45.0),
		tileWidth: 512,
		tileHeight: 512,
	})
}

// 添加雷达回波图层
function addRadarLayer() {
	if (!viewer) {
		console.error('[MeteoSplitLayer] addRadarLayer: No viewer!')
		return
	}

	console.log('[MeteoSplitLayer] Adding radar layer...')
	const provider = createRadarImageryProvider()
	radarImageryLayer = viewer.imageryLayers.addImageryProvider(provider)
	radarImageryLayer.splitDirection = Cesium.SplitDirection.LEFT
	console.log(
		'[MeteoSplitLayer] Radar layer added, splitDirection:',
		radarImageryLayer.splitDirection
	)
}

// 添加降雨图层
function addRainfallLayer() {
	if (!viewer) {
		console.error('[MeteoSplitLayer] addRainfallLayer: No viewer!')
		return
	}

	console.log('[MeteoSplitLayer] Adding rainfall layer...')
	const provider = createRainfallImageryProvider()
	rainfallImageryLayer = viewer.imageryLayers.addImageryProvider(provider)
	rainfallImageryLayer.splitDirection = Cesium.SplitDirection.RIGHT
	console.log(
		'[MeteoSplitLayer] Rainfall layer added, splitDirection:',
		rainfallImageryLayer.splitDirection
	)
}

// 添加降雨粒子效果
function addParticleSystem() {
	if (!viewer || particleSystem) return

	const rainCenter = Cesium.Cartesian3.fromDegrees(87.5, 43.75, 8000)

	particleSystem = new Cesium.ParticleSystem({
		modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(rainCenter),
		speed: -1.0,
		lifetime: 10.0,
		emitter: new Cesium.BoxEmitter(new Cesium.Cartesian3(80000.0, 50000.0, 1000.0)),
		startScale: 1.0,
		endScale: 0.8,
		image: createRainDropImage(),
		emissionRate: 8000.0,
		startColor: new Cesium.Color(0.4, 0.6, 0.9, 0.8),
		endColor: new Cesium.Color(0.4, 0.6, 0.9, 0.2),
		imageSize: new Cesium.Cartesian2(8.0, 24.0),
		updateCallback: (particle: any, dt: number) => {
			const gravity = new Cesium.Cartesian3(0.0, 0.0, -150.0 * dt)
			particle.velocity = Cesium.Cartesian3.add(particle.velocity, gravity, particle.velocity)
		},
	})

	viewer.scene.primitives.add(particleSystem)
}

// 移除粒子系统
function removeParticleSystem() {
	if (particleSystem && viewer) {
		viewer.scene.primitives.remove(particleSystem)
		particleSystem = null
	}
}

// 创建雨滴图像
function createRainDropImage(): string {
	const canvas = document.createElement('canvas')
	canvas.width = 8
	canvas.height = 24
	const ctx = canvas.getContext('2d')

	if (ctx) {
		const gradient = ctx.createLinearGradient(4, 0, 4, 24)
		gradient.addColorStop(0, 'rgba(100, 150, 255, 0.0)')
		gradient.addColorStop(0.2, 'rgba(100, 150, 255, 0.9)')
		gradient.addColorStop(0.8, 'rgba(100, 150, 255, 0.6)')
		gradient.addColorStop(1, 'rgba(100, 150, 255, 0.1)')

		ctx.fillStyle = gradient
		ctx.fillRect(3, 0, 2, 24)
	}

	return canvas.toDataURL()
}

// 设置降雨显示模式
function setRainfallMode(mode: 'raster' | 'particle') {
	if (mode === 'raster') {
		if (rainfallImageryLayer) rainfallImageryLayer.show = true
		removeParticleSystem()
	} else {
		if (rainfallImageryLayer) rainfallImageryLayer.show = false
		addParticleSystem()
	}
}

// 切换雷达图层显示
function toggleRadarLayer(show: boolean) {
	if (radarImageryLayer) {
		radarImageryLayer.show = show
	}
}

// 切换降雨图层显示
function toggleRainfallLayer(show: boolean) {
	if (rainfallImageryLayer) {
		rainfallImageryLayer.show = show
	}
	// 如果有粒子系统也一起处理
	if (particleSystem) {
		particleSystem.show = show
	}
}

// 拖拽相关
function startDrag(e: MouseEvent) {
	e.preventDefault()
	document.addEventListener('mousemove', onDrag)
	document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
	const pct = (e.clientX / window.innerWidth) * 100
	splitPos.value = Math.max(10, Math.min(90, pct))
}

function stopDrag() {
	document.removeEventListener('mousemove', onDrag)
	document.removeEventListener('mouseup', stopDrag)
}

// 同步主页视角
function syncFromMain() {
	const mainViewer = cesiumStore.viewer
	if (!mainViewer || !viewer) return

	try {
		const camera = mainViewer.camera
		const cartographic = camera.positionCartographic
		const lon = Cesium.Math.toDegrees(cartographic.longitude)
		const lat = Cesium.Math.toDegrees(cartographic.latitude)
		const height = cartographic.height

		viewer.camera.flyTo({
			destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
			orientation: {
				heading: camera.heading,
				pitch: camera.pitch,
				roll: camera.roll,
			},
			duration: 1,
		})
	} catch (e) {
		console.warn('Failed to sync from main:', e)
	}
}

// 重置视角
function resetView() {
	if (!viewer) return
	viewer.camera.flyTo({
		destination: Cesium.Cartesian3.fromDegrees(
			DEFAULT_CENTER.lon,
			DEFAULT_CENTER.lat,
			DEFAULT_HEIGHT
		),
		orientation: {
			heading: 0,
			pitch: Cesium.Math.toRadians(-60),
			roll: 0,
		},
		duration: 1,
	})
}

// 重置卷帘
function resetSplit() {
	splitPos.value = 50
}

onUnmounted(() => {
	stopDrag()
	removeParticleSystem()
	if (viewer) {
		viewer.destroy()
		viewer = null
	}
})
</script>

<style scoped lang="scss">
.split-container {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	z-index: 1;
	background: #0a0a1a;
	pointer-events: auto;
	/* 确保容器可以接收事件 */
}

.cesium-full {
	width: 100%;
	height: 100%;
}

// 图例组 - 左下角和右下角
.legend-group {
	position: absolute;
	bottom: 120px;
	/* Above dock */
	padding: 12px 16px;
	background: rgba(15, 23, 42, 0.5);
	/* Semi-transparent dark blue */
	border-radius: 8px;
	backdrop-filter: blur(8px);
	z-index: 100;
	pointer-events: none;

	&.left {
		left: 20px;
		border-left: 3px solid #ef4444;

		.legend-title i {
			color: #ef4444;
		}
	}

	&.right {
		right: 20px;
		border-right: 3px solid $neon-cyan;

		.legend-title i {
			color: $neon-cyan;
		}
	}
}

.legend-title {
	font-size: 13px;
	font-weight: 500;
	color: #fff;
	margin-bottom: 8px;
	display: flex;
	align-items: center;
	gap: 8px;

	i {
		font-size: 14px;
	}
}

.legend-bar {
	height: 12px;
	width: 150px;
	border-radius: 2px;
}

.radar-bar {
	background: linear-gradient(90deg, #00ff00 0%, #ffff00 33%, #ff8800 66%, #ff0000 100%);
}

.rainfall-bar {
	background: linear-gradient(90deg, #64c8ff 0%, #3296dc 33%, #1464b4 66%, #003278 100%);
}

.legend-labels {
	display: flex;
	justify-content: space-between;
	margin-top: 4px;
	font-size: 10px;
	color: $text-sub;
}

// 分割线 - 纯视觉元素，不拦截鼠标事件
.split-line {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 3px;
	margin-left: -1.5px;
	z-index: 50;
	pointer-events: none;
	background: linear-gradient(180deg,
			transparent 0%,
			$neon-cyan 10%,
			$neon-cyan 90%,
			transparent 100%);
	box-shadow:
		0 0 15px $neon-cyan,
		0 0 30px rgba($neon-cyan, 0.5);
}

// 分割手柄 - 只有手柄本身可拖拽
.split-handle {
	position: absolute;
	top: 20%;
	/* 更高位置 */
	width: 32px;
	height: 32px;
	margin-left: -16px;
	background: linear-gradient(135deg, rgba($neon-cyan, 0.6) 0%, rgba($neon-cyan, 0.4) 100%);
	border-radius: 50%;
	color: rgba(0, 0, 0, 0.6);
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translateY(-50%);
	box-shadow:
		0 0 8px rgba($neon-cyan, 0.5),
		0 2px 6px rgba(0, 0, 0, 0.2);
	font-size: 12px;
	transition: opacity 0.2s, background 0.2s, color 0.2s, transform 0.2s, box-shadow 0.2s;
	cursor: col-resize;
	pointer-events: auto;
	z-index: 51;
	opacity: 0.7;

	&:hover {
		opacity: 1;
		background: linear-gradient(135deg, rgba($neon-cyan, 0.9) 0%, rgba($neon-cyan, 0.7) 100%);
		color: #000;
		transform: translateY(-50%) scale(1.1);
		box-shadow:
			0 0 20px $neon-cyan,
			0 4px 12px rgba(0, 0, 0, 0.3);
	}
}

:deep(.cesium-widget-credits) {
	display: none !important;
}

// 隐藏导航控件
:deep(.cesium-viewer-navigationContainer),
:deep(.compass),
:deep(.navigation-controls),
:deep(.cesium-navigation-help),
:deep(.distance-legend) {
	display: none !important;
}
</style>
