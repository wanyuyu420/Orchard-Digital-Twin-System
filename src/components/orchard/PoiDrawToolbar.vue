<template>
  <div class="poi-draw-toolbar">
    <el-tooltip content="矩形选择" placement="right">
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'rectangle' }"
        @click="setTool('rectangle')"
      >
        <i class="fa-regular fa-square"></i>
      </button>
    </el-tooltip>
    <el-tooltip content="圆形选择" placement="right">
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'circle' }"
        @click="setTool('circle')"
      >
        <i class="fa-regular fa-circle"></i>
      </button>
    </el-tooltip>
    <el-tooltip content="多边形选择" placement="right">
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'polygon' }"
        @click="setTool('polygon')"
      >
        <i class="fa-solid fa-draw-polygon"></i>
      </button>
    </el-tooltip>

    <div class="tool-divider"></div>

    <el-tooltip content="清除选择" placement="right">
      <button class="tool-btn clear-btn" @click="clearSelection">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </el-tooltip>

    <!-- 选择范围信息 -->
    <div class="selection-info" v-if="orchardStore.selectionRange">
      <span class="range-type">{{ rangeTypeLabel }}</span>
      <span class="poi-count" v-if="orchardStore.tsomQueryResult">
        {{ orchardStore.tsomQueryResult.totalTrees }}棵
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { useGISStore } from '@/stores/gis'
import { ElMessage } from 'element-plus'

const orchardStore = useOrchardStore()
const gisStore = useGISStore()
const activeTool = ref<'rectangle' | 'circle' | 'polygon' | null>(null)

const rangeTypeLabel = computed(() => {
  if (!orchardStore.selectionRange) return ''
  switch (orchardStore.selectionRange.type) {
    case 'rectangle':
      return '矩形范围'
    case 'circle':
      return '圆形范围'
    case 'polygon':
      return '多边形范围'
  }
})

function getRangeLabel(): string {
  if (!orchardStore.selectionRange) return ''
  return rangeTypeLabel.value
}

function setTool(tool: 'rectangle' | 'circle' | 'polygon') {
  if (activeTool.value === tool) {
    activeTool.value = null
    gisStore.deactivateTool()
    return
  }
  activeTool.value = tool

  // 激活Cesium绘制工具 (draw/volume/flood/profile/measure3d)
  gisStore.activateTool('draw')

  // 监听绘制完成事件
  setupDrawListener(tool)
}

function setupDrawListener(tool: 'rectangle' | 'circle' | 'polygon') {
  // 通过gisStore监听feature添加事件，在绘制完成后触发TSOM查询
  const stopWatch = watch(
    () => gisStore.features.size,
    (newSize, oldSize) => {
      if (newSize > oldSize) {
        const features = Array.from(gisStore.features.values())
        const latest = features[features.length - 1]
        if (latest) {
          const graphic = gisStore.graphics.get(latest.id)
          if (graphic) {
            const positions = graphic.getPositions()
            if (positions && positions.length > 0) {
              const Cesium = (window as any).Cesium
              const coordinates = positions.map((p: any) => {
                const carto = Cesium.Cartographic.fromCartesian(p)
                return [
                  Cesium.Math.toDegrees(carto.longitude),
                  Cesium.Math.toDegrees(carto.latitude),
                ]
              })

              if (tool === 'polygon' && coordinates.length > 0) {
                coordinates.push([...coordinates[0]])
              }

              orchardStore
                .setSelectionRange({
                  type: tool,
                  coordinates: tool === 'polygon' ? [coordinates] : coordinates,
                })
                .catch(() => ElMessage.error('查询失败，请重试'))

              ElMessage.success(`${getRangeLabel()}已选定，正在查询TSOM数据...`)
              stopWatch()
              activeTool.value = null
            }
          }
        }
      }
    },
  )
}

function clearSelection() {
  activeTool.value = null
  gisStore.deactivateTool()
  orchardStore.clearSelection()
  ElMessage.info('选择范围已清除')
}
</script>

<style scoped lang="scss">
.poi-draw-toolbar {
  position: absolute;
  left: 336px;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid $border-subtle;
  border-radius: 12px;
  z-index: $z-layer-5;
  pointer-events: auto;
}

.tool-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: $text-sub;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }

  &.active {
    background: rgba(251, 146, 60, 0.15);
    border-color: $orchard-orange;
    color: $orchard-orange;
  }
}

.clear-btn:hover {
  color: $alert-red !important;
  background: rgba(239, 68, 68, 0.1) !important;
}

.tool-divider {
  height: 1px;
  background: $border-subtle;
  margin: 4px 0;
}

.selection-info {
  padding: 6px 4px;
  text-align: center;

  .range-type {
    display: block;
    font-size: 10px;
    color: $orchard-orange;
    font-weight: 600;
  }

  .poi-count {
    display: block;
    font-size: 12px;
    color: $text-main;
    font-weight: 700;
    margin-top: 2px;
  }
}
</style>
