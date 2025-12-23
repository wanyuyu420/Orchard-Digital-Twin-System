<template>
	<header class="top-ribbon">
		<!-- Left: Info -->
		<div class="left-info">
			<div class="info-item"><i class="fa-solid fa-cloud-rain"></i> 武汉: 暴雨</div>
			<div class="info-item font-mono text-neon">{{ timeStr }}</div>
		</div>

		<!-- Center: Brand -->
		<div class="center-brand">
			<div class="brand-glow"></div>
			<i class="fa-solid fa-water fa-xl text-neon brand-icon"></i>
			<span class="brand-text">水利数字孪生基础平台 <span class="version-tag">V3.0</span></span>
		</div>

		<!-- Right: Tools -->
		<div class="right-tools">
			<!-- 3D Analysis Tools -->
			<div class="tool-group">
				<button class="btn-icon-text" :class="{ active: gisStore.toolType === 'volume' }"
					@click="toggleAnalysisTool('volume')" title="方量分析">
					<i class="fa-solid fa-cubes-stacked"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: gisStore.toolType === 'flood' }"
					@click="toggleAnalysisTool('flood')" title="淹没分析">
					<i class="fa-solid fa-water"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: gisStore.toolType === 'profile' }"
					@click="toggleAnalysisTool('profile')" title="剖面分析">
					<i class="fa-solid fa-chart-line"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: gisStore.toolType === 'measure3d' }"
					@click="toggleAnalysisTool('measure3d')" title="3D测量 (Shift:地形/Ctrl:自定义/Alt:相对)">
					<i class="fa-solid fa-ruler-combined"></i>
				</button>
			</div>

			<div class="tool-divider"></div>

			<!-- Drawing Tools -->
			<div class="tool-group">
				<button class="btn-icon-text" :class="{ active: drawTool === 'point' }" @click="toggleDrawTool('point')"
					title="点标注">
					<i class="fa-solid fa-map-pin"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: drawTool === 'line' }" @click="toggleDrawTool('line')"
					title="线绘制">
					<i class="fa-solid fa-route"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: drawTool === 'polygon' }" @click="toggleDrawTool('polygon')"
					title="多边形">
					<i class="fa-solid fa-draw-polygon"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: drawTool === 'circle' }" @click="toggleDrawTool('circle')"
					title="圆形">
					<i class="fa-solid fa-circle"></i>
				</button>
				<button class="btn-icon-text" :class="{ active: drawTool === 'rectangle' }" @click="toggleDrawTool('rectangle')"
					title="矩形">
					<i class="fa-solid fa-square"></i>
				</button>
			</div>

			<div class="tool-divider"></div>

			<!-- Map & System Controls -->
			<div class="tool-group">
				<button class="btn-icon" @click="flyToDefault" title="复位视角">
					<i class="fa-solid fa-crosshairs"></i>
				</button>
				<div class="btn-icon-wrapper">
					<button class="btn-icon" @click="toggleMapPanel" :class="{ active: isMapPanelVisible }" title="底图控制">
						<i class="fa-solid fa-layer-group"></i>
					</button>
					<!-- Map Control Panel (dropdown below button) -->
					<transition name="dropdown">
						<div v-show="isMapPanelVisible" class="map-control-panel">
							<div class="panel-section">
								<div class="section-header">
									<span>科技风滤镜</span>
									<label class="switch">
										<input type="checkbox" v-model="filterState.enabled" @change="handleFilterChange" />
										<span class="slider"></span>
									</label>
								</div>
							</div>

							<div class="panel-section" v-if="filterState.enabled">
								<div class="section-label">滤镜颜色</div>
								<div class="color-row">
									<input type="color" v-model="filterState.color" @change="handleFilterChange" class="color-picker" />
									<div class="preset-colors">
										<span v-for="preset in presetColors" :key="preset.color" class="color-dot"
											:style="{ background: preset.color }" :title="preset.name"
											@click="applyPreset(preset.color)"></span>
									</div>
								</div>
							</div>

							<div class="panel-section">
								<div class="section-label">底图样式</div>
								<div class="basemap-grid">
									<div class="basemap-item" :class="{ active: mapType === 'amap' }" @click="selectBasemap('amap')">
										<div class="thumb amap"></div>
										<span>高德</span>
									</div>
									<div class="basemap-item" :class="{ active: mapType === 'tdt_vec' }"
										@click="selectBasemap('tdt_vec')">
										<div class="thumb vec"></div>
										<span>矢量</span>
									</div>
									<div class="basemap-item" :class="{ active: mapType === 'tdt_ter' }"
										@click="selectBasemap('tdt_ter')">
										<div class="thumb ter"></div>
										<span>地形</span>
									</div>
									<div class="basemap-item" :class="{ active: mapType === 'tdt_img' }"
										@click="selectBasemap('tdt_img')">
										<div class="thumb img"></div>
										<span>影像</span>
									</div>
								</div>
							</div>
						</div>
					</transition>
				</div>
				<button class="btn-icon" @click="toggleUi" :title="isUiHidden ? '显示面板' : '隐藏面板'">
					<i class="fa-solid" :class="isUiHidden ? 'fa-eye-slash' : 'fa-eye'"></i>
				</button>
				<button class="btn-icon" @click="toggleFullscreen" title="全屏">
					<i class="fa-solid" :class="isFullscreen ? 'fa-compress' : 'fa-expand'"></i>
				</button>
			</div>
		</div>
	</header>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useCesiumStore } from '@/stores/cesium'
