import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Overlay Store
 *
 * 管理Cesium场景上的HTML overlay显示状态
 */
export const useOverlayStore = defineStore('overlay', () => {
  // ========== State ==========

  /** 是否显示overlay */
  const visible = ref(false)

  /** 工具类型 */
  const toolType = ref<'volume' | 'measure3d' | 'profile' | 'flood' | null>(null)

  /** 屏幕坐标位置 */
  const screenPosition = ref<{ x: number; y: number } | null>(null)

  /** 结果数据 */
  const data = ref<any>(null)

  // ========== Actions ==========

  /**
   * 显示overlay
   */
  function showOverlay(options: {
    type: 'volume' | 'measure3d' | 'profile' | 'flood'
    position: { x: number; y: number }
    data: any
  }) {
    visible.value = true
    toolType.value = options.type
    screenPosition.value = options.position
    data.value = options.data
  }

  /**
   * 隐藏overlay
   */
  function hideOverlay() {
    visible.value = false
    // 延迟清理数据，等待动画完成
    setTimeout(() => {
      if (!visible.value) {
        toolType.value = null
        screenPosition.value = null
        data.value = null
      }
    }, 300)
  }

  /**
   * 更新位置
   */
  function updatePosition(position: { x: number; y: number }) {
    screenPosition.value = position
  }

  return {
    // State
    visible,
    toolType,
    screenPosition,
    data,

    // Actions
    showOverlay,
    hideOverlay,
    updatePosition,
  }
})
