/**
 * Unified GIS Store
 *
 * 统一的 GIS 状态管理，整合：
 * - 绘制工具 (Draw)
 * - 要素管理 (Feature)
 * - 测量工具 (Measure)
 *
 * 设计目标：
 * 1. 统一管理所有 GIS 交互工具
 * 2. 统一管理要素和图形的映射关系
 * 3. 提供向后兼容的 API（兼容现有 useMeasureStore）
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import * as Cesium from 'cesium'

// Types
import type { AnalysisResult } from '@/types/analysis'
import type { BaseTool, ToolType } from '@/cesium/gis/core/BaseTool'
import type { BaseGraphic } from '@/cesium/gis/core/BaseGraphic'
import type { DrawMode, DrawToolType } from '@/types/draw'
import type { Feature, FeatureGraphicMap, FeatureFilter } from '@/types/feature'
import type { MeasureToolType, Measurement } from '@/types/measure'

// Note: GISState interface removed as it's not currently used
// State is managed through individual refs below

// ========== History Types ==========

/** Action types for undo/redo */
export type HistoryActionType =
  | 'add' // Feature added
  | 'remove' // Feature removed
  | 'update' // Feature properties updated
  | 'move' // Feature moved (geometry changed)
  | 'style' // Feature style changed
  | 'batch' // Multiple actions bundled

/** History record for undo/redo */
export interface HistoryRecord {
  id: string
  timestamp: Date
  actionType: HistoryActionType
  featureId: string
  /** Snapshot of feature before the action (for undo) */
  beforeState: Feature | null
  /** Snapshot of feature after the action (for redo) */
  afterState: Feature | null
  /** For batch actions, contains sub-actions */
  subActions?: HistoryRecord[]
}

/** Maximum history stack size */
const MAX_HISTORY_SIZE = 50

// ========== Analysis Results Types ==========
// Types imported from @/types/analysis.ts