import { useGISStore } from '@/stores/gis'
import { baseInkStyle, baseColorStyle } from '@/mock/baseMapData'
import type { DrawToolType, AnalysisToolType } from '@/types/draw'

declare const Cesium: any

const appStore = useAppStore()
const cesiumStore = useCesiumStore()
const gisStore = useGISStore()
const isUiHidden = computed(() => appStore.isUiHidden)

// Use activeTool to determine which type of tool is active
const drawTool = computed(() => {
	const tool = gisStore.activeTool as string | null
	return tool === 'draw-point' ||
		tool === 'point' ||
		tool === 'draw-line' ||
		tool === 'line' ||
		tool === 'draw-polygon' ||
		tool === 'polygon' ||
		tool === 'draw-circle' ||
		tool === 'circle' ||
		tool === 'draw-rectangle' ||
		tool === 'rectangle'
		? (tool as DrawToolType)
		: null
})

const timeStr = ref('')
const isFullscreen = ref(false)
const isMapPanelVisible = ref(false)

let timer: ReturnType<typeof setInterval>

// Filter state
const filterState = reactive({
	enabled: false,
	color: '#4E70A6',
})

// Map type
const mapType = ref('amap')

// Preset colors
const presetColors = [
	{ name: '科技蓝', color: '#4E70A6' },
	{ name: '深海蓝', color: '#003C78' },
	{ name: '森林绿', color: '#006450' },
	{ name: '暗紫色', color: '#3C2850' },
	{ name: '棕褐色', color: '#503C28' },
	{ name: '深邃黑', color: '#141428' },
]

// Track imagery layers
let originalLayers: any[] = []
const mapLayers: Record<string, any[]> = {
	amap: [],
	tdt_vec: [],
	tdt_ter: [],
	tdt_img: [],
}
// 天地图 Key 请在 .env 中配置 VITE_TIANDITU_KEY
const tdtKey = import.meta.env.VITE_TIANDITU_KEY || 'YOUR_TIANDITU_KEY'

const updateTime = () => {
	const now = new Date()
	timeStr.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}

function toggleUi() {
	appStore.toggleUi()
}

function toggleFullscreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen()
		isFullscreen.value = true
	} else {
		document.exitFullscreen()
		isFullscreen.value = false
	}
}

function toggleMapPanel() {
	isMapPanelVisible.value = !isMapPanelVisible.value
}

function flyToDefault() {
	cesiumStore.flyToDefault(1.5)
}

// Apply style to layers
const applyLayerStyle = (layers: any[], style: typeof baseInkStyle) => {
	if (!layers || !layers.length) return
	layers.forEach((layer: any) => {
		layer.saturation = style.saturation
		layer.brightness = style.brightness
		layer.contrast = style.contrast
		layer.gamma = style.gamma
		layer.hue = style.hue
	})
}

// Update globe filter uniforms
const updateUniforms = () => {
	const viewer = (window as any).Gviewer
	if (!viewer || !viewer.scene || !viewer.scene.globe) return

	const globe = viewer.scene.globe
	globe.filterEnabled = filterState.enabled

	if (filterState.enabled) {
		const color = Cesium.Color.fromCssColorString(filterState.color)
		globe.filterColor = new Cesium.Cartesian3(color.red, color.green, color.blue)
		globe.filterExposure = 1.25
		globe.filterContrast = 1.1
	}

	const activeLayers = mapLayers[mapType.value] || []
	applyLayerStyle(activeLayers, filterState.enabled ? baseInkStyle : baseColorStyle)
}

