<template>
  <GlassPanel title="图层管理" noPadding>
    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'resources' }"
        @click="activeTab = 'resources'"
      >
        <i class="fa-solid fa-layer-group"></i>
        资源图层
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'features' }"
        @click="activeTab = 'features'"
      >
        <i class="fa-solid fa-draw-polygon"></i>
        绘制要素
        <span v-if="gisStore.featureCount > 0" class="badge">{{ gisStore.featureCount }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'analysis' }"
        @click="activeTab = 'analysis'"
      >
        <i class="fa-solid fa-chart-line"></i>
        分析结果
        <span v-if="gisStore.analysisResults.length > 0" class="badge">{{
          gisStore.analysisResults.length
        }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Tab 1: Resource Layers (Original) -->
      <div v-show="activeTab === 'resources'" class="layer-list">
        <!-- Terrain Toggle (Special) -->
        <div
          class="layer-item terrain-layer"
          :class="{ active: cesiumStore.terrainEnabled }"
          @click="toggleTerrain"
        >
          <div class="layer-info">
            <i class="fa-solid fa-mountain layer-icon"></i>
            <span>3D 地形</span>
            <span v-if="cesiumStore.terrainLoading" class="loading-indicator">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </span>
          </div>
          <i
            class="fa-solid toggle-icon"
            :class="cesiumStore.terrainEnabled ? 'fa-toggle-on' : 'fa-toggle-off'"
          ></i>
        </div>

        <!-- OSGB 3D Tiles Toggle -->
        <div
          class="layer-item osgb-layer"
          :class="{ active: cesiumStore.osgbEnabled }"
          @click="toggleOSGB"
        >
          <div class="layer-info">
            <i class="fa-solid fa-city layer-icon"></i>
            <span>倾斜摄影</span>
            <span v-if="cesiumStore.osgbLoading" class="loading-indicator">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </span>
          </div>
          <i
            class="fa-solid toggle-icon"
            :class="cesiumStore.osgbEnabled ? 'fa-toggle-on' : 'fa-toggle-off'"
          ></i>
        </div>

        <!-- BIM 3D Tiles Toggle -->
        <div
          class="layer-item bim-layer"
          :class="{ active: cesiumStore.bimEnabled }"
          @click="toggleBIM"
        >
          <div class="layer-info">
            <i class="fa-solid fa-cubes layer-icon"></i>
            <span>BIM 模型</span>
            <span v-if="cesiumStore.bimLoading" class="loading-indicator">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </span>
          </div>
          <i
            class="fa-solid toggle-icon"
            :class="cesiumStore.bimEnabled ? 'fa-toggle-on' : 'fa-toggle-off'"
          ></i>
        </div>

        <!-- Other Resource Layers -->
        <div
          v-for="layer in layers"
          :key="layer.id"
          class="layer-item"
          :class="{ active: layer.active }"
          @click="toggleLayer(layer)"
        >
          <div class="layer-info">
            <i :class="layer.icon" class="layer-icon"></i>
            <span>{{ layer.name }}</span>
          </div>
          <i
            class="fa-solid toggle-icon"
            :class="layer.active ? 'fa-toggle-on' : 'fa-toggle-off'"
          ></i>
        </div>
      </div>

      <!-- Tab 2: GIS Features (New) -->
      <div v-show="activeTab === 'features'" class="features-panel">
        <!-- Quick Tool Buttons -->
        <div class="tool-buttons">
          <button
            v-for="tool in drawTools"
            :key="tool.id"
            class="tool-btn"
            :class="{ active: gisStore.toolType === tool.id }"
            :title="tool.tooltip"
            @click="toggleDrawTool(tool.id)"
          >
            <i :class="tool.icon"></i>
          </button>
          <span class="tool-divider"></span>
          <!-- Snap Toggle -->
          <button
            class="tool-btn snap-btn"
            :class="{ active: gisStore.snapEnabled }"
            title="吸附功能 - 绘制时自动吸附到附近顶点/边"
            @click="toggleSnap"
          >
            <i class="fa-solid fa-magnet"></i>
          </button>
          <!-- Help Button for Shortcuts -->
          <button
            class="tool-btn help-btn"
            title="快捷键帮助"
            @click="showShortcutsHelp = !showShortcutsHelp"
          >
            <i class="fa-solid fa-keyboard"></i>
          </button>
        </div>

        <!-- Drawing Style Configuration Panel -->
        <div
          v-if="gisStore.toolType && isDrawingTool(gisStore.toolType)"
          class="style-config-panel"
        >
          <div class="style-config-header">
            <span>绘制样式</span>
            <button class="reset-btn" title="恢复默认样式" @click="resetCurrentToolStyle">
              <i class="fa-solid fa-rotate-left"></i>
              恢复默认
            </button>
          </div>
          <div class="style-config-body">
            <!-- Stroke Color -->
            <div class="style-row">
              <label>线条颜色</label>
              <input type="color" v-model="drawStyle.strokeColor" class="color-input" />
            </div>
            <!-- Stroke Width -->
            <div class="style-row">
              <label>线条宽度</label>
              <input
                type="range"
                v-model.number="drawStyle.strokeWidth"
                min="1"
                max="10"
                step="1"
                class="range-input"
              />
              <span class="value-label">{{ drawStyle.strokeWidth }}px</span>
            </div>
            <!-- Line Type (only for line tool) -->
            <div v-if="gisStore.toolType === 'line'" class="style-row">
              <label>线型</label>
              <select v-model="drawStyle.lineType" class="select-input">
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </div>
            <!-- Fill Color (for shapes) -->
            <div v-if="isShapeTool(gisStore.toolType)" class="style-row">
              <label>填充颜色</label>
              <input type="color" v-model="drawStyle.fillColor" class="color-input" />
            </div>
            <!-- Fill Opacity (for shapes) -->
            <div v-if="isShapeTool(gisStore.toolType)" class="style-row">
              <label>填充透明度</label>
              <input
                type="range"
                v-model.number="drawStyle.fillOpacity"
                min="0"
                max="1"
                step="0.1"
                class="range-input"
              />
              <span class="value-label">{{ Math.round(drawStyle.fillOpacity * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- Keyboard Shortcuts Help Panel -->
        <div v-if="showShortcutsHelp" class="shortcuts-help">
          <div class="shortcuts-header">
            <span>快捷键</span>
            <button class="close-btn" @click="showShortcutsHelp = false">
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
          <div class="shortcuts-list">
            <div v-for="shortcut in keyboardShortcuts" :key="shortcut.key" class="shortcut-item">
              <kbd>{{ shortcut.key }}</kbd>
              <span>{{ shortcut.action }}</span>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="search-bar">
          <i class="fa-solid fa-search"></i>
          <input v-model="searchQuery" type="text" placeholder="搜索要素..." />
        </div>

        <!-- Performance Warning -->
        <div v-if="isHighFeatureCount" class="performance-warning">
          <i class="fa-solid fa-exclamation-triangle"></i>
          <span>要素数量较多 ({{ gisStore.featureCount }})，可能影响性能</span>
        </div>

        <!-- Feature List -->
        <div class="feature-list">
          <template v-if="filteredFeatures.length === 0">
            <div class="empty-state">
              <i class="fa-solid fa-inbox"></i>
              <p>{{ searchQuery ? '无匹配要素' : '暂无绘制要素' }}</p>
              <small>点击上方工具按钮开始绘制</small>
            </div>
          </template>

          <template v-else>
            <div v-for="group in groupedFeatures" :key="group.type" class="feature-group">
              <div class="group-header">
                <i :class="group.icon"></i>
                <span>{{ group.name }}</span>
                <span class="count">({{ group.features.length }})</span>
              </div>
              <div
                v-for="feature in group.features"
                :key="feature.id"
                class="feature-item"
                :class="{ selected: gisStore.selectedFeatureIds.has(feature.id) }"
              >
                <div class="feature-info" @click="selectFeature(feature.id)">
                  <span class="feature-name">{{ feature.name }}</span>
                  <span class="feature-meta">{{ formatFeatureMeta(feature) }}</span>
                </div>
                <div class="feature-actions">
                  <button
                    class="action-btn"
                    title="显示/隐藏"
                    @click="toggleFeatureVisibility(feature.id)"
                  >
                    <i
                      class="fa-solid"
                      :class="isFeatureVisible(feature.id) ? 'fa-eye' : 'fa-eye-slash'"
                    ></i>
                  </button>
                  <button class="action-btn" title="定位" @click="locateFeature(feature.id)">
                    <i class="fa-solid fa-location-crosshairs"></i>
                  </button>
                  <button class="action-btn danger" title="删除" @click="deleteFeature(feature.id)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Batch Actions -->
        <div class="batch-actions">
          <button class="batch-btn" @click="triggerImport">
            <i class="fa-solid fa-upload"></i>
            导入
          </button>
          <button class="batch-btn" @click="exportFeatures" :disabled="gisStore.featureCount === 0">
            <i class="fa-solid fa-download"></i>
            导出
          </button>
          <button
            class="batch-btn"
            @click="selectAllFeatures"
            :disabled="gisStore.featureCount === 0"
          >
            <i class="fa-solid fa-check-double"></i>
            全选
          </button>
          <button
            class="batch-btn danger"
            @click="clearAllFeatures"
            :disabled="gisStore.featureCount === 0"
          >
            <i class="fa-solid fa-broom"></i>
            清空
          </button>
        </div>

        <!-- Hidden file input for import -->
        <input
          ref="fileInput"
          type="file"
          accept=".geojson,.json"
          style="display: none"
          @change="handleFileImport"
        />

        <!-- Style Configuration Panel -->
        <div v-if="gisStore.selectedCount > 0" class="style-panel">
          <div class="style-header">
            <i class="fa-solid fa-palette"></i>
            <span>样式配置</span>
            <span class="selected-count">{{ gisStore.selectedCount }} 个选中</span>
          </div>

          <div class="style-content">
            <!-- Fill Color -->
            <div class="style-row">
              <label>填充颜色</label>
              <div class="color-input-group">
                <input type="color" v-model="styleConfig.fillColor" @input="applyStyleToSelected" />
                <span class="color-value">{{ styleConfig.fillColor }}</span>
              </div>
            </div>

            <!-- Stroke Color -->
            <div class="style-row">
              <label>边框颜色</label>
              <div class="color-input-group">
                <input
                  type="color"
                  v-model="styleConfig.strokeColor"
                  @input="applyStyleToSelected"
                />
                <span class="color-value">{{ styleConfig.strokeColor }}</span>
              </div>
            </div>

            <!-- Fill Opacity -->
            <div class="style-row">
              <label>填充透明度</label>
              <div class="slider-group">
                <input
                  type="range"
                  v-model.number="styleConfig.fillOpacity"
                  min="0"
                  max="1"
                  step="0.1"
                  @input="applyStyleToSelected"
                />
                <span class="slider-value">{{ Math.round(styleConfig.fillOpacity * 100) }}%</span>
              </div>
            </div>

            <!-- Stroke Width -->
            <div class="style-row">
              <label>边框宽度</label>
              <div class="slider-group">
                <input
                  type="range"
                  v-model.number="styleConfig.strokeWidth"
                  min="1"
                  max="10"
                  step="1"
                  @input="applyStyleToSelected"
                />
                <span class="slider-value">{{ styleConfig.strokeWidth }}px</span>
              </div>
            </div>

            <!-- Point Size (for point features) -->
            <div v-if="hasPointFeatureSelected" class="style-row">
              <label>点大小</label>
              <div class="slider-group">
                <input
                  type="range"
                  v-model.number="styleConfig.pointSize"
                  min="5"
                  max="30"
                  step="1"
                  @input="applyStyleToSelected"
                />
                <span class="slider-value">{{ styleConfig.pointSize }}px</span>
              </div>
            </div>

            <!-- Style Presets -->
            <div class="style-presets">
              <label>快速样式</label>
              <div class="preset-buttons">
                <button
                  v-for="preset in stylePresets"
                  :key="preset.name"
                  class="preset-btn"
                  :style="{ '--preset-color': preset.fillColor }"
                  :title="preset.name"
                  @click="applyPreset(preset)"
                >
                  <span
                    class="preset-color"
                    :style="{ background: preset.fillColor, borderColor: preset.strokeColor }"
                  ></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Properties Panel (single selection only) -->
        <div v-if="gisStore.selectedCount === 1" class="properties-panel">
          <div class="properties-header">
            <i class="fa-solid fa-info-circle"></i>
            <span>要素属性</span>
          </div>

          <div class="properties-content">
            <!-- Name Input -->
            <div class="property-row">
              <label>名称</label>
              <input
                type="text"
                v-model="featureProps.name"
                @input="updateFeatureProperty('name', featureProps.name)"
                placeholder="输入要素名称"
              />
            </div>

            <!-- Description Input -->
            <div class="property-row">
              <label>描述</label>
              <textarea
                v-model="featureProps.description"
                @input="updateFeatureProperty('description', featureProps.description)"
                placeholder="输入描述信息"
                rows="2"
              ></textarea>
            </div>

            <!-- Read-only Properties -->
            <div class="property-divider"></div>

            <div class="property-row readonly">
              <label>类型</label>
              <span class="property-value">{{ featureTypeLabel }}</span>
            </div>

            <div class="property-row readonly">
              <label>创建时间</label>
              <span class="property-value">{{ featureProps.createdAt }}</span>
            </div>

            <!-- Geometry Properties -->
            <template v-if="geometryProps.length > 0">
              <div class="property-divider"></div>
              <div v-for="prop in geometryProps" :key="prop.label" class="property-row readonly">
                <label>{{ prop.label }}</label>
                <span class="property-value">{{ prop.value }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Tab 3: Analysis Results (New) -->
      <div v-show="activeTab === 'analysis'" class="analysis-panel">
        <AnalysisResultsList />
      </div>
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, reactive } from 'vue'
import GlassPanel from '@/components/common/GlassPanel.vue'
import AnalysisResultsList from '@/components/cesium/analysis/AnalysisResultsList.vue'
import { useGISStore } from '@/stores/gis'
import { useCesiumStore } from '@/stores/cesium'
import type { GISToolType } from '@/types/draw'

interface Layer {
  id: string
  name: string
  icon: string
  active: boolean
}

interface StyleConfig {
  fillColor: string
  strokeColor: string
  fillOpacity: number
  strokeWidth: number
  pointSize: number
}

interface StylePreset {
  name: string
  fillColor: string
  strokeColor: string
  fillOpacity: number
  strokeWidth: number
}

const gisStore = useGISStore()
const cesiumStore = useCesiumStore()

// === Style Configuration ===
const styleConfig = reactive<StyleConfig>({
  fillColor: '#22D3EE',
  strokeColor: '#FFFFFF',
  fillOpacity: 0.3,
  strokeWidth: 2,
  pointSize: 10,
})

// Style presets
const stylePresets: StylePreset[] = [
  { name: '青色', fillColor: '#22D3EE', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
  { name: '红色', fillColor: '#EF4444', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
  { name: '绿色', fillColor: '#22C55E', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
  { name: '橙色', fillColor: '#F97316', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
  { name: '紫色', fillColor: '#A855F7', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
  { name: '蓝色', fillColor: '#3B82F6', strokeColor: '#FFFFFF', fillOpacity: 0.3, strokeWidth: 2 },
]

// Check if any selected feature is a point
const hasPointFeatureSelected = computed(() => {
  return gisStore.selectedFeatures.some((f) => f.type === 'point')
})

// Load style from first selected feature when selection changes
watch(
  () => gisStore.selectedFeatureIds.size,
  () => {
    if (gisStore.selectedCount > 0) {
      const firstSelectedId = Array.from(gisStore.selectedFeatureIds)[0]
      const graphic = gisStore.graphics.get(firstSelectedId)
      if (graphic && graphic.style) {
        styleConfig.fillColor = graphic.style.fillColor || '#22D3EE'
        styleConfig.strokeColor = graphic.style.strokeColor || '#FFFFFF'
        styleConfig.fillOpacity = graphic.style.fillOpacity ?? 0.3
        styleConfig.strokeWidth = graphic.style.strokeWidth || 2
        styleConfig.pointSize = graphic.style.pointSize || 10
      }
    }
  }
)

/**
 * Apply current style config to all selected features
 */
function applyStyleToSelected() {
  gisStore.selectedFeatureIds.forEach((featureId) => {
    const graphic = gisStore.graphics.get(featureId)
    if (graphic) {
      graphic.updateStyle({
        fillColor: styleConfig.fillColor,
        strokeColor: styleConfig.strokeColor,
        fillOpacity: styleConfig.fillOpacity,
        strokeWidth: styleConfig.strokeWidth,
        pointSize: styleConfig.pointSize,
        pointColor: styleConfig.fillColor, // Use fill color for points
      })
    }
  })
}

/**
 * Apply a preset style
 */
function applyPreset(preset: StylePreset) {
  styleConfig.fillColor = preset.fillColor
  styleConfig.strokeColor = preset.strokeColor
  styleConfig.fillOpacity = preset.fillOpacity
  styleConfig.strokeWidth = preset.strokeWidth
  applyStyleToSelected()
}

// === Properties Panel ===
const featureProps = reactive({
  name: '',
  description: '',
  createdAt: '',
})

// Feature type labels
const featureTypeLabels: Record<string, string> = {
  point: '点标注',
  line: '线路径',
  polygon: '多边形',
  circle: '圆形',
  rectangle: '矩形',
  distance: '距离测量',
  area: '面积测量',
}

// Current feature type label
const featureTypeLabel = computed(() => {
  if (gisStore.selectedCount !== 1) return ''
  const feature = gisStore.selectedFeatures[0]
  return feature ? featureTypeLabels[feature.type] || feature.type : ''
})

// Geometry-specific properties
const geometryProps = computed(() => {
  if (gisStore.selectedCount !== 1) return []
  const feature = gisStore.selectedFeatures[0]
  if (!feature) return []

  const props: { label: string; value: string }[] = []

  switch (feature.type) {
    case 'line':
      if (feature.length) {
        props.push({ label: '长度', value: formatLength(feature.length) })
      }
      props.push({ label: '顶点数', value: `${feature.vertices?.length || 0} 个` })
      break
    case 'polygon':
    case 'area':
      if (feature.area) {
        props.push({ label: '面积', value: formatArea(feature.area) })
      }
      if (feature.type === 'polygon' && (feature as any).perimeter) {
        props.push({ label: '周长', value: formatLength((feature as any).perimeter) })
      }
      props.push({ label: '顶点数', value: `${feature.vertices?.length || 0} 个` })
      break
    case 'circle':
      if (feature.radius) {
        props.push({ label: '半径', value: formatLength(feature.radius) })
      }
      if (feature.area) {
        props.push({ label: '面积', value: formatArea(feature.area) })
      }
      break
    case 'rectangle':
      if (feature.width && feature.height) {
        props.push({
          label: '尺寸',
          value: `${formatLength(feature.width)} × ${formatLength(feature.height)}`,
        })
      }
      if (feature.area) {
        props.push({ label: '面积', value: formatArea(feature.area) })
      }
      break
    case 'distance':
      if (feature.distance) {
        props.push({ label: '距离', value: formatLength(feature.distance) })
      }
      break
  }

  return props
})

// Format length value
function formatLength(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(1)} m`
}

// Format area value
function formatArea(sqMeters: number): string {
  if (sqMeters >= 1000000) {
    return `${(sqMeters / 1000000).toFixed(2)} km²`
  }
  return `${sqMeters.toFixed(0)} m²`
}

// Load properties when selection changes
watch(
  () => gisStore.selectedFeatureIds.size,
  () => {
    if (gisStore.selectedCount === 1) {
      const feature = gisStore.selectedFeatures[0]
      if (feature) {
        featureProps.name = feature.name || ''
        featureProps.description = feature.description || ''
        featureProps.createdAt = feature.createdAt
          ? new Date(feature.createdAt).toLocaleString()
          : ''
      }
    }
  },
  { immediate: true }
)

/**
 * Update feature property in store
 */
function updateFeatureProperty(key: 'name' | 'description', value: string) {
  if (gisStore.selectedCount !== 1) return
  const featureId = Array.from(gisStore.selectedFeatureIds)[0]
  gisStore.updateFeature(featureId, { [key]: value })
}

// UI State
const activeTab = ref<'resources' | 'features' | 'analysis'>('resources')

// Resource layers (original) - BIM now has dedicated toggle above
const layers = ref<Layer[]>([
  { id: 'base', name: '基础地理', icon: 'fa-solid fa-map', active: true },
  { id: 'cctv', name: '视频点位', icon: 'fa-solid fa-video', active: false },
  { id: 'stations', name: '水雨情站', icon: 'fa-solid fa-location-dot', active: true },
])

// Draw tools configuration with tooltips
const drawTools: Array<{ id: GISToolType; name: string; icon: string; tooltip: string }> = [
  { id: 'point', name: '点标注', icon: 'fa-solid fa-location-dot', tooltip: '点标注 - 单击放置点' },
  {
    id: 'line',
    name: '线绘制',
    icon: 'fa-solid fa-minus',
    tooltip: '线绘制 - 连续点击添加节点，双击完成',
  },
  {
    id: 'circle',
    name: '圆形',
    icon: 'fa-regular fa-circle',
    tooltip: '圆形 - 点击设置圆心，拖动设置半径',
  },
  {
    id: 'rectangle',
    name: '矩形',
    icon: 'fa-regular fa-square',
    tooltip: '矩形 - 点击对角两点绘制',
  },
  {
    id: 'polygon',
    name: '多边形',
    icon: 'fa-solid fa-draw-polygon',
    tooltip: '多边形 - 连续点击添加节点，双击完成',
  },
]

// 3D Analysis tools configuration
const analysisTools: Array<{
  id: GISToolType
  name: string
  icon: string
  tooltip: string
  disabled?: boolean
}> = [
  {
    id: 'volume',
    name: '方量分析',
    icon: 'fa-solid fa-cubes-stacked',
    tooltip: '方量分析 - 绘制多边形计算体积',
  },
  {
    id: 'flood',
    name: '淹没分析',
    icon: 'fa-solid fa-water',
    tooltip: '淹没分析 - 绘制多边形模拟水位变化',
  },
  {
    id: 'profile',
    name: '剖面分析',
    icon: 'fa-solid fa-chart-line',
    tooltip: '剖面分析 - 绘制线获取地形剖面',
  },
  {
    id: 'measure3d',
    name: '3D测量',
    icon: 'fa-solid fa-ruler-combined',
    tooltip: '3D测量 - Shift:地形 / Ctrl:自定义高度 / Alt:相对高度',
  },
]

// Keyboard shortcuts reference
const keyboardShortcuts = [
  { key: 'Ctrl+Z', action: '撤销' },
  { key: 'Ctrl+Y', action: '重做' },
  { key: 'Ctrl+A', action: '全选' },
  { key: 'Delete', action: '删除选中' },
  { key: 'ESC', action: '取消/退出编辑' },
  { key: '双击', action: '编辑顶点' },
  { key: 'Shift+点击', action: '删除顶点' },
]

// Search query
const searchQuery = ref('')

// Shortcuts help visibility
const showShortcutsHelp = ref(false)

// Use store's drawStyle (shared with GISLayer.vue)
const drawStyle = gisStore.drawStyle

// Watch drawStyle changes and sync to current tool's toolStyles
watch(
  () => [
    drawStyle.strokeColor,
    drawStyle.strokeWidth,
    drawStyle.fillColor,
    drawStyle.fillOpacity,
    drawStyle.lineType,
    drawStyle.pointColor,
    drawStyle.pointSize,
  ],
  () => {
    // Only sync if a drawing tool is active
    if (gisStore.toolType && isDrawingTool(gisStore.toolType)) {
      const currentToolType = gisStore.toolType
      console.log(
        `[LayerControl] Syncing drawStyle changes to toolStyles for tool: ${currentToolType}`
      )

      // Update toolStyles (persist to localStorage)
      gisStore.updateToolStyle(currentToolType as any, {
        strokeColor: drawStyle.strokeColor,
        strokeWidth: drawStyle.strokeWidth,
        fillColor: drawStyle.fillColor,
        fillOpacity: drawStyle.fillOpacity,
        lineType: drawStyle.lineType,
        pointColor: drawStyle.pointColor,
        pointSize: drawStyle.pointSize,
      })

      // Reactivate the tool to apply new styles immediately
      // This ensures the next drawing uses the updated style
      gisStore.setTool(null)
      setTimeout(() => {
        gisStore.setTool(currentToolType as any)
      }, 50)
    }
  },
  { deep: true }
)

/**
 * Check if tool is a drawing tool
 */
function isDrawingTool(toolType: string | null): boolean {
  if (!toolType) return false
  return ['point', 'line', 'circle', 'rectangle', 'polygon'].includes(toolType)
}

/**
 * Check if tool is a shape tool (has fill)
 */
function isShapeTool(toolType: string | null): boolean {
  if (!toolType) return false
  return ['circle', 'rectangle', 'polygon'].includes(toolType)
}

// File input ref for import
const fileInput = ref<HTMLInputElement | null>(null)

// === Resource Layer Functions (Original) ===
function toggleLayer(layer: Layer) {
  layer.active = !layer.active
  // TODO: Emit event to update Cesium layers
}

/**
 * Toggle 3D terrain
 */
async function toggleTerrain() {
  await cesiumStore.toggleTerrain()
}

/**
 * Toggle OSGB 3D Tiles visibility
 * The actual loading is handled by OSGBLayer component
 */
function toggleOSGB() {
  console.log('[LayerControl] toggleOSGB called, current:', cesiumStore.osgbEnabled)
  cesiumStore.osgbEnabled = !cesiumStore.osgbEnabled
  console.log('[LayerControl] toggleOSGB new value:', cesiumStore.osgbEnabled)
}

/**
 * Toggle BIM 3D Tiles visibility
 * The actual loading is handled by BIMLayer component
 */
function toggleBIM() {
  console.log('[LayerControl] toggleBIM called, current:', cesiumStore.bimEnabled)
  cesiumStore.bimEnabled = !cesiumStore.bimEnabled
  console.log('[LayerControl] toggleBIM new value:', cesiumStore.bimEnabled)
}

// === GIS Feature Functions (New) ===

/**
 * Toggle draw/analysis tool
 */
function toggleDrawTool(toolId: GISToolType) {
  if (gisStore.toolType === toolId) {
    gisStore.setTool(null) // Deactivate if clicking same tool
  } else {
    gisStore.setTool(toolId as any) // Activate tool
  }
}

/**
 * Reset current tool's style to default
 */
function resetCurrentToolStyle() {
  if (!gisStore.toolType || !isDrawingTool(gisStore.toolType)) return

  const currentTool = gisStore.toolType
  console.log(`[LayerControl] Resetting style for tool: ${currentTool}`)

  // Reset in store (clears from localStorage and loads defaults)
  gisStore.resetToolStyles(currentTool as any)

  // Reload the default style into UI
  const defaultStyle = gisStore.getToolStyle(currentTool as any)
  Object.assign(drawStyle, defaultStyle)

  // Note: Tool will auto-reactivate via the drawStyle watcher
}

// Watch tool type changes and load tool-specific styles
watch(
  () => gisStore.toolType,
  (newToolType) => {
    // When a drawing tool is activated, load its saved styles into drawStyle
    if (newToolType && isDrawingTool(newToolType)) {
      const toolStyle = gisStore.getToolStyle(newToolType as any)
      console.log(`[LayerControl] Loading toolStyles for ${newToolType}:`, toolStyle)

      // Update drawStyle with tool-specific styles
      Object.assign(drawStyle, {
        strokeColor: toolStyle.strokeColor || drawStyle.strokeColor,
        strokeWidth: toolStyle.strokeWidth ?? drawStyle.strokeWidth,
        fillColor: toolStyle.fillColor || drawStyle.fillColor,
        fillOpacity: toolStyle.fillOpacity ?? drawStyle.fillOpacity,
        lineType: toolStyle.lineType || drawStyle.lineType,
        pointColor: toolStyle.pointColor || drawStyle.pointColor,
        pointSize: toolStyle.pointSize ?? drawStyle.pointSize,
      })
    }
  },
  { immediate: false }
)

/**
 * Toggle snap functionality
 */
function toggleSnap() {
  gisStore.setSnapEnabled(!gisStore.snapEnabled)
}

// Performance thresholds
const FEATURE_WARNING_THRESHOLD = 100
const FEATURE_LIMIT = 500

/**
 * Check if feature count is high (performance warning)
 */
const isHighFeatureCount = computed(() => gisStore.featureCount > FEATURE_WARNING_THRESHOLD)

/**
 * Check if feature count exceeds limit
 */
const isFeatureCountExceeded = computed(() => gisStore.featureCount > FEATURE_LIMIT)

/**
 * Filter features by search query
 */
const filteredFeatures = computed(() => {
  const features = gisStore.featuresArray
  if (!searchQuery.value.trim()) {
    return features
  }

  const query = searchQuery.value.toLowerCase()
  return features.filter(
    (f) => f.name.toLowerCase().includes(query) || f.type.toLowerCase().includes(query)
  )
})

/**
 * Group features by type
 */
const groupedFeatures = computed(() => {
  const groups = [
    { type: 'point', name: '点标注', icon: 'fa-solid fa-location-dot', features: [] as any[] },
    { type: 'line', name: '线路径', icon: 'fa-solid fa-minus', features: [] as any[] },
    { type: 'circle', name: '圆形区域', icon: 'fa-regular fa-circle', features: [] as any[] },
    { type: 'rectangle', name: '矩形区域', icon: 'fa-regular fa-square', features: [] as any[] },
    {
      type: 'polygon',
      name: '多边形区域',
      icon: 'fa-solid fa-draw-polygon',
      features: [] as any[],
    },
  ]

  filteredFeatures.value.forEach((feature) => {
    const group = groups.find((g) => g.type === feature.type)
    if (group) {
      group.features.push(feature)
    }
  })

  // Return only non-empty groups
  return groups.filter((g) => g.features.length > 0)
})

/**
 * Format feature metadata for display
 */
function formatFeatureMeta(feature: any): string {
  const parts = []

  // Add measurement info if available
  if (feature.properties?.length !== undefined) {
    parts.push(`${feature.properties.length.toFixed(0)}m`)
  }
  if (feature.properties?.area !== undefined) {
    const area = feature.properties.area
    if (area > 1000000) {
      parts.push(`${(area / 1000000).toFixed(2)}km²`)
    } else {
      parts.push(`${area.toFixed(0)}m²`)
    }
  }
  if (feature.properties?.radius !== undefined) {
    parts.push(`r=${feature.properties.radius.toFixed(0)}m`)
  }

  // Add creation time
  if (feature.createdAt) {
    const date = new Date(feature.createdAt)
    parts.push(date.toLocaleDateString())
  }

  return parts.join(' · ')
}

/**
 * Select a feature
 */
function selectFeature(featureId: string) {
  gisStore.selectFeature(featureId)
}

/**
 * Check if feature is visible
 */
function isFeatureVisible(featureId: string): boolean {
  const graphic = gisStore.graphics.get(featureId)
  return graphic?.visible ?? true
}

/**
 * Toggle feature visibility
 */
function toggleFeatureVisibility(featureId: string) {
  const graphic = gisStore.graphics.get(featureId)
  if (graphic) {
    if (graphic.visible) {
      graphic.hide()
    } else {
      graphic.show()
    }
  }
}

/**
 * Locate (fly to) a feature
 */
function locateFeature(featureId: string) {
  const graphic = gisStore.graphics.get(featureId)
  if (!graphic) {
    console.error('Graphic not found:', featureId)
    return
  }

  // Get center position
  const center = graphic.getCenter?.()
  if (!center) {
    console.error('Graphic does not have getCenter method:', featureId)
    return
  }

  // Fly camera to center
  const viewer = gisStore.viewer
  if (viewer && viewer.camera) {
    viewer.camera.flyTo({
      destination: center,
      duration: 1.5,
      offset: new (window as any).Cesium.HeadingPitchRange(
        0,
        -(window as any).Cesium.Math.toRadians(45), // Look down at 45 degrees
        5000 // 5km distance
      ),
    })
  }
}

/**
 * Delete a single feature
 */
function deleteFeature(featureId: string) {
  if (confirm('确定要删除该要素吗？')) {
    gisStore.removeFeature(featureId)
  }
}

/**
 * Export features as GeoJSON
 */
function exportFeatures() {
  const selectedOnly = gisStore.selectedCount > 0
  const geojson = gisStore.exportGeoJSON(selectedOnly)

  // Create download
  const blob = new Blob([geojson], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const prefix = selectedOnly ? 'selected_features' : 'all_features'
  link.download = `${prefix}_${Date.now()}.geojson`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Trigger file input click for import
 */
function triggerImport() {
  fileInput.value?.click()
}

/**
 * Handle file import
 */
function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (!content) {
      alert('无法读取文件内容')
      return
    }

    const result = gisStore.importGeoJSON(content)

    if (result.success > 0) {
      alert(
        `成功导入 ${result.success} 个要素${result.errors.length > 0 ? `\n\n警告:\n${result.errors.join('\n')}` : ''}`
      )
    } else {
      alert(`导入失败:\n${result.errors.join('\n')}`)
    }

    // Reset input value to allow importing the same file again
    input.value = ''
  }

  reader.onerror = () => {
    alert('读取文件时发生错误')
  }

  reader.readAsText(file)
}

/**
 * Select all features (toggle)
 */
function selectAllFeatures() {
  const allSelected =
    gisStore.featuresArray.length > 0 &&
    gisStore.featuresArray.every((f) => gisStore.selectedFeatureIds.has(f.id))

  if (allSelected) {
    // Deselect all
    gisStore.featuresArray.forEach((f) => {
      gisStore.deselectFeature(f.id)
    })
  } else {
    // Select all
    gisStore.featuresArray.forEach((f) => {
      gisStore.selectFeature(f.id, true) // true = multi-select
    })
  }
}

/**
 * Clear all features
 */
function clearAllFeatures() {
  if (confirm(`确定要清空所有 ${gisStore.featureCount} 个要素吗？此操作不可恢复！`)) {
    gisStore.clearFeatures()
  }
}
</script>

<style scoped lang="scss">
// === Tab Navigation ===
.tab-nav {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0 8px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: $text-sub;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  i {
    font-size: 14px;
  }

  .badge {
    position: absolute;
    top: 6px;
    right: 10px;
    background: $neon-cyan;
    color: #000;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
  }

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.03);
  }

  &.active {
    color: $neon-cyan;
    border-bottom-color: $neon-cyan;
    text-shadow: 0 0 5px $neon-cyan;
  }
}

// === Tab Content ===
.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// === Resource Layers (Original Styles) ===
.layer-list {
  padding: 10px;
  flex: 1;
  overflow-y: auto;
  @include custom-scrollbar;
}

.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    background: rgba(34, 211, 238, 0.1);
    border-left-color: $neon-cyan;

    .toggle-icon {
      color: $neon-cyan;
      text-shadow: 0 0 5px $neon-cyan;
    }
  }
}

.layer-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.layer-icon {
  width: 16px;
  text-align: center;
  color: $text-sub;
}

.toggle-icon {
  color: #555;
  transition: color 0.2s;
}

.loading-indicator {
  margin-left: 8px;
  color: $neon-cyan;
  font-size: 10px;
}

.terrain-layer {
  // Special styling for terrain toggle
  .layer-icon {
    color: $warn-yellow;
  }

  &.active .layer-icon {
    color: $neon-cyan;
    text-shadow: 0 0 5px $neon-cyan;
  }
}

// === GIS Features Panel (New) ===
.features-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// Tool Buttons
.tool-buttons {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tool-btn {
  flex: 1;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: $text-sub;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: $text-main;
    border-color: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background: rgba(34, 211, 238, 0.15);
    border-color: $neon-cyan;
    color: $neon-cyan;
    text-shadow: 0 0 5px $neon-cyan;
  }

  // Snap button separator
  &.snap-btn {
    margin-left: 8px;
    flex: 0 0 auto;
    width: 36px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);

    &.active {
      background: rgba(249, 115, 22, 0.15);
      border-color: #f97316;
      color: #f97316;
      text-shadow: 0 0 5px #f97316;
    }
  }

  // Help button
  &.help-btn {
    flex: 0 0 auto;
    width: 36px;

    &:hover {
      color: $neon-cyan;
    }
  }

  // Analysis tool button (different accent color)
  &.analysis-btn {
    &.active {
      background: rgba(255, 107, 107, 0.15);
      border-color: #ff6b6b;
      color: #ff6b6b;
      text-shadow: 0 0 5px #ff6b6b;
    }

    &.disabled {
      opacity: 0.4;
      cursor: not-allowed;

      &:hover {
        background: rgba(0, 0, 0, 0.3);
        color: $text-sub;
        border-color: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

// Tool button divider
.tool-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
  align-self: center;
  margin: 0 2px;
}

// Drawing Style Configuration Panel
.style-config-panel {
  margin: 0 10px 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;

  .style-config-header {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;

    span {
      font-size: 11px;
      font-weight: 500;
      color: $text-main;
    }

    .reset-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      font-size: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: $text-sub;
      cursor: pointer;
      transition: all 0.2s;

      i {
        font-size: 10px;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: $text-main;
        border-color: rgba(255, 255, 255, 0.2);
      }

      &:active {
        transform: scale(0.95);
      }
    }
  }

  .style-config-body {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .style-row {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      flex: 0 0 70px;
      font-size: 11px;
      color: $text-sub;
    }

    .color-input {
      width: 32px;
      height: 24px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 2px;
      }

      &::-webkit-color-swatch {
        border-radius: 2px;
        border: none;
      }
    }

    .range-input {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      appearance: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        background: $neon-cyan;
        border-radius: 50%;
        cursor: pointer;
      }
    }

    .select-input {
      flex: 1;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: $text-main;
      font-size: 11px;
      cursor: pointer;

      option {
        background: #1a1a2e;
        color: $text-main;
      }
    }

    .value-label {
      flex: 0 0 40px;
      font-size: 10px;
      color: $text-sub;
      text-align: right;
    }
  }
}

// Performance Warning
.performance-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 8px;
  padding: 8px 10px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: #fbbf24;

  i {
    font-size: 12px;
  }
}

// Keyboard Shortcuts Help Panel
.shortcuts-help {
  margin: 0 10px 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;

  .shortcuts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    span {
      font-size: 12px;
      font-weight: 500;
      color: $text-main;
    }

    .close-btn {
      background: none;
      border: none;
      color: $text-sub;
      cursor: pointer;
      padding: 2px;

      &:hover {
        color: $text-main;
      }
    }
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;

    kbd {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      font-family: monospace;
      font-size: 10px;
      color: $neon-cyan;
      min-width: 60px;
      text-align: center;
    }

    span {
      color: $text-sub;
    }
  }
}

// Search Bar
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  i {
    color: $text-sub;
    font-size: 12px;
  }

  input {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 6px 10px;
    color: $text-main;
    font-size: 12px;
    outline: none;
    transition: all 0.2s;

    &::placeholder {
      color: $text-sub;
    }

    &:focus {
      border-color: $neon-cyan;
      box-shadow: 0 0 5px rgba(34, 211, 238, 0.3);
    }
  }
}

// Feature List
.feature-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  @include custom-scrollbar;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: $text-sub;

  i {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }

  p {
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  small {
    font-size: 11px;
    opacity: 0.7;
  }
}

.feature-group {
  margin-bottom: 12px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: $text-sub;
  text-transform: uppercase;
  margin-bottom: 6px;

  i {
    font-size: 12px;
  }

  .count {
    margin-left: auto;
    opacity: 0.6;
  }
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border-left: 3px solid transparent;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.selected {
    background: rgba(34, 211, 238, 0.1);
    border-left-color: $neon-cyan;
  }
}

.feature-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  min-width: 0; // Allow text truncation
}

.feature-name {
  font-size: 12px;
  color: $text-main;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feature-meta {
  font-size: 10px;
  color: $text-sub;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feature-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: $text-sub;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
    border-color: rgba(255, 255, 255, 0.2);
  }

  &.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: #ef4444;
  }
}

// Batch Actions
.batch-actions {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.batch-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: $text-sub;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;

  i {
    font-size: 12px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: $text-main;
    border-color: rgba(255, 255, 255, 0.2);
  }

  &.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: #ef4444;
  }
}

// === Style Configuration Panel ===
.style-panel {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 8px;
}

.style-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  color: $text-main;
  font-size: 12px;
  font-weight: 500;

  i {
    color: $neon-cyan;
  }

  .selected-count {
    margin-left: auto;
    color: $text-sub;
    font-size: 11px;
    font-weight: 400;
  }
}

.style-content {
  padding: 12px;
}

.style-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  label {
    font-size: 11px;
    color: $text-sub;
    min-width: 70px;
  }
}

.color-input-group {
  display: flex;
  align-items: center;
  gap: 8px;

  input[type='color'] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
      padding: 2px;
    }

    &::-webkit-color-swatch {
      border: none;
      border-radius: 2px;
    }
  }

  .color-value {
    font-size: 10px;
    color: $text-sub;
    font-family: monospace;
    text-transform: uppercase;
  }
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 160px;

  input[type='range'] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: $neon-cyan;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 5px $neon-cyan;
    }

    &::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: $neon-cyan;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 5px $neon-cyan;
    }
  }

  .slider-value {
    font-size: 10px;
    color: $text-sub;
    min-width: 35px;
    text-align: right;
    font-family: monospace;
  }
}

.style-presets {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  label {
    display: block;
    font-size: 11px;
    color: $text-sub;
    margin-bottom: 8px;
  }
}

.preset-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-btn {
  width: 28px;
  height: 28px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  .preset-color {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 2px;
    border: 2px solid;
  }
}

// === Properties Panel ===
.properties-panel {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 8px;
}

.properties-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  color: $text-main;
  font-size: 12px;
  font-weight: 500;

  i {
    color: $neon-cyan;
  }
}

.properties-content {
  padding: 12px;
}

.property-row {
  margin-bottom: 10px;

  label {
    display: block;
    font-size: 11px;
    color: $text-sub;
    margin-bottom: 4px;
  }

  input[type='text'],
  textarea {
    width: 100%;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: $text-main;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
    resize: none;

    &:focus {
      border-color: $neon-cyan;
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
  }

  textarea {
    font-family: inherit;
  }

  &.readonly {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    label {
      margin-bottom: 0;
      min-width: 60px;
    }

    .property-value {
      font-size: 11px;
      color: $text-main;
      text-align: right;
    }
  }
}

.property-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 12px 0;
}
</style>
