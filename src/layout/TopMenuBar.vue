<template>
  <div class="top-menu-bar">
    <!-- Logo & Title -->
    <div class="logo-section">
      <svg class="logo-icon" viewBox="0 0 32 32" width="24" height="24">
        <defs>
          <radialGradient id="orangeGrad" cx="40%" cy="35%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="60%" stop-color="#fb923c"/>
            <stop offset="100%" stop-color="#ea580c"/>
          </radialGradient>
        </defs>
        <circle cx="16" cy="18" r="12" fill="url(#orangeGrad)"/>
        <ellipse cx="14" cy="7" rx="3" ry="5" fill="#4ade80" transform="rotate(-15 14 7)"/>
        <ellipse cx="14" cy="8.5" rx="1.2" ry="3" fill="#22c55e" transform="rotate(-15 14 8.5)"/>
        <circle cx="10" cy="15" r="1.8" fill="rgba(255,255,255,0.25)"/>
        <circle cx="21" cy="5" rx="1.5" ry="3" fill="#4ade80" transform="rotate(20 21 5)"/>
      </svg>
      <span class="logo-text">脐橙冠层三维解析系统</span>
    </div>

    <!-- 模块菜单 -->
    <div class="menu-section">
      <div
        v-for="item in orchardStore.menuItems"
        :key="item.id"
        class="menu-item"
        :class="{ active: appStore.currentModule === item.id }"
        @click="onMenuClick(item)"
      >
        <i :class="item.icon"></i>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <!-- 绘制工具分隔 -->
    <div class="draw-divider"></div>

    <!-- 图形绘制工具栏 -->
    <div class="draw-tools">
      <!-- 选择/指针模式 - 退出绘制工具，允许选中地图图形 -->
      <button
        class="draw-btn select-btn"
        :class="{ active: selectMode }"
        @click="activateSelectMode"
        title="选择模式（退出绘制，点击地图图形可选中）"
      >
        <i class="fa-solid fa-arrow-pointer"></i>
      </button>
      <div class="tool-separator"></div>
      <button
        class="draw-btn"
        :class="{ active: activeTool === 'rectangle' }"
        @click="setTool('rectangle')"
        title="矩形绘制"
      >
        <i class="fa-regular fa-square"></i>
      </button>
      <button
        class="draw-btn"
        :class="{ active: activeTool === 'circle' }"
        @click="setTool('circle')"
        title="圆形绘制"
      >
        <i class="fa-regular fa-circle"></i>
      </button>
      <button
        class="draw-btn"
        :class="{ active: activeTool === 'polygon' }"
        @click="setTool('polygon')"
        title="多边形绘制"
      >
        <i class="fa-solid fa-draw-polygon"></i>
      </button>
      <div class="tool-separator"></div>
      <button class="draw-btn clear-btn" @click="deleteSelected" title="删除选中图形（Delete键）">
        <i class="fa-solid fa-trash-can"></i>
      </button>

      <!-- 选中数量信息 -->
      <span class="selection-badge" v-if="selectedCount > 0">
        已选 {{ selectedCount }} 个
      </span>
    </div>

    <!-- 右侧操作区 -->
    <div class="actions-section">
      <el-tooltip content="查询" placement="bottom">
        <button class="action-btn query-btn" @click="openQueryPanel">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
      </el-tooltip>
      <el-tooltip content="颜色渲染设置" placement="bottom">
        <button class="action-btn" @click="orchardStore.showRenderSettings = true">
          <i class="fa-solid fa-palette"></i>
        </button>
      </el-tooltip>
      <el-tooltip content="图表统计" placement="bottom">
        <button class="action-btn" @click="orchardStore.showChartDialog = !orchardStore.showChartDialog">
          <i class="fa-solid fa-chart-simple"></i>
        </button>
      </el-tooltip>
      <el-tooltip content="回到初始视角" placement="bottom">
        <button class="action-btn" @click="resetView">
          <i class="fa-solid fa-home"></i>
        </button>
      </el-tooltip>
      <el-tooltip content="全屏" placement="bottom">
        <button class="action-btn" @click="toggleFullscreen">
          <i class="fa-solid fa-expand"></i>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useOrchardStore } from '@/stores/orchard'
import { useGISStore } from '@/stores/gis'
import { useCesiumStore } from '@/stores/cesium'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ModuleMenuItem } from '@/types/orchard'

const router = useRouter()
const appStore = useAppStore()
const orchardStore = useOrchardStore()
const gisStore = useGISStore()
const cesiumStore = useCesiumStore()

const activeTool = ref<'rectangle' | 'circle' | 'polygon' | null>(null)
// 选择模式：点击地图图形进行选中/取消选中
const selectMode = ref(true)