export const useGISStore = defineStore('gis', () => {
  // ========== Core State ==========

  /** Cesium Viewer instance */
  const viewer = shallowRef<Cesium.Viewer | null>(null)

  /** Current active tool */
  const currentTool = shallowRef<BaseTool | null>(null)

  /** Current tool type */
  const toolType = ref<ToolType | null>(null)

  /** Current drawing/editing mode */
  const mode = ref<DrawMode>('none')

  // ========== Feature Management ==========

  /** All features (id -> Feature) */
  const features = ref<Map<string, Feature>>(new Map())

  /** All graphics (featureId -> BaseGraphic) */
  const graphics = ref<Map<string, BaseGraphic>>(new Map())

  /** Feature-Graphic mappings */
  const featureGraphicMaps = ref<Map<string, FeatureGraphicMap>>(new Map())

  /** Selected feature IDs */
  const selectedFeatureIds = ref<Set<string>>(new Set())

  /** Highlighted feature ID (hover) */
  const highlightedFeatureId = ref<string | null>(null)

  // ========== Measurement (Backward Compatibility) ==========

  /** Measurement history */
  const measurements = ref<Measurement[]>([])

  // ========== Settings ==========

  /** Enable snapping */
  const snapEnabled = ref(true)

  /** Snap tolerance (pixels) */
  const snapTolerance = ref(10)

  /** Show tips */
  const showTips = ref(true)

  /** Continuous drawing mode */
  const continuousMode = ref(false)

  /** Drawing style configuration */
  const drawStyle = ref({
    strokeColor: '#22D3EE',
    strokeWidth: 3,
    fillColor: '#3B82F6',
    fillOpacity: 0.3,
    lineType: 'solid' as 'solid' | 'dashed' | 'dotted',
    pointColor: '#22D3EE',
    pointSize: 10,
    iconType: 'dot' as 'dot' | 'pin' | 'diamond' | 'star' | 'camera' | 'wifi',
    centerIcon: undefined as string | undefined, // For polygon center icon
  })

  /** Per-tool style configuration (persisted to localStorage) */
  interface ToolStyleConfig {
    strokeColor?: string
    strokeWidth?: number
    fillColor?: string
    fillOpacity?: number
    lineType?: 'solid' | 'dashed' | 'dotted'
    pointColor?: string
    pointSize?: number
    iconType?: 'dot' | 'pin' | 'diamond' | 'star' | 'camera' | 'wifi' // for point tools
    centerIcon?: string
  }

  interface ToolStyles {
    'draw-point': ToolStyleConfig
    'draw-line': ToolStyleConfig
    'draw-polygon': ToolStyleConfig
    'draw-circle': ToolStyleConfig
    'draw-rectangle': ToolStyleConfig
    'measure-distance': ToolStyleConfig // measurement tool
    'measure-area': ToolStyleConfig // measurement tool
  }

  /** Default tool styles */
  const DEFAULT_TOOL_STYLES: ToolStyles = {
    'draw-point': {
      pointColor: '#22D3EE',
      pointSize: 12,
      strokeColor: '#FFFFFF',
      strokeWidth: 2,
      iconType: 'dot',
    },
    'draw-line': {
      strokeColor: '#22D3EE',
      strokeWidth: 3,
      lineType: 'solid',
    },
    'draw-polygon': {
      fillColor: '#3B82F6',
      fillOpacity: 0.3,
      strokeColor: '#22D3EE',
      strokeWidth: 3,
    },
    'draw-circle': {
      fillColor: '#10B981',
      fillOpacity: 0.3,
      strokeColor: '#059669',
      strokeWidth: 3,
    },
    'draw-rectangle': {
      fillColor: '#F59E0B',
      fillOpacity: 0.3,
      strokeColor: '#D97706',
      strokeWidth: 3,
    },
    'measure-distance': {
      strokeColor: '#EF4444',
      strokeWidth: 2,
    },
    'measure-area': {
      fillColor: '#8B5CF6',
      fillOpacity: 0.3,
      strokeColor: '#7C3AED',
      strokeWidth: 2,
    },
  }

  /**
   * Load tool styles from localStorage
   */
  function loadToolStylesFromStorage(): ToolStyles {
    try {
      const stored = localStorage.getItem('gis-tool-styles')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to ensure all tools have styles
        return {
          ...DEFAULT_TOOL_STYLES,
          ...parsed,
        }
      }
    } catch (err) {
      console.warn('Failed to load tool styles from localStorage:', err)
    }
    return { ...DEFAULT_TOOL_STYLES }
  }

  /**
   * Save tool styles to localStorage
   */
  function saveToolStylesToStorage(styles: ToolStyles): void {
    try {
      localStorage.setItem('gis-tool-styles', JSON.stringify(styles))
    } catch (err) {
      console.warn('Failed to save tool styles to localStorage:', err)
    }
  }

  /** Tool-specific styles (loaded from localStorage on init) */
  const toolStyles = ref<ToolStyles>(loadToolStylesFromStorage())

  // ========== 3D分析结果管理 ==========
  const analysisResults = ref<AnalysisResult[]>([])
  const selectedResultId = ref<string | null>(null)

  // ========== Analysis Results (for UI Panel) ==========

  /** Current analysis result type */
  const analysisResultType = ref<'volume' | 'measure3d' | 'profile' | null>(null)

  /** Current analysis result data */
  const analysisResultData = ref<any>(null)

  // ========== History State (Undo/Redo) ==========

  /** History stack for undo/redo operations */
  const historyStack = ref<HistoryRecord[]>([])

  /** Current position in history stack (-1 means at latest) */
  const historyIndex = ref(-1)

  /** Flag to temporarily disable history recording (during undo/redo) */
  let isUndoRedoInProgress = false

  // ========== Computed Properties ==========

  /** Is any tool active */
  const isActive = computed(() => currentTool.value !== null)

  /** Is drawing */
  const isDrawing = computed(() => mode.value === 'drawing')

  /** Is editing */
  const isEditing = computed(() => mode.value === 'editing')

  /** Feature count */
  const featureCount = computed(() => features.value.size)

  /** Selected feature count */
  const selectedCount = computed(() => selectedFeatureIds.value.size)

  /** All features as array */
  const featuresArray = computed(() => Array.from(features.value.values()))

  /** Selected features as array */
  const selectedFeatures = computed(() => {
    return Array.from(selectedFeatureIds.value)
      .map((id) => features.value.get(id))
      .filter(Boolean) as Feature[]
  })

  /** Measurement count (for backward compatibility) */
  const measurementCount = computed(() => measurements.value.length)

  /** Active tool (backward compatibility alias for toolType) */
  const activeTool = computed(() => toolType.value)

  /** Can undo (has history to go back to) */
  const canUndo = computed(() => {
    if (historyIndex.value === -1) {
      // At latest state, can undo if there's any history
      return historyStack.value.length > 0
    }
    // Not at latest, can undo if not at the beginning
    return historyIndex.value > 0
  })

  /** Can redo (has future states to restore) */
  const canRedo = computed(() => {
    // Can redo if historyIndex is not -1 (meaning we've undone something)
    return historyIndex.value !== -1 && historyIndex.value < historyStack.value.length - 1
  })

  /** History length */
  const historyLength = computed(() => historyStack.value.length)

  // ========== Tool Management Actions ==========

  /**
   * Set Cesium Viewer
   */
  function setViewer(cesiumViewer: Cesium.Viewer) {
    viewer.value = cesiumViewer
  }

  /**
   * Activate a tool
   * @param tool - Tool instance
   */
  function activateTool(tool: BaseTool) {
    // Deactivate current tool
    if (currentTool.value) {
      currentTool.value.deactivate()
    }

    // Activate new tool
    currentTool.value = tool
    toolType.value = tool.getType()
    mode.value = 'drawing'

    tool.activate()
  }

  /**
   * Deactivate current tool
   */
  function deactivateTool() {
    if (currentTool.value) {
      currentTool.value.deactivate()
      currentTool.value = null
    }
    // Always reset toolType and mode, even if no tool is active
    toolType.value = null
    mode.value = 'none'
  }

  /**
   * Set tool by type (backward compatibility)
   * @param type - Tool type or null
   */
  function setTool(type: ToolType | DrawToolType | MeasureToolType | null) {
    if (type === null) {
      deactivateTool()
    } else {
      toolType.value = type as ToolType
      // Note: Actual tool instantiation happens in the component layer
      // This is just for state tracking
    }
  }

  // ========== Feature Management Actions ==========

  /**
   * Add a feature
   * @param feature - Feature data
   * @param graphic - Associated graphic
   * @param skipHistory - Skip recording to history (internal use)
   */
  function addFeature(feature: Feature, graphic: BaseGraphic, skipHistory = false) {
    features.value.set(feature.id, feature)
    graphics.value.set(feature.id, graphic)

    const map: FeatureGraphicMap = {
      featureId: feature.id,
      feature: feature,
      graphic: graphic,
    }
    featureGraphicMaps.value.set(feature.id, map)

    // Record to history
    if (!skipHistory) {
      recordHistory('add', feature.id, null, feature)
    }
  }

  /**
   * Remove a feature
   * @param featureId - Feature ID
   * @param skipHistory - Skip recording to history (internal use)
   */
  function removeFeature(featureId: string, skipHistory = false) {
    // Get feature before removing for history
    const feature = features.value.get(featureId)

    // Record to history before deletion
    if (!skipHistory && feature) {
      recordHistory('remove', featureId, feature, null)
    }

    const graphic = graphics.value.get(featureId)
    if (graphic) {
      graphic.destroy()
      graphics.value.delete(featureId)
    }

    features.value.delete(featureId)
    featureGraphicMaps.value.delete(featureId)
    selectedFeatureIds.value.delete(featureId)

    if (highlightedFeatureId.value === featureId) {
      highlightedFeatureId.value = null
    }
  }

  /**
   * Update feature
   * @param featureId - Feature ID
   * @param updates - Partial feature updates
   * @param actionType - Type of action for history (default: 'update')
   * @param skipHistory - Skip recording to history (internal use)
   */
  function updateFeature(
    featureId: string,
    updates: Partial<Feature>,
    actionType: HistoryActionType = 'update',
    skipHistory = false
  ) {
    const feature = features.value.get(featureId)
    if (feature) {
      // Clone before state for history
      const beforeState = !skipHistory ? deepCloneFeature(feature) : null

      // Apply updates
      Object.assign(feature, updates)
      feature.updatedAt = new Date()

      // Record to history
      if (!skipHistory && beforeState) {
        recordHistory(actionType, featureId, beforeState, feature)
      }
    }
  }

  /**
   * Get feature by ID
   * @param featureId - Feature ID
   */
  function getFeature(featureId: string): Feature | undefined {
    return features.value.get(featureId)
  }

  /**
   * Get graphic by feature ID
   * @param featureId - Feature ID
   */
  function getGraphic(featureId: string): BaseGraphic | undefined {
    return graphics.value.get(featureId)
  }

  /**
   * Clear all features
   */
  function clearFeatures() {
    graphics.value.forEach((graphic) => graphic.destroy())

    features.value.clear()
    graphics.value.clear()
    featureGraphicMaps.value.clear()
    selectedFeatureIds.value.clear()
    highlightedFeatureId.value = null
  }

  /**
   * Filter features
   * @param filter - Filter conditions
   */
  function filterFeatures(filter: FeatureFilter): Feature[] {
    let result = Array.from(features.value.values())

    if (filter.types && filter.types.length > 0) {
      result = result.filter((f) => filter.types!.includes(f.type))
    }

    if (filter.visible !== undefined) {
      result = result.filter((f) => f.visible === filter.visible)
    }

    if (filter.createdAfter) {
      result = result.filter((f) => f.createdAt >= filter.createdAfter!)
    }

    if (filter.createdBefore) {
      result = result.filter((f) => f.createdAt <= filter.createdBefore!)
    }

    if (filter.nameContains) {
      const query = filter.nameContains.toLowerCase()
      result = result.filter((f) => f.name.toLowerCase().includes(query))
    }

    return result
  }

  // ========== Selection Actions ==========

  /**
   * Select feature(s)
   * @param featureIds - Feature ID(s) to select
   * @param multi - Allow multi-selection
   */
  function selectFeature(featureIds: string | string[], multi: boolean = false) {
    const ids = Array.isArray(featureIds) ? featureIds : [featureIds]

    if (!multi) {
      selectedFeatureIds.value.clear()
    }

    ids.forEach((id) => {
      if (features.value.has(id)) {
        selectedFeatureIds.value.add(id)
      }
    })
  }

  /**
   * Deselect feature(s)
   * @param featureIds - Feature ID(s) to deselect (if not provided, deselect all)
   */
  function deselectFeature(featureIds?: string | string[]) {
    if (!featureIds) {
      selectedFeatureIds.value.clear()
      return
    }

    const ids = Array.isArray(featureIds) ? featureIds : [featureIds]
    ids.forEach((id) => selectedFeatureIds.value.delete(id))
  }

  /**
   * Toggle feature selection
   * @param featureId - Feature ID
   */
  function toggleSelection(featureId: string) {
    if (selectedFeatureIds.value.has(featureId)) {
      selectedFeatureIds.value.delete(featureId)
    } else if (features.value.has(featureId)) {
      selectedFeatureIds.value.add(featureId)
    }
  }

  /**
   * Highlight feature (hover)
   * @param featureId - Feature ID or null
   */
  function highlightFeature(featureId: string | null) {
    highlightedFeatureId.value = featureId
  }

  // ========== Measurement Actions (Backward Compatibility) ==========

  /**
   * Add measurement
   * @param measurement - Measurement data
   */
  function addMeasurement(measurement: Measurement) {
    measurements.value.push(measurement)
  }

  /**
   * Remove measurement
   * @param id - Measurement ID
   */
  function removeMeasurement(id: string) {
    const index = measurements.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      measurements.value.splice(index, 1)
    }
  }

  /**
   * Clear all measurements
   */
  function clearMeasurements() {
    measurements.value = []
  }

  /**
   * Clear all (backward compatibility alias for clearMeasurements)
   */
  function clearAll() {
    clearMeasurements()
  }

  // ========== Mode Actions ==========

  /**
   * Start drawing
   * @param toolType - Optional tool type to activate
   */
  function startDrawing(toolTypeParam?: string) {
    mode.value = 'drawing'
    if (toolTypeParam) {
      toolType.value = toolTypeParam as ToolType
    }
  }

  /**
   * Finish drawing
   */
  function finishDrawing() {
    if (!continuousMode.value) {
      mode.value = 'none'
    }
    // In continuous mode, stay in drawing mode
  }

  /**
   * Cancel drawing
   */
  function cancelDrawing() {
    mode.value = 'none'
  }

  /**
   * Stop drawing (convenience alias for deactivateTool)
   * Used by UI components like TopMenuBar to toggle drawing off
   */
  function stopDrawing() {
    deactivateTool()
  }

  /**
   * Enter edit mode
   * @param featureId - Feature ID to edit
   */
  function enterEditMode(featureId: string) {
    if (features.value.has(featureId)) {
      mode.value = 'editing'
      selectFeature(featureId)
    }
  }

  /**
   * Exit edit mode
   */
  function exitEditMode() {
    mode.value = 'none'
  }

  // ========== Import/Export Actions ==========

  /**
   * Convert internal feature to GeoJSON geometry
   */
  function featureToGeoJSONGeometry(feature: Feature): { type: string; coordinates: any } | null {
    switch (feature.type) {
      case 'point':
        return {
          type: 'Point',
          coordinates: [
            feature.position.longitude,
            feature.position.latitude,
            (feature.position as any).height || 0,
          ],
        }
      case 'line':
      case 'distance':
        const lineCoords =
          feature.type === 'line'
            ? feature.vertices.map((v) => [v.longitude, v.latitude, (v as any).height || 0])
            : [
                [feature.startPoint.longitude, feature.startPoint.latitude],
                [feature.endPoint.longitude, feature.endPoint.latitude],
              ]
        return {
          type: 'LineString',
          coordinates: lineCoords,
        }
      case 'polygon':
      case 'area':
        // GeoJSON polygon requires first and last point to be the same
        const polyCoords = feature.vertices.map((v) => [
          v.longitude,
          v.latitude,
          (v as any).height || 0,
        ])
        if (polyCoords.length > 0) {
          polyCoords.push(polyCoords[0]) // Close the ring
        }
        return {
          type: 'Polygon',
          coordinates: [polyCoords],
        }
      case 'circle':
        // GeoJSON doesn't have a native circle type, export as Point with radius in properties
        return {
          type: 'Point',
          coordinates: [
            feature.center.longitude,
            feature.center.latitude,
            (feature.center as any).height || 0,
          ],
        }
      case 'rectangle':
        // Export rectangle as Polygon
        const sw = feature.southwest
        const ne = feature.northeast
        const rectCoords = [
          [sw.longitude, sw.latitude],
          [ne.longitude, sw.latitude],
          [ne.longitude, ne.latitude],
          [sw.longitude, ne.latitude],
          [sw.longitude, sw.latitude], // Close the ring
        ]
        return {
          type: 'Polygon',
          coordinates: [rectCoords],
        }
      default:
        return null
    }
  }

  /**
   * Export all features as GeoJSON
   * @param selectedOnly - Only export selected features
   * @returns GeoJSON FeatureCollection as string
   */
  function exportGeoJSON(selectedOnly = false): string {
    const featuresToExport = selectedOnly
      ? Array.from(features.value.values()).filter((f) => selectedFeatureIds.value.has(f.id))
      : Array.from(features.value.values())

    const geojsonFeatures = featuresToExport.map((feature) => {
      const geometry = featureToGeoJSONGeometry(feature)
      return {
        type: 'Feature',
        id: feature.id,
        geometry,
        properties: {
          name: feature.name,
          featureType: feature.type, // Use featureType to avoid conflict with GeoJSON type
          description: feature.description,
          ...feature.properties,
          style: feature.style,
          createdAt: feature.createdAt?.toISOString(),
          // Special properties for circle/rectangle
          ...(feature.type === 'circle' ? { radius: feature.radius, area: feature.area } : {}),
          ...(feature.type === 'rectangle'
            ? { width: feature.width, height: feature.height, area: feature.area }
            : {}),
          ...(feature.type === 'line' ? { length: feature.length } : {}),
          ...(feature.type === 'polygon'
            ? { area: feature.area, perimeter: feature.perimeter }
            : {}),
        },
      }
    })

    const featureCollection = {
      type: 'FeatureCollection',
      features: geojsonFeatures,
      metadata: {
        exportedAt: new Date().toISOString(),
        featureCount: geojsonFeatures.length,
        source: 'water-digital-twin-platform',
      },
    }

    return JSON.stringify(featureCollection, null, 2)
  }

  /**
   * Import features from GeoJSON string
   * @param geojsonStr - GeoJSON string
   * @returns Number of features imported
   */
  function importGeoJSON(geojsonStr: string): { success: number; errors: string[] } {
    const errors: string[] = []
    let successCount = 0

    try {
      const geojson = JSON.parse(geojsonStr)

      if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature') {
        errors.push('Invalid GeoJSON: must be FeatureCollection or Feature')
        return { success: 0, errors }
      }

      const featuresToImport = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]

      for (const geoFeature of featuresToImport) {
        try {
          const feature = geoJSONToFeature(geoFeature)
          if (feature) {
            features.value.set(feature.id, feature)
            successCount++
          }
        } catch (err) {
          errors.push(`Failed to import feature: ${(err as Error).message}`)
        }
      }
    } catch (err) {
      errors.push(`Invalid JSON: ${(err as Error).message}`)
    }

    return { success: successCount, errors }
  }

  /**
   * Convert GeoJSON feature to internal Feature
   */
  function geoJSONToFeature(geoFeature: any): Feature | null {
    const { geometry, properties = {} } = geoFeature
    if (!geometry) return null

    const id = geoFeature.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()
    const baseProps = {
      id,
      name: properties.name || `导入要素 ${id.substring(0, 8)}`,
      description: properties.description,
      createdAt: properties.createdAt ? new Date(properties.createdAt) : now,
      updatedAt: now,
      style: properties.style || {},
      properties: { ...properties },
      visible: true,
    }

    // Determine feature type from properties or geometry
    const featureType = properties.featureType || properties.type

    switch (geometry.type) {
      case 'Point':
        const [pLng, pLat, pHeight = 0] = geometry.coordinates
        // Check if it's a circle (has radius property)
        if (featureType === 'circle' || properties.radius) {
          return {
            ...baseProps,
            type: 'circle',
            center: { longitude: pLng, latitude: pLat, height: pHeight },
            radius: properties.radius || 100,
            area: properties.area || Math.PI * Math.pow(properties.radius || 100, 2),
          } as any
        }
        return {
          ...baseProps,
          type: 'point',
          position: { longitude: pLng, latitude: pLat, height: pHeight },
          icon: properties.icon,
          label: properties.label,
        } as any

      case 'LineString':
        const lineVertices = geometry.coordinates.map((coord: number[]) => ({
          longitude: coord[0],
          latitude: coord[1],
          height: coord[2] || 0,
        }))
        return {
          ...baseProps,
          type: 'line',
          vertices: lineVertices,
          length: properties.length || 0,
          lineType: 'solid',
        } as any

      case 'Polygon':
        const ring = geometry.coordinates[0] || []
        // Remove closing point if present
        const polyVertices = ring.slice(0, -1).map((coord: number[]) => ({
          longitude: coord[0],
          latitude: coord[1],
          height: coord[2] || 0,
        }))

        // Check if it's a rectangle
        if (
          featureType === 'rectangle' ||
          (polyVertices.length === 4 && properties.width && properties.height)
        ) {
          // Find southwest and northeast
          const lngs = polyVertices.map((v: any) => v.longitude)
          const lats = polyVertices.map((v: any) => v.latitude)
          return {
            ...baseProps,
            type: 'rectangle',
            southwest: { longitude: Math.min(...lngs), latitude: Math.min(...lats) },
            northeast: { longitude: Math.max(...lngs), latitude: Math.max(...lats) },
            width: properties.width || 0,
            height: properties.height || 0,
            area: properties.area || 0,
          } as any
        }

        return {
          ...baseProps,
          type: 'polygon',
          vertices: polyVertices,
          area: properties.area || 0,
          perimeter: properties.perimeter,
        } as any

      default:
        console.warn(`Unsupported geometry type: ${geometry.type}`)
        return null
    }
  }

  // ========== Settings Actions ==========

  /**
   * Set snap enabled
   * @param enabled - Enable snapping
   */
  function setSnapEnabled(enabled: boolean) {
    snapEnabled.value = enabled
  }

  /**
   * Set snap tolerance
   * @param tolerance - Snap tolerance in pixels
   */
  function setSnapTolerance(tolerance: number) {
    snapTolerance.value = Math.max(5, Math.min(20, tolerance))
  }

  /**
   * Set show tips
   * @param show - Show tips
   */
  function setShowTips(show: boolean) {
    showTips.value = show
  }

  /**
   * Set continuous mode
   * @param continuous - Enable continuous drawing
   */
  function setContinuousMode(continuous: boolean) {
    continuousMode.value = continuous
  }

  // ========== History Management (Undo/Redo) ==========

  /**
   * Deep clone a feature for history storage
   * @param feature - Feature to clone
   */
  function deepCloneFeature(feature: Feature): Feature {
    return JSON.parse(JSON.stringify(feature))
  }

  /**
   * Record an action to history stack
   * @param actionType - Type of action
   * @param featureId - ID of affected feature
   * @param beforeState - Feature state before action
   * @param afterState - Feature state after action
   */
  function recordHistory(
    actionType: HistoryActionType,
    featureId: string,
    beforeState: Feature | null,
    afterState: Feature | null
  ): void {
    // Skip if undo/redo is in progress
    if (isUndoRedoInProgress) return

    const record: HistoryRecord = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      actionType,
      featureId,
      beforeState: beforeState ? deepCloneFeature(beforeState) : null,
      afterState: afterState ? deepCloneFeature(afterState) : null,
    }

    // If we're not at the latest state, truncate future history
    if (historyIndex.value !== -1) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
      historyIndex.value = -1
    }

    // Add new record
    historyStack.value.push(record)

    // Limit history size
    if (historyStack.value.length > MAX_HISTORY_SIZE) {
      historyStack.value.shift()
    }
  }

  /**
   * Undo the last action
   * @returns true if undo was successful
   */
  function undo(): boolean {
    if (!canUndo.value) return false

    isUndoRedoInProgress = true

    try {
      // Determine which record to undo
      let recordIndex: number
      if (historyIndex.value === -1) {
        // At latest state, undo the last record
        recordIndex = historyStack.value.length - 1
        historyIndex.value = recordIndex
      } else {
        // Already undone some, undo the current position and move back
        recordIndex = historyIndex.value
        historyIndex.value = recordIndex - 1
      }

      const record = historyStack.value[recordIndex]
      if (!record) return false

      // Apply the undo based on action type
      switch (record.actionType) {
        case 'add':
          // Undo add = remove the feature (but keep in history)
          if (record.featureId) {
            const graphic = graphics.value.get(record.featureId)
            if (graphic) {
              graphic.destroy()
              graphics.value.delete(record.featureId)
            }
            features.value.delete(record.featureId)
            featureGraphicMaps.value.delete(record.featureId)
            selectedFeatureIds.value.delete(record.featureId)
          }
          break

        case 'remove':
          // Undo remove = restore the feature
          if (record.beforeState) {
            features.value.set(record.featureId, deepCloneFeature(record.beforeState))
            // Note: Graphic needs to be recreated by the component layer
            // We emit an event or set a flag for this
          }
          break

        case 'update':
        case 'move':
        case 'style':
          // Undo update/move/style = restore previous state
          if (record.beforeState) {
            const feature = features.value.get(record.featureId)
            if (feature) {
              Object.assign(feature, deepCloneFeature(record.beforeState))
            }
          }
          break

        case 'batch':
          // Undo batch = undo all sub-actions in reverse order
          if (record.subActions) {
            for (let i = record.subActions.length - 1; i >= 0; i--) {
              // Recursively handle sub-actions (simplified - apply beforeState)
              const sub = record.subActions[i]
              if (sub.beforeState && sub.featureId) {
                const feature = features.value.get(sub.featureId)
                if (feature) {
                  Object.assign(feature, deepCloneFeature(sub.beforeState))
                }
              }
            }
          }
          break
      }

      console.log('Undo:', record.actionType, record.featureId)
      return true
    } finally {
      isUndoRedoInProgress = false
    }
  }

  /**
   * Redo an undone action
   * @returns true if redo was successful
   */
  function redo(): boolean {
    if (!canRedo.value) return false

    isUndoRedoInProgress = true

    try {
      // Move forward in history
      const recordIndex = historyIndex.value + 1
      const record = historyStack.value[recordIndex]
      if (!record) return false

      // Update index
      if (recordIndex === historyStack.value.length - 1) {
        // Back at latest state
        historyIndex.value = -1
      } else {
        historyIndex.value = recordIndex
      }

      // Apply the redo based on action type
      switch (record.actionType) {
        case 'add':
          // Redo add = restore the feature
          if (record.afterState) {
            features.value.set(record.featureId, deepCloneFeature(record.afterState))
            // Note: Graphic needs to be recreated by the component layer
          }
          break

        case 'remove':
          // Redo remove = remove the feature again
          if (record.featureId) {
            const graphic = graphics.value.get(record.featureId)
            if (graphic) {
              graphic.destroy()
              graphics.value.delete(record.featureId)
            }
            features.value.delete(record.featureId)
            featureGraphicMaps.value.delete(record.featureId)
            selectedFeatureIds.value.delete(record.featureId)
          }
          break

        case 'update':
        case 'move':
        case 'style':
          // Redo update/move/style = apply the after state
          if (record.afterState) {
            const feature = features.value.get(record.featureId)
            if (feature) {
              Object.assign(feature, deepCloneFeature(record.afterState))
            }
          }
          break

        case 'batch':
          // Redo batch = redo all sub-actions in order
          if (record.subActions) {
            for (const sub of record.subActions) {
              if (sub.afterState && sub.featureId) {
                const feature = features.value.get(sub.featureId)
                if (feature) {
                  Object.assign(feature, deepCloneFeature(sub.afterState))
                }
              }
            }
          }
          break
      }

      console.log('Redo:', record.actionType, record.featureId)
      return true
    } finally {
      isUndoRedoInProgress = false
    }
  }

  /**
   * Clear history stack
   */
  function clearHistory(): void {
    historyStack.value = []
    historyIndex.value = -1
  }

  /**
   * Get history for display (optional UI feature)
   */
  function getHistory(): HistoryRecord[] {
    return historyStack.value
  }

  // ========== Reset Actions ==========

  /**
   * Reset all state
   */
  function reset() {
    deactivateTool()
    clearFeatures()
    clearMeasurements()
    mode.value = 'none'
  }

  /**
   * Reset drawing state only
   */
  function resetDrawing() {
    mode.value = 'none'
  }

  // ========== Tool Style Management ==========

  /**
   * Get style configuration for a specific tool
   * @param toolType - Tool type (point, line, polygon, circle, rectangle, distance, area)
   * @returns Tool style configuration
   */
  function getToolStyle(toolType: keyof ToolStyles): ToolStyleConfig {
    return { ...toolStyles.value[toolType] }
  }

  /**
   * Update style configuration for a specific tool
   * @param toolType - Tool type
   * @param style - Partial style update
   */
  function updateToolStyle(toolType: keyof ToolStyles, style: Partial<ToolStyleConfig>): void {
    toolStyles.value[toolType] = {
      ...toolStyles.value[toolType],
      ...style,
    }
    // Persist to localStorage
    saveToolStylesToStorage(toolStyles.value)
  }

  /**
   * Reset tool styles to defaults
   * @param toolType - Optional tool type (if not provided, resets all)
   */
  function resetToolStyles(toolType?: keyof ToolStyles): void {
    if (toolType) {
      toolStyles.value[toolType] = { ...DEFAULT_TOOL_STYLES[toolType] }
    } else {
      toolStyles.value = { ...DEFAULT_TOOL_STYLES }
    }
    saveToolStylesToStorage(toolStyles.value)
  }

  // ==========  STORE EXPORT ==========

  /**
   * Set analysis result (for UI panel display)
   * @param type - Type of analysis result
   * @param data - Data associated with the analysis result
   */
  function setAnalysisResult(
    type: 'volume' | 'measure3d' | 'profile' | null,
    data: any = null
  ): void {
    analysisResultType.value = type
    analysisResultData.value = data
  }

  /**
   * Clear analysis result
   */
  function clearAnalysisResult(): void {
    analysisResultType.value = null
    analysisResultData.value = null
  }

  // ========== 3D分析结果管理 Actions ==========

  /**
   * Add new 3D analysis result
   * @param result - Analysis result configuration (id and timestamp will be auto-generated)
   * @returns The generated result ID
   */
  function addAnalysisResult(result: Omit<AnalysisResult, 'id' | 'timestamp'>): string {
    const newResult: AnalysisResult = {
      ...result,
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }
    // 添加到列表首部（最新的在前）
    analysisResults.value.unshift(newResult)
    // 自动选中新结果
    selectedResultId.value = newResult.id
    return newResult.id
  }

  /**
   * Update an existing analysis result in-place.
   * Useful for tools with live parameters (e.g., a live parameter slider).
   */
  function updateAnalysisResult(
    id: string,
    patch: Partial<Omit<AnalysisResult, 'id' | 'timestamp'>>
  ): void {
    const target = analysisResults.value.find((r) => r.id === id)
    if (!target) return

    if (patch.name !== undefined) target.name = patch.name
    if (patch.position !== undefined) target.position = patch.position
    if (patch.customName !== undefined) target.customName = patch.customName
    if (patch.notes !== undefined) target.notes = patch.notes
    if (patch.tags !== undefined) target.tags = patch.tags
    if (patch.type !== undefined) target.type = patch.type

    if (patch.data !== undefined) {
      // Prefer in-place merge to keep existing object references reactive.
      if (
        target.data &&
        typeof target.data === 'object' &&
        !Array.isArray(target.data) &&
        patch.data &&
        typeof patch.data === 'object' &&
        !Array.isArray(patch.data)
      ) {
        Object.assign(target.data as any, patch.data as any)
      } else {
        ;(target as any).data = patch.data as any
      }
    }
  }

  /**
   * 移除分析结果
   */
  function removeAnalysisResult(id: string): void {
    const index = analysisResults.value.findIndex((r) => r.id === id)
    if (index !== -1) {
      analysisResults.value.splice(index, 1)
      // 如果删除的是当前选中项，清除选中
      if (selectedResultId.value === id) {
        selectedResultId.value = null
      }
    }
  }

  /**
   * 选中/取消选中结果
   */
  function selectAnalysisResult(id: string | null): void {
    selectedResultId.value = id
  }

  /**
   * 清空所有分析结果
   */
  function clearAllAnalysisResults(): void {
    analysisResults.value = []
    selectedResultId.value = null
  }

  // ========== STORE EXPORT ==========

  return {
    // ========== State ==========
    viewer,
    currentTool,
    toolType,
    mode,
    features,
    graphics,
    selectedFeatureIds,
    highlightedFeatureId,
    measurements,
    snapEnabled,
    snapTolerance,
    showTips,
    continuousMode,
    drawStyle,

    // ========== Computed ==========
    isActive,
    isDrawing,
    isEditing,
    featureCount,
    selectedCount,
    featuresArray,
    selectedFeatures,
    measurementCount,
    activeTool,

    // ========== Tool Management ==========
    setViewer,
    activateTool,
    deactivateTool,
    setTool,

    // ========== Feature Management ==========
    addFeature,
    removeFeature,
    updateFeature,
    getFeature,
    getGraphic,
    clearFeatures,
    filterFeatures,

    // ========== Selection ==========
    selectFeature,
    deselectFeature,
    toggleSelection,
    highlightFeature,

    // ========== Measurement (Backward Compatibility) ==========
    addMeasurement,
    removeMeasurement,
    clearMeasurements,
    clearAll,

    // ========== Mode ==========
    startDrawing,
    finishDrawing,
    cancelDrawing,
    stopDrawing,
    enterEditMode,
    exitEditMode,

    // ========== Settings ==========
    setSnapEnabled,
    setSnapTolerance,
    setShowTips,
    setContinuousMode,

    // ========== Tool Styles ==========
    toolStyles,
    getToolStyle,
    updateToolStyle,
    resetToolStyles,

    // ========== Analysis Results ==========
    analysisResults,
    selectedResultId,
    analysisResultType,
    analysisResultData,
    setAnalysisResult,
    clearAnalysisResult,
    addAnalysisResult,
    updateAnalysisResult,
    removeAnalysisResult,
    selectAnalysisResult,
    clearAllAnalysisResults,

    // ========== Import/Export ==========
    exportGeoJSON,
    importGeoJSON,

    // ========== History (Undo/Redo) ==========
    historyStack,
    historyIndex,
    canUndo,
    canRedo,
    historyLength,
    undo,
    redo,
    clearHistory,
    getHistory,
    recordHistory,

    // ========== Reset ==========
    reset,
    resetDrawing,
  }
})

/**
 * Backward compatibility alias
 * Use useGISStore() instead for new code
 */
export const useMeasureStore = useGISStore
