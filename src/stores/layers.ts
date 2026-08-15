/**
 * Layer Store - Manages GIS layer configuration from backend
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/client'
import * as layersApi from '@/api/layers'
import type { LayerCreateInput, LayerUpdateInput } from '@/api/layers'

export interface LayerConfig {
  mapping?: {
    lng: string
    lat: string
    id: string
    name: string
  }
  labelField?: string
  autoFlyTo?: boolean
  pointStyle?: {
    color?: string
    pixelSize?: number
  }
  realtime?: {
    enabled: boolean
    type?: string
    updateFields?: string[]
  }
  responseKey?: string
  requestParams?: Record<string, unknown>
  alignment?: {
    longitude: number
    latitude: number
    height: number
    offsetEast?: number
    offsetNorth?: number
    offsetUp?: number
    rotationX: number
    rotationY: number
    rotationZ: number
    scale: number
  }
  alignmentEllipsoid?: {
    longitude: number
    latitude: number
    height: number
    offsetEast?: number
    offsetNorth?: number
    offsetUp?: number
    rotationX: number
    rotationY: number
    rotationZ: number
    scale: number
  }
  alignmentTerrain?: {
    longitude: number
    latitude: number
    height: number
    offsetEast?: number
    offsetNorth?: number
    offsetUp?: number
    rotationX: number
    rotationY: number
    rotationZ: number
    scale: number
  }
  ellipsoidOffset?: number
  terrainOffset?: number
  provider?: string
  // Point cloud specific configuration
  pointCloud?: {
    pointSize?: number
    maximumAttenuation?: number
    eyeDomeLighting?: boolean
    color?: string
    attenuation?: boolean
    maximumScreenSpaceError?: number
  }
}

export interface GISLayer {
  id: number
  code: string
  name: string
  group_name: string | null
  layer_type: string
  url: string | null
  is_visible: boolean
  is_enabled: boolean
  icon: string | null
  config: LayerConfig | null
  order: number
  description: string | null
}

export const useLayerStore = defineStore('layers', () => {
  // State
  const layers = ref<GISLayer[]>([])
  const activeLayerIds = ref<Set<number>>(new Set())
  const isLoading = ref(false)
  const lastError = ref<string | null>(null)
  /** 图层管理面板显隐 */
  const showManager = ref(false)

  // Getters
  const activeLayers = computed(() => 
    layers.value.filter(l => activeLayerIds.value.has(l.id))
  )

  const layersByGroup = computed(() => {
    const groups: Record<string, GISLayer[]> = {}
    layers.value.forEach(layer => {
      const group = layer.group_name || 'Other'
      if (!groups[group]) groups[group] = []
      groups[group].push(layer)
    })
    return groups
  })

  const getLayerByCode = (code: string) => 
    layers.value.find(l => l.code === code)

  // Actions
  async function fetchLayers() {
    isLoading.value = true
    lastError.value = null
    try {
      const response = await apiClient.get<GISLayer[]>('/layers')
      layers.value = response.data
      
      // Initialize active layers based on is_visible
      activeLayerIds.value = new Set(
        layers.value.filter(l => l.is_visible).map(l => l.id)
      )
    } catch (e) {
      console.error('[LayerStore] Failed to fetch layers:', e)
      lastError.value = 'Failed to load layer configuration'
    } finally {
      isLoading.value = false
    }
  }

  /** 把图层显隐状态 PATCH 到后端（fire-and-forget，失败只记日志） */
  function persistVisibility(layerId: number, visible: boolean) {
    layersApi.setLayerVisibility(layerId, visible).catch((err) => {
      console.error('[LayerStore] Failed to persist layer visibility:', err)
    })
  }

  function toggleLayer(layerId: number) {
    const nowActive = !activeLayerIds.value.has(layerId)
    if (nowActive) {
      activeLayerIds.value.add(layerId)
    } else {
      activeLayerIds.value.delete(layerId)
    }
    // Force reactivity
    activeLayerIds.value = new Set(activeLayerIds.value)
    persistVisibility(layerId, nowActive)
  }

  function setLayerActive(layerId: number, active: boolean) {
    if (active) {
      activeLayerIds.value.add(layerId)
    } else {
      activeLayerIds.value.delete(layerId)
    }
    activeLayerIds.value = new Set(activeLayerIds.value)
    persistVisibility(layerId, active)
  }

  function toggleManager() {
    showManager.value = !showManager.value
  }

  // ---- CRUD（调后端 /layers） ----
  async function createLayer(data: LayerCreateInput) {
    const res = await layersApi.createLayer(data)
    await fetchLayers()
    return res.data
  }

  async function updateLayer(id: number, data: LayerUpdateInput) {
    const res = await layersApi.updateLayer(id, data)
    await fetchLayers()
    return res.data
  }

  async function deleteLayer(id: number) {
    await layersApi.deleteLayer(id)
    await fetchLayers()
  }

  function isLayerActive(layerId: number): boolean {
    return activeLayerIds.value.has(layerId)
  }

  function isLayerActiveByCode(code: string): boolean {
    const layer = getLayerByCode(code)
    return layer ? activeLayerIds.value.has(layer.id) : false
  }

  return {
    // State
    layers,
    activeLayerIds,
    isLoading,
    lastError,
    showManager,
    // Getters
    activeLayers,
    layersByGroup,
    getLayerByCode,
    // Actions
    fetchLayers,
    toggleLayer,
    setLayerActive,
    isLayerActive,
    isLayerActiveByCode,
    toggleManager,
    createLayer,
    updateLayer,
    deleteLayer,
  }
})