// 当前选中的 feature 数量
const selectedCount = computed(() => gisStore.selectedCount)

const onMenuClick = (item: ModuleMenuItem) => {
  router.push(`/${item.id}`)
}

// 激活选择模式（退出绘制工具，允许点击地图选中图形）
const activateSelectMode = () => {
  // 退出所有绘制工具
  activeTool.value = null
  gisStore.stopDrawing()
  gisStore.deselectFeature()
  // 切换到选择模式
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    ElMessage.success('选择模式已开启，点击地图图形可选中')
  } else {
    ElMessage.info('选择模式已关闭')
  }
}

const setTool = (tool: 'rectangle' | 'circle' | 'polygon') => {
  if (activeTool.value === tool) {
    activeTool.value = null
    gisStore.stopDrawing()
    selectMode.value = true
  } else {
    activeTool.value = tool
    selectMode.value = false
    gisStore.startDrawing(tool)
  }
}

// 删除所有选中的图形
const deleteSelected = () => {
  const selectedIds = [...gisStore.selectedFeatureIds]
  if (selectedIds.length === 0) {
    ElMessage.warning('没有选中的图形。请先点击 🖱 选择模式，再点击地图上的图形选中后删除。')
    return
  }

  ElMessageBox.confirm(
    `确定删除选中的 ${selectedIds.length} 个图形吗？此操作不可撤销。`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    selectedIds.forEach((featureId) => {
      // 同步移除侧边栏图层
      const geoIndex = orchardStore.drawnGeometries.findIndex(
        (g) => g.featureId === featureId
      )
      if (geoIndex !== -1) {
        const geo = orchardStore.drawnGeometries[geoIndex]
        orchardStore.drawnGeometries.splice(geoIndex, 1)
      }
      // 移除地图图形
      gisStore.removeFeature(featureId)
    })
    gisStore.deselectFeature()
    ElMessage.success(`已删除 ${selectedIds.length} 个图形`)
  }).catch(() => {
    // 用户取消
  })
}

const openQueryPanel = () => {
  orchardStore.showQueryPanel = !orchardStore.showQueryPanel
}

const resetView = () => {
  try {
    cesiumStore.zoomToHome()
    ElMessage.success('已回到初始视角')
  } catch (e) {
    console.error('resetView failed:', e)
    ElMessage.error('回到初始视角失败，请查看控制台日志')
  }
}

const toggleFullscreen = () => {
  const doc = document.documentElement
  if (!document.fullscreenElement) {
    doc.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// 监听 SelectMode 关闭时清除选中
watch(selectMode, (val) => {
  if (!val) {
    gisStore.deselectFeature()
  }
})
</script>

<style lang="scss" scoped>
$text-main: #ffffff;
$text-sub: rgba(255, 255, 255, 0.7);
$border-subtle: rgba(255, 255, 255, 0.15);
$orchard-orange: #fb923c;

.top-menu-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: rgba(26, 32, 44, 0.95);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  z-index: 1000;
  border-bottom: 1px solid $border-subtle;
  pointer-events: auto;

  .logo-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    flex-shrink: 0;
  }

  .logo-text {
    font-size: 15px;
    font-weight: 600;
    color: $text-main;
    white-space: nowrap;
  }
}

.menu-section {
  display: flex;
  gap: 4px;
  flex: 1;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: $text-sub;
  font-size: 14px;
  transition: all 0.2s;
  white-space: nowrap;
  pointer-events: auto;

  i {
    font-size: 16px;
  }

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.1);
  }

  &.active {
    color: #ffffff;
    background: rgba(100, 100, 100, 0.4);
    border: 1px solid rgba(150, 150, 150, 0.3);
  }
}

.draw-divider {
  width: 1px;
  height: 28px;
  background: $border-subtle;
  margin: 0 4px;
}

.draw-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  pointer-events: auto;
}

.tool-separator {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}

.draw-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: $text-sub;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  pointer-events: auto;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }

  &.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
  }
}

.clear-btn:hover {
  color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.15) !important;
}

.selection-badge {
  font-size: 11px;
  color: $orchard-orange;
  font-weight: 600;
  margin-left: 6px;
  padding: 2px 8px;
  background: rgba(251, 146, 60, 0.1);
  border-radius: 8px;
  white-space: nowrap;
}

.actions-section {
  display: flex;
  gap: 4px;
  padding-left: 12px;
  border-left: 1px solid $border-subtle;
  pointer-events: auto;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: $text-sub;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  pointer-events: auto;

  &:hover {
    color: $text-main;
    background: rgba(100, 100, 100, 0.4);
  }
}

.query-btn:hover {
  color: $text-main !important;
  background: rgba(100, 100, 100, 0.5) !important;
}
</style>
