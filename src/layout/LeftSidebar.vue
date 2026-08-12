<template>
  <div class="left-sidebar" :class="{ collapsed: !visible }" :style="{ width: sidebarWidth + 'px' }">
    <!-- 侧边栏切换按钮 -->
    <div class="sidebar-toggle" @click="visible = !visible">
      <i :class="visible ? 'fa-solid fa-chevron-left' : 'fa-solid fa-chevron-right'"></i>
    </div>
    
    <!-- 拖拽调整宽度的手柄 -->
    <div 
      class="sidebar-resize-handle" 
      @mousedown="startResize"
      v-show="visible"
    ></div>

    <div class="sidebar-content" v-show="visible">
      <!-- 标签切换 -->
      <div class="tab-switcher">
        <button
          :class="{ active: orchardStore.sidebarActiveTab === 'layers' }"
          @click="orchardStore.sidebarActiveTab = 'layers'"
        >
          <i class="fa-solid fa-layer-group"></i>
          <span>图层</span>
        </button>
        <button
          :class="{ active: orchardStore.sidebarActiveTab === 'files' }"
          @click="orchardStore.sidebarActiveTab = 'files'"
        >
          <i class="fa-solid fa-folder-open"></i>
          <span>文件</span>
        </button>
      </div>

      <!-- 图层面板 -->
      <div class="tab-panel" v-show="orchardStore.sidebarActiveTab === 'layers'">
        <!-- 绘制图形图层 - 每个图形作为独立顶层图层 -->
        <template v-for="geo in orchardStore.drawnGeometries" :key="geo.id">
          <div class="section">
            <div
              class="layer-item"
              :class="{ active: orchardStore.selectedLayerDetail?.id === geo.id }"
              @click="onDrawGeoClick(geo)"
              @dblclick.stop="zoomToGeometry(geo)"
              @contextmenu.prevent.stop="onContextMenu($event, geo)"
            >
              <i class="fa-solid" :class="drawIcon(geo.type)"></i>
              <span class="layer-name">{{ geo.name }}</span>
              <span v-if="geo.poiCount" class="layer-poi-tag">{{ geo.poiCount }}棵</span>
              <button
                class="layer-delete-btn"
                @click.stop="onDeleteDrawGeo(geo)"
                title="删除图形"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </template>

        <!-- 右键菜单 -->
        <teleport to="body">
          <div
            v-if="contextMenu.visible"
            class="layer-context-menu"
            :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
            @click.stop
          >
            <div class="ctx-menu-item" @click="zoomToContextGeo()">
              <i class="fa-solid fa-magnifying-glass"></i>
              <span>缩放至图层</span>
            </div>
            <div class="ctx-menu-item" @click="showContextGeoInfo()">
              <i class="fa-solid fa-circle-info"></i>
              <span>显示图层信息</span>
            </div>
          </div>
        </teleport>
        <!-- 点击空白处关闭菜单 -->
        <div
          v-if="contextMenu.visible"
          class="context-menu-backdrop"
          @click="closeContextMenu"
          @contextmenu.prevent="closeContextMenu"
        ></div>

        <!-- 分析结果图层 -->
        <div class="section" v-if="orchardStore.analysisResults.length > 0">
          <div class="section-title">分析结果</div>
          <div
            v-for="result in orchardStore.analysisResults"
            :key="result.id"
            class="layer-item"
            :class="{ active: orchardStore.activeAnalysisId === result.id }"
            @click="orchardStore.activeAnalysisId = result.id"
          >
            <i
              class="fa-solid"
              :class="{
                'fa-chart-pie text-green': result.type === 'ndvi',
                'fa-cubes text-orange': result.type === 'canopy',
                'fa-leaf text-green': result.type === 'lai',
                'fa-heart-pulse text-red': result.type === 'health',
              }"
            ></i>
            <span class="layer-name">{{ result.name }}</span>
            <span class="layer-status" :class="result.status">
              {{ statusLabel(result.status) }}
            </span>
          </div>
        </div>

        <!-- 施肥方案图层 -->
        <div class="section" v-if="orchardStore.fertilizationPlans.length > 0">
          <div class="section-title">施肥方案</div>
          <div
            v-for="plan in orchardStore.fertilizationPlans"
            :key="plan.id"
            class="layer-item sub-item"
            :class="{ active: orchardStore.activeFertilizationId === plan.id }"
            @click="orchardStore.activeFertilizationId = plan.id"
          >
            <i class="fa-solid fa-droplet text-cyan"></i>
            <span class="layer-name">{{ plan.name }}</span>
            <span class="layer-status" :class="plan.status">
              {{ fertStatusLabel(plan.status) }}
            </span>
          </div>
        </div>
      </div>



      <!-- 文件面板 -->
      <div class="tab-panel" v-show="orchardStore.sidebarActiveTab === 'files'">
        <!-- 上传按钮 -->
        <div class="upload-area">
          <el-upload
            :before-upload="beforeUpload"
            :show-file-list="false"
            :http-request="handleUpload"
            accept="*"
          >
            <button class="upload-btn">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <span>上传文件 (最大1GB)</span>
            </button>
          </el-upload>
          <div class="upload-hint">支持栅格、矢量、点云等数据格式</div>
        </div>

        <!-- 文件列表 -->
        <div class="section">
          <div class="section-title">
            已上传文件
            <span class="count-badge">{{ orchardStore.uploadedFiles.length }}</span>
          </div>
          <div
            v-for="file in orchardStore.uploadedFiles"
            :key="file.id"
            class="file-item"
            :class="{
              active: orchardStore.activeFileId === file.id,
              uploading: file.status === 'uploading',
            }"
            @click="orchardStore.activeFileId = file.id"
          >
            <i class="fa-solid" :class="fileIcon(file)"></i>
            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-meta">
                <span>{{ formatSize(file.size) }}</span>
                <span class="file-status" :class="file.status">
                  {{ fileStatusLabel(file.status) }}
                </span>
              </div>
              <!-- 上传进度条 -->
              <el-progress
                v-if="file.status === 'uploading'"
                :percentage="file.uploadProgress"
                :stroke-width="4"
                :show-text="false"
              />
            </div>
            <button class="file-delete" @click.stop="onDeleteFile(file)">
              <i class="fa-solid fa-xmark"></i>
            </button>

            <!-- 子级文件 (后端分析返回) -->
            <div class="child-files" v-if="file.childFiles && file.childFiles.length > 0">
              <div
                v-for="child in file.childFiles"
                :key="child.id"
                class="child-file-item"
                @click.stop="orchardStore.activeFileId = child.id"
              >
                <i class="fa-solid fa-file-lines"></i>
                <span>{{ child.name }}</span>
                <span class="child-status" :class="child.status">
                  {{ fileStatusLabel(child.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { useCesiumStore } from '@/stores/cesium'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadedFile } from '@/types/orchard'

const orchardStore = useOrchardStore()
const cesiumStore = useCesiumStore()
const visible = ref(true)

// 侧边栏宽度（默认缩小为200px）
const sidebarWidth = ref(200)
const isResizing = ref(false)
const minWidth = 150
const maxWidth = 450

function startResize(e: MouseEvent) {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  
  const container = document.querySelector('.main-layout')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const newWidth = e.clientX - containerRect.left
  
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    sidebarWidth.value = newWidth
  }
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// ---- 右键菜单 ----
const contextMenu = ref<{ visible: boolean; x: number; y: number; geo: any }>({
  visible: false,
  x: 0,
  y: 0,
  geo: null,
})

const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    processing: '分析中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

function fertStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    executing: '执行中',
    completed: '已完成',
  }
  return map[status] || status
}