function handleFilterChange() {
	updateUniforms()
}

function applyPreset(color: string) {
	filterState.color = color
	filterState.enabled = true
	updateUniforms()
}

// Ensure Tianditu layers exist
const ensureTdtLayers = (val: string) => {
	const viewer = (window as any).Gviewer
	if (!viewer) return []
	if (mapLayers[val] && mapLayers[val].length) return mapLayers[val]

	let layersToAdd: string[] = []
	if (val === 'tdt_vec') layersToAdd = ['vec_w', 'cva_w']
	if (val === 'tdt_ter') layersToAdd = ['ter_w', 'cta_w']
	if (val === 'tdt_img') layersToAdd = ['img_w', 'cia_w']

	layersToAdd.forEach((layerName) => {
		const provider = new Cesium.UrlTemplateImageryProvider({
			url: `https://t{s}.tianditu.gov.cn/DataServer?T=${layerName}&x={x}&y={y}&l={z}&tk=${tdtKey}`,
			subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
			maximumLevel: 18,
		})
		const layer = viewer.imageryLayers.addImageryProvider(provider)
		mapLayers[val].push(layer)
	})
	return mapLayers[val]
}

const hideAllBaseLayers = () => {
	Object.values(mapLayers).forEach((arr) => {
		arr.forEach((layer: any) => {
			layer.show = false
		})
	})
}

function selectBasemap(type: string) {
	const viewer = (window as any).Gviewer
	if (!viewer) return

	mapType.value = type
	hideAllBaseLayers()

	const targetLayers = type === 'amap' ? mapLayers.amap : ensureTdtLayers(type)
	targetLayers.forEach((layer: any) => {
		layer.show = true
	})

	updateUniforms()
}

function toggleAnalysisTool(tool: AnalysisToolType) {
	// Toggle: if clicking the same tool, deactivate it; otherwise, activate it
	if (gisStore.activeTool === tool) {
		gisStore.setTool(null)
	} else {
		gisStore.setTool(tool)
	}
}

function toggleDrawTool(tool: DrawToolType) {
	// Toggle: if clicking the same tool, deactivate it; otherwise, activate it
	if (gisStore.activeTool === tool) {
		gisStore.setTool(null)
	} else {
		// Activate the selected tool (will automatically deactivate other tools)
		gisStore.setTool(tool)
	}
}

// Initialize globe filter system
const initGlobeFilter = () => {
	const viewer = (window as any).Gviewer
	if (!viewer || !viewer.scene || !viewer.scene.globe) return false

	const len = viewer.imageryLayers.length
	for (let i = 0; i < len; i++) {
		originalLayers.push(viewer.imageryLayers.get(i))
	}
	mapLayers.amap = originalLayers
	updateUniforms()
	return true
}

// Close panel when clicking outside
function handleClickOutside(e: MouseEvent) {
	const target = e.target as HTMLElement
	if (!target.closest('.btn-icon-wrapper') && isMapPanelVisible.value) {
		isMapPanelVisible.value = false
	}
}

onMounted(() => {
	updateTime()
	timer = setInterval(updateTime, 1000)

	// Wait for Cesium viewer to be ready
	const initTimer = setInterval(() => {
		if (initGlobeFilter()) {
			clearInterval(initTimer)
		}
	}, 300)

	document.addEventListener('click', handleClickOutside)

	document.addEventListener('fullscreenchange', () => {
		isFullscreen.value = !!document.fullscreenElement
	})
})

