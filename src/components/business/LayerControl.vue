<template>
	<GlassPanel title="图层管理" noPadding>
		<!-- Tab Navigation -->
		<div class="tab-nav">
			<button class="tab-btn" :class="{ active: activeTab === 'resources' }" @click="activeTab = 'resources'">
				<i class="fa-solid fa-layer-group"></i>
				资源图层
			</button>
			<button class="tab-btn" :class="{ active: activeTab === 'features' }" @click="activeTab = 'features'">
				<i class="fa-solid fa-draw-polygon"></i>
				绘制要素
			</button>
			<button class="tab-btn" :class="{ active: activeTab === 'management' }" @click="activeTab = 'management'">
				<i class="fa-solid fa-folder-open"></i>
				要素管理
				<span v-if="gisStore.featureCount > 0" class="badge">{{ gisStore.featureCount }}</span>
			</button>
			<button class="tab-btn" :class="{ active: activeTab === 'analysis' }" @click="activeTab = 'analysis'">
				<i class="fa-solid fa-chart-line"></i>
				分析结果
				<span v-if="gisStore.analysisResults.length > 0" class="badge">{{
					gisStore.analysisResults.length
				}}</span>
			</button>
		</div>

		<!-- Tab Content -->
		<div class="tab-content">
			<!-- Tab 1: Resource Layers (Dynamic from Backend) -->
			<div v-show="activeTab === 'resources'" class="layer-list">
				<div class="layer-list-header">
					<span class="layer-list-title">资源图层</span>
					<button class="add-layer-btn" @click.stop="openCreateDialog">
						<i class="fa-solid fa-plus"></i> 新增图层
					</button>
				</div>
				<!-- All Layers from Store (grouped) -->
				<template v-for="(layers, groupName) in layerStore.layersByGroup" :key="groupName">
					<div class="layer-group-header" v-if="layers.length > 0">{{ getGroupDisplayName(groupName) }}</div>
					<div v-for="layer in layers" :key="layer.id" class="layer-item"
						:class="{ active: layerStore.isLayerActive(layer.id) }" @click="onLayerToggle(layer)">
						<div class="layer-info">
							<i :class="layer.icon || 'fa-solid fa-layer-group'" class="layer-icon"></i>
							<span>{{ layer.name }}</span>
						</div>
						<div class="layer-actions">
							<button class="layer-action-btn" title="查看详情" @click.stop="onViewLayerDetail(layer)">
								<i class="fa-solid fa-circle-info"></i>
							</button>
							<button class="layer-action-btn" title="编辑图层" @click.stop="openEditDialog(layer)">
								<i class="fa-solid fa-pen"></i>
							</button>
							<button class="layer-action-btn del" title="删除图层" @click.stop="onDeleteLayer(layer)">
								<i class="fa-solid fa-trash-can"></i>
							</button>
							<i class="fa-solid toggle-icon"
								:class="layerStore.isLayerActive(layer.id) ? 'fa-toggle-on' : 'fa-toggle-off'"></i>
						</div>
					</div>
				</template>
			</div>

			<!-- Tab 2: GIS Features (New) -->
			<div v-show="activeTab === 'features'" class="features-panel">
				<!-- Quick Tool Buttons -->
				<div class="tool-buttons">
					<button v-for="tool in drawTools" :key="tool.id" class="tool-btn"
						:class="{ active: gisStore.toolType === tool.id, 'analysis-btn': tool.analysis }" :title="tool.tooltip" @click="toggleDrawTool(tool.id)">
						<i :class="tool.icon"></i>
					</button>
					<span class="tool-divider"></span>
					<!-- Snap Toggle -->
					<button class="tool-btn snap-btn" :class="{ active: gisStore.snapEnabled }" title="吸附功能 - 绘制时自动吸附到附近顶点/边"
						@click="toggleSnap">
						<i class="fa-solid fa-magnet"></i>
					</button>
					<!-- Help Button for Shortcuts -->
					<button class="tool-btn help-btn" title="快捷键帮助" @click="showShortcutsHelp = !showShortcutsHelp">
						<i class="fa-solid fa-keyboard"></i>
					</button>
				</div>

				<div class="features-scroll-content">

					<!-- Drawing Style Configuration Panel -->
					<div v-if="gisStore.toolType && isDrawingTool(gisStore.toolType)" class="style-config-panel"
						:class="{ collapsed: drawStyleCollapsed }">
						<div class="style-config-header" @click="drawStyleCollapsed = !drawStyleCollapsed">
							<i class="fa-solid" :class="drawStyleCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'"></i>
							<span>绘制样式</span>
							<button class="reset-btn" title="恢复默认样式" @click.stop="resetCurrentToolStyle">
								<i class="fa-solid fa-rotate-left"></i>
								恢复默认
							</button>
						</div>
						<div v-show="!drawStyleCollapsed" class="style-config-body">
							<!-- Point Color (only for point tool) -->
							<div v-if="gisStore.toolType === 'draw-point'" class="style-row">
								<label>点颜色</label>
								<input type="color" v-model="drawStyle.pointColor" class="color-input" />
							</div>
							<!-- Point Outline Color (only for point tool) -->
							<div v-if="gisStore.toolType === 'draw-point'" class="style-row">
								<label>边框颜色</label>
								<input type="color" v-model="drawStyle.strokeColor" class="color-input" />
							</div>
							<!-- Point Outline Width (only for point tool) -->
							<div v-if="gisStore.toolType === 'draw-point'" class="style-row">
								<label>边框宽度</label>
								<input type="range" v-model.number="drawStyle.strokeWidth" min="0" max="5" step="1"
									class="range-input" />
								<span class="value-label">{{ drawStyle.strokeWidth }}px</span>
							</div>
							<!-- Point Size (only for point tool) -->
							<div v-if="gisStore.toolType === 'draw-point'" class="style-row">
								<label>点大小</label>
								<input type="range" v-model.number="drawStyle.pointSize" min="5" max="30" step="1"
									class="range-input" />
								<span class="value-label">{{ drawStyle.pointSize }}px</span>
							</div>
							<!-- Point Icon Type (only for point tool) -->
							<div v-if="gisStore.toolType === 'draw-point'" class="style-row">
								<label>图标样式</label>
								<div class="icon-selector">
									<button v-for="icon in pointIconOptions" :key="icon.id" class="icon-option"
										:class="{ active: drawStyle.iconType === icon.id }" :title="icon.name"
										@click="drawStyle.iconType = icon.id">
										<i :class="icon.icon"></i>
									</button>
								</div>
							</div>
							<!-- Stroke Color (for line/shapes) -->
							<div v-if="gisStore.toolType !== 'draw-point'" class="style-row">
								<label>线条颜色</label>
								<input type="color" v-model="drawStyle.strokeColor" class="color-input" />
							</div>
							<!-- Stroke Width (for line/shapes) -->
							<div v-if="gisStore.toolType !== 'draw-point'" class="style-row">
								<label>线条宽度</label>
								<input type="range" v-model.number="drawStyle.strokeWidth" min="1" max="10" step="1"
									class="range-input" />
								<span class="value-label">{{ drawStyle.strokeWidth }}px</span>
							</div>
							<!-- Line Type (only for line tool) -->
							<div v-if="gisStore.toolType === 'draw-line'" class="style-row">
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
								<input type="range" v-model.number="drawStyle.fillOpacity" min="0" max="1" step="0.1"
									class="range-input" />
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

					<!-- Quick Templates Panel -->
					<div class="quick-templates-panel">
						<div class="section-header">
							<i class="fa-solid fa-swatchbook"></i>
							<span>快速模板</span>
						</div>
						<div class="template-grid">
							<button v-for="template in quickTemplates" :key="template.id" class="template-btn" :title="template.name"
								@click="applyQuickTemplate(template)">
								<div class="template-preview" :style="getTemplatePreviewStyle(template)">
									<i :class="template.icon"></i>
								</div>
								<span class="template-name">{{ template.name }}</span>
							</button>
						</div>
					</div>



					<!-- Style Configuration Panel -->
					<div v-if="gisStore.selectedCount > 0" class="style-panel" :class="{ collapsed: selectionStyleCollapsed }">
						<div class="style-header" @click="selectionStyleCollapsed = !selectionStyleCollapsed">
							<i class="fa-solid" :class="selectionStyleCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'"></i>
							<i class="fa-solid fa-palette"></i>
							<span>样式配置</span>
							<span class="selected-count">{{ gisStore.selectedCount }} 个选中</span>
						</div>

						<div v-show="!selectionStyleCollapsed" class="style-content">
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
									<input type="color" v-model="styleConfig.strokeColor" @input="applyStyleToSelected" />
									<span class="color-value">{{ styleConfig.strokeColor }}</span>
								</div>
							</div>

							<!-- Fill Opacity -->
							<div class="style-row">
								<label>填充透明度</label>
								<div class="slider-group">
									<input type="range" v-model.number="styleConfig.fillOpacity" min="0" max="1" step="0.1"
										@input="applyStyleToSelected" />
									<span class="slider-value">{{ Math.round(styleConfig.fillOpacity * 100) }}%</span>
								</div>
							</div>

							<!-- Stroke Width -->
							<div class="style-row">
								<label>边框宽度</label>
								<div class="slider-group">
									<input type="range" v-model.number="styleConfig.strokeWidth" min="1" max="10" step="1"
										@input="applyStyleToSelected" />
									<span class="slider-value">{{ styleConfig.strokeWidth }}px</span>
								</div>
							</div>

							<!-- Point Size (for point features) -->
							<div v-if="hasPointFeatureSelected" class="style-row">
								<label>点大小</label>
								<div class="slider-group">
									<input type="range" v-model.number="styleConfig.pointSize" min="5" max="30" step="1"
										@input="applyStyleToSelected" />
									<span class="slider-value">{{ styleConfig.pointSize }}px</span>
								</div>
							</div>

							<!-- Style Presets -->
							<div class="style-presets">
								<label>快速样式</label>
								<div class="preset-buttons">
									<button v-for="preset in stylePresets" :key="preset.name" class="preset-btn"
										:style="{ '--preset-color': preset.fillColor }" :title="preset.name" @click="applyPreset(preset)">
										<span class="preset-color"
											:style="{ background: preset.fillColor, borderColor: preset.strokeColor }"></span>
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
								<input type="text" v-model="featureProps.name" @input="updateFeatureProperty('name', featureProps.name)"
									placeholder="输入要素名称" />
							</div>

							<!-- Description Input -->
							<div class="property-row">
								<label>描述</label>
								<textarea v-model="featureProps.description"
									@input="updateFeatureProperty('description', featureProps.description)" placeholder="输入描述信息"
									rows="2"></textarea>
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
			</div>

			<!-- Tab 3: Feature Management (Separated) -->
			<div v-show="activeTab === 'management'" class="features-panel">
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
							<small>点击"绘制要素"页开始绘制</small>
						</div>
					</template>

					<template v-else>
						<div v-for="group in groupedFeatures" :key="group.type" class="feature-group">
							<div class="group-header">
								<i :class="group.icon"></i>
								<span>{{ group.name }}</span>
								<span class="count">({{ group.features.length }})</span>
							</div>
							<div v-for="feature in group.features" :key="feature.id" class="feature-item"
								:class="{ selected: gisStore.selectedFeatureIds.has(feature.id) }">
								<div class="feature-info" @click="selectFeature(feature.id)">
									<span class="feature-name">{{ feature.name }}</span>
									<span class="feature-meta">{{ formatFeatureMeta(feature) }}</span>
								</div>
								<div class="feature-actions">
									<button class="action-btn" title="显示/隐藏" @click="toggleFeatureVisibility(feature.id)">
										<i class="fa-solid" :class="isFeatureVisible(feature.id) ? 'fa-eye' : 'fa-eye-slash'"></i>
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
					<button class="batch-btn" @click="selectAllFeatures" :disabled="gisStore.featureCount === 0">
						<i class="fa-solid fa-check-double"></i>
						全选
					</button>
					<button class="batch-btn danger" @click="clearAllFeatures" :disabled="gisStore.featureCount === 0">
						<i class="fa-solid fa-broom"></i>
						清空
					</button>
				</div>

				<!-- Hidden file input for import -->
				<input ref="fileInput" type="file" accept=".geojson,.json" style="display: none" @change="handleFileImport" />
			</div>

			<!-- Tab 4: Analysis Results -->
			<div v-show="activeTab === 'analysis'" class="analysis-panel">
				<div class="analysis-scroll-content">
					<AnalysisResultsList />
				</div>
			</div>
		</div>
	</GlassPanel>

	<!-- 新增/编辑图层弹窗 -->
	<el-dialog
		v-model="layerDialogVisible"
		:title="layerDialogMode === 'create' ? '新增图层' : '编辑图层'"
		width="460px"
		:close-on-click-modal="false"
		@closed="resetLayerForm"
	>
		<el-form label-width="88px" label-position="right">
			<el-form-item label="图层名称" required>
				<el-input v-model="layerForm.name" placeholder="如：2025 正射影像" />
			</el-form-item>
			<el-form-item label="图层编码" required>
				<el-input
					v-model="layerForm.code"
					:disabled="layerDialogMode === 'edit'"
					placeholder="唯一编码，如 imagery_2025"
				/>
			</el-form-item>
			<el-form-item label="图层类型" required>
				<el-select v-model="layerForm.layer_type" style="width: 100%">
					<el-option label="影像服务" value="imagery" />
					<el-option label="3D 瓦片" value="3dtiles" />
					<el-option label="点位接口" value="api_point" />
					<el-option label="地形" value="terrain" />
				</el-select>
			</el-form-item>
			<el-form-item label="分组">
				<el-input v-model="layerForm.group_name" placeholder="如：基础底图 / 专题图层" />
			</el-form-item>
			<el-form-item label="服务地址">
				<el-input v-model="layerForm.url" placeholder="https://... (留空可稍后配置)" />
			</el-form-item>
			<el-form-item label="图标">
				<el-input v-model="layerForm.icon" placeholder="fa-solid fa-layer-group" />
			</el-form-item>
			<el-form-item label="排序">
				<el-input-number v-model="layerForm.order" :min="0" controls-position="right" />
			</el-form-item>
			<el-form-item label="启用">
				<el-switch v-model="layerForm.is_enabled" />
			</el-form-item>
			<el-form-item label="默认显示">
				<el-switch v-model="layerForm.is_visible" />
			</el-form-item>
			<el-form-item label="描述">
				<el-input v-model="layerForm.description" type="textarea" :rows="2" />
			</el-form-item>
			<el-form-item label="配置JSON">
				<el-input v-model="layerForm.configText" type="textarea" :rows="4"
					placeholder='可选，如 {"provider":"cesium_world_terrain"}' />
			</el-form-item>
		</el-form>
		<template #footer>
			<el-button @click="layerDialogVisible = false">取消</el-button>
			<el-button type="primary" :loading="layerDialogSaving" @click="onSaveLayer">保存</el-button>
		</template>
	</el-dialog>

	<!-- 图层详情弹窗（GET /layers/{id}） -->
	<el-dialog
		v-model="layerDetailVisible"
		title="图层详情"
		width="480px"
		:close-on-click-modal="true"
	>
		<div v-if="layerStore.layerDetailLoading" class="detail-loading">
			<i class="fa-solid fa-circle-notch fa-spin"></i>
			加载中…
		</div>
		<template v-else-if="layerStore.layerDetail">
			<div class="detail-row">
				<span class="detail-label">图层名称</span>
				<span class="detail-value">{{ layerStore.layerDetail.name }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">图层编码</span>
				<span class="detail-value code">{{ layerStore.layerDetail.code }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">分组</span>
				<span class="detail-value">{{ layerStore.layerDetail.group_name || '--' }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">类型</span>
				<span class="detail-value">{{ layerStore.layerDetail.layer_type }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">服务地址</span>
				<span class="detail-value url">{{ layerStore.layerDetail.url || '--' }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">图标</span>
				<span class="detail-value code">{{ layerStore.layerDetail.icon || '--' }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">排序</span>
				<span class="detail-value">{{ layerStore.layerDetail.order }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">显示</span>
				<span class="detail-value">
					<el-tag size="small" :type="layerStore.layerDetail.is_visible ? 'success' : 'info'">
						{{ layerStore.layerDetail.is_visible ? '可见' : '隐藏' }}
					</el-tag>
				</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">启用</span>
				<span class="detail-value">
					<el-tag size="small" :type="layerStore.layerDetail.is_enabled ? 'success' : 'info'">
						{{ layerStore.layerDetail.is_enabled ? '启用' : '停用' }}
					</el-tag>
				</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">描述</span>
				<span class="detail-value">{{ layerStore.layerDetail.description || '--' }}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">配置</span>
				<span class="detail-value">
					<pre class="detail-config">{{ detailConfigText }}</pre>
				</span>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import GlassPanel from '@/components/common/GlassPanel.vue'
import AnalysisResultsList from '@/components/cesium/analysis/AnalysisResultsList.vue'
import { useGISStore } from '@/stores/gis'
import { useCesiumStore } from '@/stores/cesium'
import { useLayerStore, type GISLayer } from '@/stores/layers'
import { applyDemTerrain } from '@/utils/orchardPreview'
import type { GISToolType } from '@/types/draw'

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

// === Style Configuration - 恢复彩色主题 ===
const styleConfig = reactive<StyleConfig>({
	fillColor: '#22D3EE',
	strokeColor: '#FFFFFF',
	fillOpacity: 0.3,
	strokeWidth: 2,
	pointSize: 10,
})

// Style presets - 恢复彩色主题
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
	point: '点',
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
const activeTab = ref<'resources' | 'features' | 'management' | 'analysis'>('resources')
const drawStyleCollapsed = ref(false) // Expanded by default
const selectionStyleCollapsed = ref(false)

// Auto-switch to features tab when a drawing tool is activated from TopRibbon
watch(
	() => gisStore.toolType,
	(newToolType) => {
		if (newToolType && isDrawingTool(newToolType)) {
			activeTab.value = 'features'
		}
	}
)

// Dynamic layers from store (data-driven)
const layerStore = useLayerStore()

// Draw tools configuration with tooltips
// analysis 标记的工具为 3D 分析工具（红色高亮），走 gisStore.setTool → GISLayer 的 activateAnalysisTool
const drawTools: Array<{
	id: GISToolType
	name: string
	icon: string
	tooltip: string
	analysis?: boolean
}> = [
	{ id: 'draw-point', name: '点', icon: 'fa-solid fa-location-dot', tooltip: '点 - 单击放置点' },
	{
		id: 'draw-line',
		name: '线绘制',
		icon: 'fa-solid fa-minus',
		tooltip: '线绘制 - 连续点击添加节点，双击完成',
	},
	{
		id: 'draw-circle',
		name: '圆形',
		icon: 'fa-regular fa-circle',
		tooltip: '圆形 - 点击设置圆心，拖动设置半径',
	},
	{
		id: 'draw-rectangle',
		name: '矩形',
		icon: 'fa-regular fa-square',
		tooltip: '矩形 - 点击对角两点绘制',
	},
	{
		id: 'draw-polygon',
		name: '多边形',
		icon: 'fa-solid fa-draw-polygon',
		tooltip: '多边形 - 连续点击添加节点，双击完成',
	},
	// ---- 3D 分析工具（需 DEM 地形） ----
	{
		id: 'volume',
		name: '方量分析',
		icon: 'fa-solid fa-cubes',
		tooltip: '方量分析 - 框选区域计算挖填方量（需地形）',
		analysis: true,
	},
	{
		id: 'profile',
		name: '剖面分析',
		icon: 'fa-solid fa-mountain',
		tooltip: '剖面分析 - 拉一条线查看沿线地形高程剖面',
		analysis: true,
	},
	{
		id: 'measure3d',
		name: '3D测量',
		icon: 'fa-solid fa-ruler-vertical',
		tooltip: '3D测量 - 测量两点空间距离与坡度（需地形）',
		analysis: true,
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

// Quick Templates
// Quick Templates
interface QuickTemplate {
	id: string
	name: string
	icon: string
	toolType: GISToolType
	style: {
		fillColor: string
		strokeColor: string
		fillOpacity: number
		strokeWidth: number
		pointColor?: string
		pointSize?: number
		lineType?: 'solid' | 'dashed' | 'dotted'
		iconType?: 'dot' | 'pin' | 'diamond' | 'star' | 'camera' | 'wifi'
		centerIcon?: string
	}
}

const quickTemplates: QuickTemplate[] = [
	// === Safety & Emergency ===
	{
		id: 'warning-zone',
		name: '警戒区',
		icon: 'fa-solid fa-triangle-exclamation',
		toolType: 'draw-polygon',
		style: {
			fillColor: '#EF4444',
			strokeColor: '#F87171',
			fillOpacity: 0.35,
			strokeWidth: 2,
			lineType: 'dashed',
			centerIcon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23EF4444'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E"
		},
	},
	{
		id: 'safe-zone',
		name: '安全区',
		icon: 'fa-solid fa-shield-halved',
		toolType: 'draw-polygon',
		style: { fillColor: '#10B981', strokeColor: '#34D399', fillOpacity: 0.35, strokeWidth: 2 },
	},

	// === Environment ===
	{
		id: 'vegetation',
		name: '植被',
		icon: 'fa-solid fa-tree',
		toolType: 'draw-polygon',
		style: { fillColor: '#22C55E', strokeColor: '#4ADE80', fillOpacity: 0.4, strokeWidth: 1 },
	},
	{
		id: 'construction',
		name: '施工区',
		icon: 'fa-solid fa-trowel-bricks',
		toolType: 'draw-rectangle',
		style: { fillColor: '#EAB308', strokeColor: '#FDE047', fillOpacity: 0.2, strokeWidth: 2, lineType: 'dashed' },
	},

	// === Infrastructure ===
	{
		id: 'pipeline',
		name: '管道',
		icon: 'fa-solid fa-arrows-left-right',
		toolType: 'draw-line',
		style: { fillColor: '#6366F1', strokeColor: '#6366F1', fillOpacity: 1, strokeWidth: 5, lineType: 'solid' },
	},

	// === Monitoring ===
	{
		id: 'sensor',
		name: '传感器',
		icon: 'fa-solid fa-wifi',
		toolType: 'draw-point',
		style: { fillColor: '#8B5CF6', strokeColor: '#DDD6FE', fillOpacity: 1, strokeWidth: 2, pointColor: '#8B5CF6', pointSize: 12, iconType: 'wifi' },
	},
	{
		id: 'camera',
		name: '监控',
		icon: 'fa-solid fa-video',
		toolType: 'draw-point',
		style: { fillColor: '#64748B', strokeColor: '#F1F5F9', fillOpacity: 1, strokeWidth: 2, pointColor: '#64748B', pointSize: 12, iconType: 'camera' },
	},
	{
		id: 'poi',
		name: '关注点',
		icon: 'fa-solid fa-location-dot',
		toolType: 'draw-point',
		style: { fillColor: '#F43F5E', strokeColor: '#FFE4E6', fillOpacity: 1, strokeWidth: 2, pointColor: '#F43F5E', pointSize: 16, iconType: 'pin' },
	},
]

// Apply quick template
function applyQuickTemplate(template: QuickTemplate) {
	// Apply style to drawStyle
	drawStyle.fillColor = template.style.fillColor
	drawStyle.strokeColor = template.style.strokeColor
	drawStyle.fillOpacity = template.style.fillOpacity
	drawStyle.strokeWidth = template.style.strokeWidth
	if (template.style.pointColor) drawStyle.pointColor = template.style.pointColor
	if (template.style.pointSize) drawStyle.pointSize = template.style.pointSize
	if (template.style.lineType) drawStyle.lineType = template.style.lineType
	if (template.style.iconType) drawStyle.iconType = template.style.iconType
	drawStyle.centerIcon = template.style.centerIcon

	gisStore.setTool(template.toolType)
}

// Get template preview style for CSS
function getTemplatePreviewStyle(template: QuickTemplate) {
	return {
		backgroundColor: template.style.fillColor,
		borderColor: template.style.strokeColor,
		opacity: template.style.fillOpacity + 0.3,
	}
}



// Search query
const searchQuery = ref('')

// Shortcuts help visibility
const showShortcutsHelp = ref(false)

// Use store's drawStyle (shared with GISLayer.vue)
const drawStyle = gisStore.drawStyle

// Point icon options for point tool
const pointIconOptions = [
	{ id: 'dot' as const, name: '圆点', icon: 'fa-solid fa-circle' },
	{ id: 'pin' as const, name: '图钉', icon: 'fa-solid fa-location-dot' },
	{ id: 'diamond' as const, name: '菱形', icon: 'fa-solid fa-diamond' },
	{ id: 'star' as const, name: '星形', icon: 'fa-solid fa-star' },
]

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
		drawStyle.iconType,
	],
	() => {
		// Only sync if a drawing tool is active
		if (gisStore.toolType && isDrawingTool(gisStore.toolType)) {
			const currentToolType = gisStore.toolType
			console.log(
				`[LayerControl] Syncing drawStyle changes to toolStyles for tool: ${currentToolType}`
			)

			const newStyle = {
				strokeColor: drawStyle.strokeColor,
				strokeWidth: drawStyle.strokeWidth,
				fillColor: drawStyle.fillColor,
				fillOpacity: drawStyle.fillOpacity,
				lineType: drawStyle.lineType,
				pointColor: drawStyle.pointColor,
				pointSize: drawStyle.pointSize,
				iconType: drawStyle.iconType,
			}

			// Update toolStyles (persist to localStorage)
			gisStore.updateToolStyle(currentToolType as any, newStyle)

			// Directly update the current active tool's style (no reactivation needed)
			const currentTool = gisStore.currentTool
			if (currentTool && typeof currentTool.updateStyle === 'function') {
				currentTool.updateStyle(newStyle)
			}
		}
	},
	{ deep: true }
)

// Check if tool is a drawing tool
function isDrawingTool(toolType: string | null): boolean {
	if (!toolType) return false
	return ['draw-point', 'draw-line', 'draw-circle', 'draw-rectangle', 'draw-polygon'].includes(toolType)
}

// Check if tool is a shape tool (has fill)
function isShapeTool(toolType: string | null): boolean {
	if (!toolType) return false
	return ['draw-circle', 'draw-rectangle', 'draw-polygon'].includes(toolType)
}

// File input ref for import
const fileInput = ref<HTMLInputElement | null>(null)

declare const Cesium: any

// === Resource Layer Functions (Dynamic) ===
async function onLayerToggle(layer: any) {
	const config = layer.config || {}
	const exclusiveGroup = config.exclusive_group
	const isActivating = !layerStore.isLayerActive(layer.id)

	// Handle exclusive groups (e.g., terrain - only one can be active)
	if (exclusiveGroup && isActivating) {
		// Find and deactivate all other layers in the same exclusive group
		const sameGroupLayers = layerStore.layers.filter(
			l => (l.config as any)?.exclusive_group === exclusiveGroup && l.id !== layer.id
		)
		for (const otherLayer of sameGroupLayers) {
			if (layerStore.isLayerActive(otherLayer.id)) {
				layerStore.toggleLayer(otherLayer.id)
			}
		}
	}

	// Toggle the layer state
	layerStore.toggleLayer(layer.id)

	// Special handling for terrain layers
	if (layer.layer_type === 'terrain') {
		await applyTerrain(layer, isActivating)
	}
}

/**
 * Apply terrain provider based on layer config
 */
async function applyTerrain(layer: any, isActivating: boolean) {
	const viewer = cesiumStore.viewer
	if (!viewer) return

	const config = layer.config || {}

	if (!isActivating) {
		// Deactivating - restore DEM baseline terrain (orchard ground truth),
		// never fall back to flat ellipsoid (would make trees float in the air)
		const demOn = await applyDemTerrain(viewer)
		cesiumStore.terrainEnabled = demOn
		console.log('[LayerControl] Terrain layer off, restored DEM terrain')
		return
	}

	try {
		if (config.provider === 'cesium_world_terrain') {
			viewer.terrainProvider = await Cesium.createWorldTerrainAsync()
			console.log('[LayerControl] Loaded Cesium World Terrain')
		} else if (config.provider === 'ion' && config.assetId) {
			viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(config.assetId)
			console.log(`[LayerControl] Loaded ion terrain asset: ${config.assetId}`)
		} else if (config.provider === 'custom' && layer.url) {
			viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(layer.url)
			console.log(`[LayerControl] Loaded custom terrain: ${layer.url}`)
		}
		cesiumStore.terrainEnabled = true
	} catch (e) {
		console.error('[LayerControl] Failed to load terrain:', e)
		// 失败时恢复 DEM 基准地形,而不是回落到扁平椭球(否则树会悬浮)
		const demOn = await applyDemTerrain(viewer)
		cesiumStore.terrainEnabled = demOn
	}
}

/**
 * Get display name for layer group
 */
function getGroupDisplayName(groupName: string): string {
	const groupNames: Record<string, string> = {
		'Base': '基础图层',
		'Terrain': '地形数据',
		'Imagery': '正射影像',
		'3D Models': '三维模型',
		'Sensors': '监测数据',
		'Other': '其他'
	}
	return groupNames[groupName] || groupName
}

// === 图层 CRUD（新增/编辑/删除，调后端 /layers） ===
const layerDialogVisible = ref(false)
const layerDialogMode = ref<'create' | 'edit'>('create')
const layerDialogSaving = ref(false)
const editingLayerId = ref<number | null>(null)

interface LayerFormState {
	name: string
	code: string
	layer_type: string
	group_name: string
	url: string
	icon: string
	order: number
	is_enabled: boolean
	is_visible: boolean
	description: string
	configText: string
}

const layerForm = reactive<LayerFormState>({
	name: '',
	code: '',
	layer_type: 'imagery',
	group_name: '',
	url: '',
	icon: 'fa-solid fa-layer-group',
	order: 0,
	is_enabled: true,
	is_visible: false,
	description: '',
	configText: '',
})

function resetLayerForm() {
	layerForm.name = ''
	layerForm.code = ''
	layerForm.layer_type = 'imagery'
	layerForm.group_name = ''
	layerForm.url = ''
	layerForm.icon = 'fa-solid fa-layer-group'
	layerForm.order = 0
	layerForm.is_enabled = true
	layerForm.is_visible = false
	layerForm.description = ''
	layerForm.configText = ''
	editingLayerId.value = null
}

function openCreateDialog() {
	layerDialogMode.value = 'create'
	resetLayerForm()
	layerDialogVisible.value = true
}

function openEditDialog(layer: GISLayer) {
	layerDialogMode.value = 'edit'
	editingLayerId.value = layer.id
	layerForm.name = layer.name
	layerForm.code = layer.code
	layerForm.layer_type = layer.layer_type
	layerForm.group_name = layer.group_name || ''
	layerForm.url = layer.url || ''
	layerForm.icon = layer.icon || 'fa-solid fa-layer-group'
	layerForm.order = layer.order ?? 0
	layerForm.is_enabled = layer.is_enabled
	layerForm.is_visible = layer.is_visible
	layerForm.description = layer.description || ''
	layerForm.configText = layer.config ? JSON.stringify(layer.config, null, 2) : ''
	layerDialogVisible.value = true
}

async function onSaveLayer() {
	if (!layerForm.name.trim()) {
		ElMessage.warning('请填写图层名称')
		return
	}
	if (layerDialogMode.value === 'create' && !layerForm.code.trim()) {
		ElMessage.warning('请填写图层编码')
		return
	}

	// 可选配置 JSON，解析失败则提示
	let config: Record<string, unknown> | null = null
	if (layerForm.configText.trim()) {
		try {
			config = JSON.parse(layerForm.configText)
		} catch {
			ElMessage.warning('配置 JSON 格式不正确')
			return
		}
	}

	layerDialogSaving.value = true
	try {
		if (layerDialogMode.value === 'create') {
			await layerStore.createLayer({
				code: layerForm.code.trim(),
				name: layerForm.name.trim(),
				layer_type: layerForm.layer_type,
				group_name: layerForm.group_name.trim() || null,
				url: layerForm.url.trim() || null,
				icon: layerForm.icon.trim() || null,
				order: layerForm.order,
				is_enabled: layerForm.is_enabled,
				is_visible: layerForm.is_visible,
				description: layerForm.description.trim() || null,
				config,
			})
			ElMessage.success('图层创建成功')
		} else {
			await layerStore.updateLayer(editingLayerId.value as number, {
				name: layerForm.name.trim(),
				group_name: layerForm.group_name.trim() || null,
				url: layerForm.url.trim() || null,
				icon: layerForm.icon.trim() || null,
				order: layerForm.order,
				is_enabled: layerForm.is_enabled,
				is_visible: layerForm.is_visible,
				description: layerForm.description.trim() || null,
				config,
			})
			ElMessage.success('图层已更新')
		}
		layerDialogVisible.value = false
	} catch (e: any) {
		console.error('[LayerControl] Save layer failed:', e)
		ElMessage.error(e?.response?.data?.detail || '保存失败，请检查控制台')
	} finally {
		layerDialogSaving.value = false
	}
}

// === 图层详情 ===
const layerDetailVisible = ref(false)

/** 详情配置 JSON 预览文本 */
const detailConfigText = computed(() => {
  const config = layerStore.layerDetail?.config
  return config ? JSON.stringify(config, null, 2) : '--'
})

/** 查看图层详情 → GET /layers/{id} */
async function onViewLayerDetail(layer: GISLayer) {
  layerDetailVisible.value = true
  try {
    await layerStore.fetchLayerDetail(layer.id)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || '获取图层详情失败')
  }
}

async function onDeleteLayer(layer: GISLayer) {
	try {
		await ElMessageBox.confirm(
			`确定删除图层「${layer.name}」吗？此操作不可撤销。`,
			'删除图层',
			{
				confirmButtonText: '删除',
				cancelButtonText: '取消',
				type: 'warning',
			}
		)
	} catch {
		return // 用户取消
	}
	try {
		await layerStore.deleteLayer(layer.id)
		ElMessage.success('图层已删除')
	} catch (e: any) {
		console.error('[LayerControl] Delete layer failed:', e)
		ElMessage.error(e?.response?.data?.detail || '删除失败，请检查控制台')
	}
}

// === GIS Feature Functions (New) ===

/**
 * Toggle draw/analysis tool
 */
function toggleDrawTool(toolId: GISToolType) {
	// 图层管理发起的绘制不触发 TSOM 查询（右上角 POI 工具栏才会置位 queryOnDrawComplete）
	gisStore.queryOnDrawComplete = false
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
				iconType: toolStyle.iconType || drawStyle.iconType,
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

/**
 * Check if feature count is high (performance warning)
 */
const isHighFeatureCount = computed(() => gisStore.featureCount > FEATURE_WARNING_THRESHOLD)

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

	const viewer = gisStore.viewer
	if (!viewer || !viewer.camera) return
	const ellipsoid = viewer.scene.globe.ellipsoid

	// 计算要素外接球：圆形用主实体（64 点多边形填充）取完整边界，
	// 其余图形用 getPositions() 的顶点（多边形/线为带拾取高度的点，矩形为对角点）
	let positions: any[] = []
	if (graphic.type === 'circle') {
		const mainEntity = graphic.getMainEntity()
		const hierarchy = mainEntity?.polygon?.hierarchy?.getValue?.(Cesium.JulianDate.now())
		if (hierarchy?.positions?.length) {
			positions = hierarchy.positions
		}
	} else {
		positions = graphic.getPositions?.() || []
	}
	if (positions.length === 0) return

	const sphere = Cesium.BoundingSphere.fromPoints(positions)
	const centerCarto = ellipsoid.cartesianToCartographic(sphere.center)

	// 基准高度 = 地形高度（优先 globe.getHeight，其次要素中心高度），
	// 避免相机瞄准椭球面（低于 DEM ~185m）导致要素显得远
	let baseHeight = 0
	try {
		const terrainHeight = viewer.scene.globe.getHeight(centerCarto)
		if (typeof terrainHeight === 'number' && isFinite(terrainHeight) && terrainHeight > 0) {
			baseHeight = terrainHeight
		}
	} catch {
		/* ignore */
	}
	const center = graphic.getCenter?.()
	if (center) {
		const centerHeight = ellipsoid.cartesianToCartographic(center).height
		if (isFinite(centerHeight)) {
			baseHeight = Math.max(baseHeight, centerHeight)
		}
	}

	// 相机高度 = 地形基准 + 半径 × 缩放因子（1.4 比默认 fit-to-screen 更近，要素占满画面）
	const radius = Math.max(sphere.radius, 1)
	viewer.camera.flyTo({
		destination: Cesium.Cartesian3.fromRadians(
			centerCarto.longitude,
			centerCarto.latitude,
			baseHeight + radius * 1.4
		),
		orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
		duration: 1.5,
	})
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
onMounted(async () => {
	// Fetch layer configuration from backend
	await layerStore.fetchLayers()

	// Apply terrain for any initially visible terrain layers
	const visibleTerrainLayers = layerStore.layers.filter(
		l => l.layer_type === 'terrain' && layerStore.isLayerActive(l.id)
	)
	if (visibleTerrainLayers.length > 0) {
		// Wait for Cesium viewer to be ready
		const waitForViewer = setInterval(async () => {
			if (cesiumStore.viewer) {
				clearInterval(waitForViewer)
				// Apply the first visible terrain layer
				await applyTerrain(visibleTerrainLayers[0], true)
			}
		}, 100)
		// Timeout after 5 seconds
		setTimeout(() => clearInterval(waitForViewer), 5000)
	}
})
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

.layer-list-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.layer-list-title {
	font-size: 11px;
	font-weight: 600;
	color: $text-sub;
	letter-spacing: 0.5px;
}

.add-layer-btn {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 10px;
	font-size: 11px;
	color: #fff;
	background: rgba(251, 146, 60, 0.25);
	border: 1px solid rgba(251, 146, 60, 0.5);
	border-radius: 6px;
	cursor: pointer;
	transition: all 0.2s;

	&:hover {
		background: rgba(251, 146, 60, 0.4);
	}
}

.layer-group-header {
	font-size: 10px;
	font-weight: 600;
	color: $text-sub;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	padding: 8px 10px 4px;
	margin-top: 4px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);

	&:first-child {
		margin-top: 0;
	}
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

.layer-actions {
	display: flex;
	align-items: center;
	gap: 4px;
}

.layer-action-btn {
	display: none; /* hover 时显示 */
	width: 22px;
	height: 22px;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: $text-sub;
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s;

	&:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.15);
	}

	&.del:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.15);
	}
}

.layer-item:hover .layer-action-btn {
	display: flex;
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

.features-scroll-content {
	flex: 1;
	overflow-y: auto;
	@include custom-scrollbar;
	padding-bottom: 10px;
}

// Analysis Panel
.analysis-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.analysis-scroll-content {
	flex: 1;
	overflow-y: auto;
	@include custom-scrollbar;
	padding: 10px;
}

// Tool Buttons
.tool-buttons {
	display: flex;
	flex-wrap: wrap; // 8 个绘制/分析工具 + 吸附 + 帮助，单行放不下时换行
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
	transition: all 0.3s ease;

	.style-config-header {
		padding: 8px 10px;
		background: rgba(255, 255, 255, 0.05);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		user-select: none;
		transition: background 0.2s;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}

		span {
			display: flex;
			align-items: center;
			gap: 8px;
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

		.icon-selector {
			display: flex;
			gap: 6px;

			.icon-option {
				width: 28px;
				height: 28px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.3);
				border: 1px solid rgba(255, 255, 255, 0.2);
				border-radius: 4px;
				color: $text-sub;
				cursor: pointer;
				transition: all 0.2s;

				&:hover {
					border-color: $neon-cyan;
					color: $text-main;
				}

				&.active {
					background: rgba($neon-cyan, 0.2);
					border-color: $neon-cyan;
					color: $neon-cyan;
				}

				i {
					font-size: 12px;
				}
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
	transition: all 0.3s ease;
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
	cursor: pointer;
	user-select: none;
	transition: background 0.2s;

	&:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	i.fa-palette {
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

// Section Header
.section-header {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: $text-sub;
	margin-bottom: 10px;
	padding-bottom: 6px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);

	i {
		color: $neon-cyan;
	}
}

// Quick Templates Panel
// Quick Templates Panel
.quick-templates-panel {
	margin: 12px 10px;
	padding: 12px;
	background: rgba(0, 0, 0, 0.2); // Subtle card background
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.05);

	.section-header {
		margin-bottom: 12px;
		padding-bottom: 0;
		border-bottom: none;

		span {
			font-size: 13px;
			font-weight: 600;
			letter-spacing: 0.5px;
			color: $text-main;
		}
	}

	.template-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr); // 3 cols for better spacing
		gap: 8px;
	}

	.template-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;

		&:hover {
			background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
			border-color: rgba(34, 211, 238, 0.5);
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

			.template-name {
				color: $neon-cyan;
			}

			.template-preview {
				transform: scale(1.05);
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
			}
		}

		&:active {
			transform: translateY(0);
		}

		.template-preview {
			width: 36px; // Larger preview
			height: 36px;
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 2px solid;
			margin-bottom: 8px;
			transition: all 0.3s ease;
			box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
			background-color: rgba(0, 0, 0, 0.2); // Darker bg behind icon

			i {
				font-size: 16px; // Larger icon
				color: #fff;
				filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
			}
		}

		.template-name {
			font-size: 11px; // Readable font size
			font-weight: 500;
			color: $text-sub;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			max-width: 100%;
			transition: color 0.2s;
		}
	}
}

// === 图层详情弹窗 ===
.detail-loading {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 30px 0;
	justify-content: center;
	color: $text-sub;
	font-size: 13px;

	i {
		color: $neon-cyan;
	}
}

.detail-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 12px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);

	&:last-child {
		border-bottom: none;
	}

	.detail-label {
		flex: 0 0 70px;
		font-size: 12px;
		color: $text-sub;
	}

	.detail-value {
		flex: 1;
		font-size: 12px;
		color: $text-main;
		word-break: break-all;
		text-align: right;

		&.code {
			font-family: $font-code;
		}

		&.url {
			font-family: $font-code;
			color: $neon-cyan;
		}
	}

	.detail-config {
		max-height: 160px;
		overflow-y: auto;
		margin: 0;
		padding: 8px 10px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 11px;
		line-height: 1.5;
		color: $neon-cyan;
		text-align: left;
		white-space: pre-wrap;
		word-break: break-all;
		@include custom-scrollbar;
	}
}
</style>