function fileStatusLabel(status: string) {
  const map: Record<string, string> = {
    uploading: '上传中',
    processing: '分析中',
    completed: '完成',
    failed: '失败',
  }
  return map[status] || status
}

function fileIcon(file: UploadedFile) {
  if (file.type.includes('image') || file.type.includes('tif')) return 'fa-image'
  if (file.type.includes('zip') || file.type.includes('rar')) return 'fa-file-zipper'
  if (file.type.includes('json') || file.type.includes('geojson')) return 'fa-file-code'
  if (file.type.includes('csv') || file.type.includes('excel')) return 'fa-file-csv'
  return 'fa-file'
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB'
  return bytes + ' B'
}

function beforeUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件 ${file.name} 超过1GB大小限制`)
    return false
  }
  return true
}

async function handleUpload(options: { file: File }) {
  try {
    await orchardStore.uploadSingleFile(options.file)
    ElMessage.success(`${options.file.name} 上传成功`)
  } catch {
    ElMessage.error(`${options.file.name} 上传失败`)
  }
}

function onDeleteFile(file: UploadedFile) {
  ElMessageBox.confirm(`确定删除文件 "${file.name}" 吗?`, '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    orchardStore.deleteFile(file.id)
    ElMessage.success('文件已删除')
  })
}

function drawIcon(type: string): string {
  switch (type) {
    case 'rectangle': return 'fa-regular fa-square'
    case 'circle': return 'fa-regular fa-circle'
    case 'polygon': return 'fa-solid fa-draw-polygon'
    default: return 'fa-regular fa-file'
  }
}

function onDrawGeoClick(geo: any) {
  // 使用 store 中的方法显示图层详细信息面板
  orchardStore.showLayerDetail(geo)
}

function onDeleteDrawGeo(geo: any) {
  ElMessageBox.confirm(`确定删除"${geo.name}"吗？地图上的图形也将消失。`, '删除图形', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    orchardStore.removeDrawnGeometry(geo.id)
    ElMessage.success('图形已删除')
  })
}

// ---- 右键菜单 ----
function onContextMenu(e: MouseEvent, geo: any) {
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, geo }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function zoomToContextGeo() {
  if (contextMenu.value.geo) zoomToGeometry(contextMenu.value.geo)
  closeContextMenu()
}

function showContextGeoInfo() {
  if (contextMenu.value.geo) {
    orchardStore.showLayerDetail(contextMenu.value.geo)
  }
  closeContextMenu()
}

function getFlatCoords(geo: any): number[][] {
  if (!geo?.coordinates) return []
  const c = geo.coordinates
  if (geo.type === 'polygon' && Array.isArray(c[0]) && Array.isArray(c[0][0])) {
    return c[0]
  }
  if (Array.isArray(c[0]) && typeof c[0][0] === 'number') {
    return c
  }
  return []
}

// ---- 缩放至图形 ----
function zoomToGeometry(geo: any) {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const Cesium = (window as any).Cesium
  const coords = getFlatCoords(geo)
  if (coords.length === 0) return

  // 计算包围盒
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const c of coords) {
    if (c[0] < minLon) minLon = c[0]
    if (c[0] > maxLon) maxLon = c[0]
    if (c[1] < minLat) minLat = c[1]
    if (c[1] > maxLat) maxLat = c[1]
  }

  // 对于圆形，使用较小范围
  const lonSpan = maxLon - minLon || 0.002
  const latSpan = maxLat - minLat || 0.002
  const margin = 1.5

  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(
      minLon - lonSpan * (margin - 1),
      minLat - latSpan * (margin - 1),
      maxLon + lonSpan * (margin - 1),
      maxLat + latSpan * (margin - 1),
    ),
    duration: 1.5,
  })

  ElMessage.success(`已缩放至: ${geo.name}`)
}


</script>

<style scoped lang="scss">
.left-sidebar {
  position: absolute;
  left: 0;
  top: 50px;
  min-width: 150px;
  max-width: 450px;
  height: calc(100% - 50px);
  background: $sidebar-bg;
  backdrop-filter: blur(20px);
  border-right: 1px solid $border-subtle;
  z-index: $z-layer-5;
  pointer-events: auto;
  transition: transform 0.3s $ease-out;
  display: flex;

  &.collapsed {
    transform: translateX(calc(-100% + 32px));
  }
}

.sidebar-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &:active {
    background: rgba(150, 150, 150, 0.6);
  }
}

.sidebar-toggle {
  position: absolute;
  right: -32px;
  top: 16px;
  width: 32px;
  height: 36px;
  background: $sidebar-bg;
  border: 1px solid $border-subtle;
  border-left: none;
  border-radius: 0 6px 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: $text-sub;
  z-index: $z-layer-5;
  pointer-events: auto;

  &:hover {
    color: $text-main;
    background: rgba(34, 211, 238, 0.15);
  }
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-switcher {
  display: flex;
  padding: 12px 12px 0;
  gap: 6px;

  button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid $border-subtle;
    border-radius: 8px;
    background: transparent;
    color: $text-sub;
    cursor: pointer;
    font-size: 13px;
    font-family: $font-ui;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: $text-main;
    }

    &.active {
      background: rgba(100, 100, 100, 0.3);
      border-color: rgba(150, 150, 150, 0.4);
      color: #ffffff;
    }
  }
}

.tab-panel {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section {
  margin-bottom: 16px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: $text-dim;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding: 0 4px;

    .count-badge {
      background: rgba(100, 100, 100, 0.3);
      color: #ffffff;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 8px;
    }
  }
}

.layer-item,
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2px;
  flex-wrap: wrap;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &.active {
    background: rgba(100, 100, 100, 0.3);
    border: 1px solid rgba(150, 150, 150, 0.3);
  }

  .layer-name {
    flex: 1;
    font-size: 13px;
    color: $text-main;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-opacity {
    width: 100%;
    padding-left: 28px;
  }

  .layer-status,
  .file-status {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;

    &.completed { color: $success-green; background: rgba(34, 197, 94, 0.1); }
    &.processing { color: $warn-yellow; background: rgba(234, 179, 8, 0.1); }
    &.pending { color: $text-dim; background: rgba(100, 116, 139, 0.1); }
    &.failed { color: $alert-red; background: rgba(239, 68, 68, 0.1); }
    &.uploading { color: $neon-cyan; background: rgba(34, 211, 238, 0.1); }
  }
}

.layer-item.sub-item {
  padding-left: 24px;
  font-size: 12px;
}

.text-green { color: $leaf-green; }
.text-orange { color: $orchard-orange; }
.text-red { color: $alert-red; }
.text-cyan { color: $neon-cyan; }

.upload-area {
  margin-bottom: 16px;
  padding: 4px;
  border: 1px dashed $border-subtle;
  border-radius: 10px;
  text-align: center;
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgba(100, 100, 100, 0.3);
  border: 1px solid rgba(150, 150, 150, 0.4);
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  font-family: $font-ui;
  transition: all 0.2s;

  &:hover {
    background: rgba(120, 120, 120, 0.4);
  }
}

.upload-hint {
  font-size: 11px;
  color: $text-dim;
  margin-top: 6px;
}

.file-item {
  flex-wrap: wrap;
  position: relative;

  &.uploading {
    background: rgba(34, 211, 238, 0.05);
  }

  .file-info {
    flex: 1;
    min-width: 0;

    .file-name {
      font-size: 13px;
      color: $text-main;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: $text-dim;
      margin-top: 2px;
    }
  }

  .file-delete {
    background: none;
    border: none;
    color: $text-dim;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    opacity: 0;
    transition: all 0.2s;

    &:hover {
      color: $alert-red;
      background: rgba(239, 68, 68, 0.1);
    }
  }

  &:hover .file-delete {
    opacity: 1;
  }
}

.layer-poi-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(74, 222, 128, 0.15);
  color: $orchard-green;
}

.layer-delete-btn {
  background: none;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: all 0.2s;

  &:hover {
    color: $alert-red;
    background: rgba(239, 68, 68, 0.1);
  }
}

.layer-item:hover .layer-delete-btn {
  opacity: 1;
}

// ---- 绘制图形数据弹窗 ----
.geo-popup-content {
  color: $text-main;

  .geo-popup-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .geo-popup-label {
    color: $text-dim;
    font-size: 13px;
  }

  .geo-popup-value {
    font-size: 13px;
    font-weight: 500;

    &.highlight {
      color: $orchard-orange;
      font-weight: 700;
    }
  }

  .geo-popup-section {
    margin-top: 12px;
  }

  .geo-popup-section-title {
    font-size: 12px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 6px;
  }

  .geo-coords-scroll {
    max-height: 180px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 6px;
  }

  .geo-coord-line {
    display: flex;
    gap: 12px;
    padding: 3px 6px;
    font-size: 12px;
    font-family: $font-code;

    .coord-idx {
      color: $text-dim;
      min-width: 28px;
    }

    .coord-val {
      color: $neon-cyan;
    }
  }
}

// ---- 右键菜单 ----
.layer-context-menu {
  position: fixed;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid $border-glass;
  border-radius: 10px;
  padding: 6px;
  min-width: 170px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  color: $text-sub;
  font-size: 13px;
  transition: all 0.15s;

  i {
    width: 16px;
    text-align: center;
    color: $text-dim;
  }

  &:hover {
    background: rgba(251, 146, 60, 0.12);
    color: $orchard-orange;

    i { color: $orchard-orange; }
  }
}

.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: auto;
}

.child-files {
  width: 100%;
  padding-left: 24px;
  margin-top: 4px;
  border-top: 1px solid $border-subtle;
  padding-top: 4px;
}

.child-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: $text-sub;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: $text-main;
  }
}
</style>