onUnmounted(() => {
	clearInterval(timer)
	document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.top-ribbon {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 70px;
	background: linear-gradient(180deg, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.6) 100%);
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	padding: 0 24px;
	z-index: $z-layer-4;
	border-bottom: 1px solid rgba(34, 211, 238, 0.1);
	backdrop-filter: blur(4px);
	pointer-events: auto;
}

.left-info {
	display: flex;
	gap: 24px;
	color: $text-sub;
	font-size: 13px;

	.info-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.text-neon {
		color: $neon-cyan;
	}

	.font-mono {
		font-family: $font-code;
	}
}

.center-brand {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;

	.brand-text {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
	}

	.brand-icon {
		margin-right: 12px;
		color: $neon-cyan;
	}

	.version-tag {
		font-size: 10px;
		background: rgba(34, 211, 238, 0.15);
		color: $neon-cyan;
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid rgba(34, 211, 238, 0.3);
		vertical-align: top;
		margin-left: 4px;
	}

	.brand-glow {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 60%;
		height: 2px;
		background: radial-gradient(circle, $neon-cyan 0%, transparent 100%);
		box-shadow: 0 -2px 10px $neon-cyan;
	}
}

.right-tools {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 16px;
}

.tool-group {
	display: flex;
	gap: 8px;
	background: rgba(255, 255, 255, 0.03);
	padding: 4px;
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.tool-divider {
	width: 1px;
	height: 24px;
	background: rgba(255, 255, 255, 0.1);
}

.btn-icon-text {
	width: 36px;
	height: 36px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: $text-sub;
	cursor: pointer;
	transition: all 0.2s;
	font-size: 16px;
	border: 1px solid transparent;
	background: transparent;

	&:hover {
		background: $glass-hover;
		color: #fff;
	}

	&.active {
		background: $neon-cyan;
		color: #000;
		box-shadow: 0 0 10px $neon-cyan;
	}
}

.btn-icon {
	@extend .btn-icon-text;
	width: 32px;
	height: 32px;
}

.btn-icon-wrapper {
	position: relative;
}

// Map Control Panel
.map-control-panel {
	position: absolute;
	top: calc(100% + 12px);
	right: 0;
	width: 240px;
	background: rgba(2, 6, 23, 0.95);
	border: 1px solid rgba($neon-cyan, 0.3);
	border-radius: 8px;
	padding: 12px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	z-index: 1000;

	&::before {
		content: '';
		position: absolute;
		top: -6px;
		right: 12px;
		width: 12px;
		height: 12px;
		background: rgba(2, 6, 23, 0.95);
		border-left: 1px solid rgba($neon-cyan, 0.3);
		border-top: 1px solid rgba($neon-cyan, 0.3);
		transform: rotate(45deg);
	}
}

.panel-section {
	margin-bottom: 12px;

	&:last-child {
		margin-bottom: 0;
	}
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 13px;
	color: $text-main;
}

.section-label {
	font-size: 11px;
	color: $text-sub;
	margin-bottom: 8px;
}

.color-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.color-picker {
	width: 32px;
	height: 32px;
	border: 1px solid rgba($neon-cyan, 0.3);
	border-radius: 4px;
	background: transparent;
	cursor: pointer;
	padding: 2px;

	&::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	&::-webkit-color-swatch {
		border-radius: 2px;
		border: none;
	}
}

.preset-colors {
	display: flex;
	gap: 6px;
	flex: 1;
}

.color-dot {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	cursor: pointer;
	border: 2px solid rgba(255, 255, 255, 0.1);
	transition: all 0.2s;

	&:hover {
		transform: scale(1.15);
		border-color: #fff;
	}
}

.basemap-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
}

.basemap-item {
	cursor: pointer;
	text-align: center;
	border: 1px solid transparent;
	border-radius: 4px;
	padding: 4px;
	transition: all 0.2s;

	.thumb {
		height: 32px;
		width: 100%;
		border-radius: 3px;
		margin-bottom: 4px;
	}

	.thumb.vec {
		background: linear-gradient(135deg, #e8e8e8 0%, #c8c8c8 100%);
	}

	.thumb.ter {
		background: linear-gradient(135deg, #5a6b48 0%, #3d4a32 100%);
	}

	.thumb.img {
		background: linear-gradient(135deg, #1a3a5c 0%, #0a1a2a 100%);
	}

	.thumb.amap {
		background: linear-gradient(135deg, #f0f0f0 0%, #d8d8d8 100%);
	}

	span {
		font-size: 10px;
		color: $text-sub;
	}

	&.active {
		border-color: $neon-cyan;

		span {
			color: $neon-cyan;
		}
	}

	&:hover {
		border-color: rgba($neon-cyan, 0.4);
	}
}

// Toggle switch
.switch {
	position: relative;
	display: inline-block;
	width: 36px;
	height: 18px;

	input {
		opacity: 0;
		width: 0;
		height: 0;

		&:checked+.slider {
			background: $neon-cyan;
		}

		&:checked+.slider:before {
			transform: translateX(18px);
		}
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.2);
		transition: 0.3s;
		border-radius: 18px;

		&:before {
			position: absolute;
			content: '';
			height: 14px;
			width: 14px;
			left: 2px;
			bottom: 2px;
			background: white;
			transition: 0.3s;
			border-radius: 50%;
		}
	}
}

// Dropdown transition
.dropdown-enter-active,
.dropdown-leave-active {
	transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
	opacity: 0;
	transform: translateY(-10px);
}
</style>
