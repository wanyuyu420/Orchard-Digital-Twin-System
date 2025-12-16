// GIS 绘制状态管理

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DrawToolType, DrawingState } from '@/types/draw'

export const useDrawStore = defineStore('draw', () => {
  // 激活的工具
  const activeTool = ref<DrawToolType>(null)

  // 绘制状态
  const isDrawing = ref(false)
  const isEditing = ref(false)
  const currentFeatureId = ref<string | null>(null)

  // 捕捉设置
  const snapEnabled = ref(true)
  const snapTolerance = ref(10) // 像素

  // 计算属性：绘制状态（完整实现新的 DrawingState 接口）
  const drawingState = computed<DrawingState>(() => ({
    activeTool: activeTool.value,
    mode: isDrawing.value ? 'drawing' : isEditing.value ? 'editing' : 'none',
    isDrawing: isDrawing.value,
    isEditing: isEditing.value,
    currentFeatureId: currentFeatureId.value,
    snapEnabled: snapEnabled.value,
    snapTolerance: snapTolerance.value,
    showTips: true,
    tipText: '',
    continuousMode: false,
  }))

  // 计算属性：是否有激活工具
  const hasActiveTool = computed(() => activeTool.value !== null)

  // 设置激活工具
  function setTool(tool: DrawToolType) {
    // 如果点击同一个工具，则停用
    if (activeTool.value === tool) {
      activeTool.value = null
      isDrawing.value = false
    } else {
      activeTool.value = tool
      isDrawing.value = false
    }

    // 切换工具时退出编辑模式
    if (tool !== null) {
      exitEditMode()
    }
  }

  // 开始绘制
  function startDrawing() {
    if (activeTool.value) {
      isDrawing.value = true
    }
  }

  // 完成绘制
  function finishDrawing() {
    isDrawing.value = false
  }

  // 取消绘制
  function cancelDrawing() {
    isDrawing.value = false
    // 不清空 activeTool，允许继续绘制下一个
  }

  // 进入编辑模式
  function enterEditMode(featureId: string) {
    isEditing.value = true
    currentFeatureId.value = featureId
    // 进入编辑模式时停用绘制工具
    activeTool.value = null
  }

  // 退出编辑模式
  function exitEditMode() {
    isEditing.value = false
    currentFeatureId.value = null
  }

  // 设置捕捉开关
  function setSnapEnabled(enabled: boolean) {
    snapEnabled.value = enabled
  }

  // 设置捕捉容差
  function setSnapTolerance(tolerance: number) {
    snapTolerance.value = Math.max(5, Math.min(20, tolerance))
  }

  // 重置所有状态
  function reset() {
    activeTool.value = null
    isDrawing.value = false
    isEditing.value = false
    currentFeatureId.value = null
  }

  return {
    // State
    activeTool,
    isDrawing,
    isEditing,
    currentFeatureId,
    snapEnabled,
    snapTolerance,

    // Computed
    drawingState,
    hasActiveTool,

    // Actions
    setTool,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    enterEditMode,
    exitEditMode,
    setSnapEnabled,
    setSnapTolerance,
    reset,
  }
})
