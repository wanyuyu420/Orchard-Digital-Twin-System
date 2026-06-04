import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FlattenRegion } from '@/cesium/gis/tools/TilesetFlatten'

/**
 * Flatten Store - 压平功能状态管理
 */
export const useFlattenStore = defineStore('flatten', () => {
  // 状态
  const enabled = ref(false)
  const isDrawing = ref(false)
  const flatHeight = ref(-10)
  const regions = ref<FlattenRegion[]>([])
  const activeRegionId = ref<string | null>(null)

  // 计算属性
  const regionCount = computed(() => regions.value.length)
  const hasRegions = computed(() => regions.value.length > 0)

  // Actions
  function setEnabled(value: boolean) {
    enabled.value = value
  }

  function setDrawing(value: boolean) {
    isDrawing.value = value
  }

  function setFlatHeight(height: number) {
    flatHeight.value = height
  }

  function addRegion(region: FlattenRegion) {
    regions.value.push(region)
  }

  function removeRegion(id: string) {
    regions.value = regions.value.filter((r) => r.id !== id)
    if (activeRegionId.value === id) {
      activeRegionId.value = null
    }
  }

  function clearRegions() {
    regions.value = []
    activeRegionId.value = null
  }

  function setActiveRegion(id: string | null) {
    activeRegionId.value = id
  }

  function syncRegions(newRegions: FlattenRegion[]) {
    regions.value = [...newRegions]
  }

  function $reset() {
    enabled.value = false
    isDrawing.value = false
    flatHeight.value = -10
    regions.value = []
    activeRegionId.value = null
  }

  return {
    // State
    enabled,
    isDrawing,
    flatHeight,
    regions,
    activeRegionId,
    // Computed
    regionCount,
    hasRegions,
    // Actions
    setEnabled,
    setDrawing,
    setFlatHeight,
    addRegion,
    removeRegion,
    clearRegions,
    setActiveRegion,
    syncRegions,
    $reset,
  }
})
