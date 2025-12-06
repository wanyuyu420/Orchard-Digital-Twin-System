<template>
  <!-- This is a logical component with no template -->
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useGISStore } from '@/stores/gis'
import { DrawTool } from '@/cesium/gis/tools/DrawTool'
import { VolumeTool, type VolumeAnalysisResult } from '@/cesium/gis/tools/VolumeTool'
import { PointGraphic } from '@/cesium/gis/graphics/PointGraphic'
import { LineGraphic } from '@/cesium/gis/graphics/LineGraphic'
import { CircleGraphic } from '@/cesium/gis/graphics/CircleGraphic'
import { RectangleGraphic } from '@/cesium/gis/graphics/RectangleGraphic'
import { PolygonGraphic } from '@/cesium/gis/graphics/PolygonGraphic'
import { SnapService, type SnapTarget } from '@/cesium/gis/utils/SnapService'
import type { DrawToolType } from '@/types/draw'
import type { Feature } from '@/types/feature'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const gisStore = useGISStore()

// Current active tool instance
const currentTool = shallowRef<DrawTool | VolumeTool | null>(null)

// Volume analysis tool instance (persistent for result display)
const volumeTool = shallowRef<VolumeTool | null>(null)

// Selection event handler
let selectionHandler: any = null

// Track Ctrl/Shift key state
let isCtrlPressed = false
let isShiftPressed = false

// ========== Drag State ==========
let isDragging = false
let dragFeatureId: string | null = null
let dragStartPosition: any = null  // Cartesian3

// ========== Vertex Edit State ==========
let editingFeatureId: string | null = null
let isDraggingVertex = false
let dragVertexIndex: number = -1
let dragVertexFeatureId: string | null = null

// ========== Snap State ==========
let snapService: SnapService | null = null
let snapIndicator: any = null  // Cesium.Entity
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _currentSnapTarget: SnapTarget | null = null  // For future DrawTool integration

onMounted(() => {
  // Set viewer in GIS store
  if (cesiumStore.viewer) {
    gisStore.setViewer(cesiumStore.viewer)
    setupSelectionHandler()
    initSnapService()
  }
})

onUnmounted(() => {
  cleanup()
})

/**
 * Setup map click handler for feature selection and drag
 */
function setupSelectionHandler() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  // Track Ctrl/Meta/Shift key state via DOM events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      isCtrlPressed = true
    }
    if (e.key === 'Shift') {
      isShiftPressed = true
    }
    // ESC to exit edit mode
    if (e.key === 'Escape') {
      exitEditMode()
    }

    // Ctrl+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (gisStore.canUndo) {
        gisStore.undo()
        // Refresh graphics after undo (feature may have been restored/removed)
        refreshGraphicsFromFeatures()
      }
    }

    // Ctrl+Y or Ctrl+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (gisStore.canRedo) {
        gisStore.redo()
        // Refresh graphics after redo (feature may have been restored/removed)
        refreshGraphicsFromFeatures()
      }
    }

    // Delete or Backspace to remove selected features
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't delete if in edit mode (vertex editing) or if user is in an input field
      if (editingFeatureId || isInputFocused()) return

      e.preventDefault()
      deleteSelectedFeatures()
    }

    // Ctrl+A to select all features
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      // Don't select all if user is in an input field
      if (isInputFocused()) return

      e.preventDefault()
      selectAllFeatures()
    }
  }
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      isCtrlPressed = false
    }
    if (e.key === 'Shift') {
      isShiftPressed = false
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

  selectionHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  // Store cleanup functions
  ;(selectionHandler as any)._keyboardCleanup = () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
  }

  // LEFT_DOWN for drag start (feature drag or vertex drag)
  selectionHandler.setInputAction((event: any) => {
    // Skip when drawing tool is active
    if (gisStore.isDrawing || gisStore.toolType) return

    const pickedObject = viewer.scene.pick(event.position)

    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id

      // Check if this is a vertex marker (has vertexIndex property)
      const vertexIndex = getVertexIndexFromEntity(entity)
      if (vertexIndex !== null && editingFeatureId) {
        // Start vertex dragging
        isDraggingVertex = true
        dragVertexIndex = vertexIndex
        dragVertexFeatureId = editingFeatureId
        dragStartPosition = viewer.scene.pickPosition(event.position)

        // Disable camera controls during drag
        disableCameraControls(viewer)
        return
      }

      const featureId = getFeatureIdFromEntity(entity)

      // Only start drag if clicking on a selected feature (not in edit mode)
      if (featureId && gisStore.selectedFeatureIds.has(featureId) && !editingFeatureId) {
        isDragging = true
        dragFeatureId = featureId
        dragStartPosition = viewer.scene.pickPosition(event.position)

        // Disable camera controls during drag
        disableCameraControls(viewer)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

  // LEFT_DOUBLE_CLICK for entering edit mode
  selectionHandler.setInputAction((event: any) => {
    // Skip when drawing tool is active
    if (gisStore.isDrawing || gisStore.toolType) return

    const pickedObject = viewer.scene.pick(event.position)

    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const featureId = getFeatureIdFromEntity(pickedObject.id)

      if (featureId && gisStore.features.has(featureId)) {
        const feature = gisStore.features.get(featureId)
        // Only polygon and line support vertex editing
        if (feature && (feature.type === 'polygon' || feature.type === 'line')) {
          enterEditMode(featureId)
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  // MOUSE_MOVE for drag (feature drag or vertex drag)
  selectionHandler.setInputAction((event: any) => {
    const currentPosition = viewer.scene.pickPosition(event.endPosition)
    if (!Cesium.defined(currentPosition)) return

    // Handle vertex dragging
    if (isDraggingVertex && dragVertexFeatureId !== null && dragVertexIndex >= 0) {
      const graphic = gisStore.graphics.get(dragVertexFeatureId) as any
      if (graphic) {
        // Update vertex position based on graphic type
        if (graphic instanceof PolygonGraphic) {
          graphic.updateVertex(dragVertexIndex, currentPosition)
        } else if (graphic instanceof LineGraphic) {
          const positions = graphic.getPositions()
          if (positions && dragVertexIndex < positions.length) {
            positions[dragVertexIndex] = currentPosition
            graphic.updatePositions(positions)
          }
        }
      }
      return
    }

    // Handle feature dragging
    if (!isDragging || !dragFeatureId || !dragStartPosition) return

    // Calculate offset
    const offset = Cesium.Cartesian3.subtract(
      currentPosition,
      dragStartPosition,
      new Cesium.Cartesian3()
    )

    // Move all selected features
    gisStore.selectedFeatureIds.forEach(featureId => {
      const graphic = gisStore.graphics.get(featureId)
      if (graphic && graphic.move) {
        graphic.move(offset)
      }
    })

    // Update drag start position for next move
    dragStartPosition = currentPosition
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  // LEFT_UP for drag end and selection
  selectionHandler.setInputAction((event: any) => {
    const wasDragging = isDragging
    const wasDraggingVertex = isDraggingVertex

    // Re-enable camera controls
    enableCameraControls(viewer)

    // Handle vertex drag completion
    if (wasDraggingVertex && dragVertexFeatureId) {
      // Update feature geometry after vertex drag
      const graphic = gisStore.graphics.get(dragVertexFeatureId)
      if (graphic) {
        updateFeatureGeometry(dragVertexFeatureId, graphic)
      }

      // Reset vertex drag state
      isDraggingVertex = false
      dragVertexIndex = -1
      dragVertexFeatureId = null
      dragStartPosition = null
      return
    }

    if (wasDragging) {
      // Update feature geometry in store after drag
      gisStore.selectedFeatureIds.forEach(featureId => {
        const graphic = gisStore.graphics.get(featureId)
        const feature = gisStore.features.get(featureId)
        if (graphic && feature) {
          // Update feature geometry from graphic positions
          updateFeatureGeometry(featureId, graphic)
        }
      })

      // Reset drag state
      isDragging = false
      dragFeatureId = null
      dragStartPosition = null
      return
    }

    // If not dragging, handle as selection click or vertex operations
    // Skip selection when drawing tool is active
    if (gisStore.isDrawing || gisStore.toolType) return

    const pickedObject = viewer.scene.pick(event.position)

    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id

      // Check if clicking on a vertex marker
      const vertexIndex = getVertexIndexFromEntity(entity)
      if (vertexIndex !== null && editingFeatureId) {
        // Shift+Click: Delete vertex
        if (isShiftPressed) {
          deleteVertex(editingFeatureId, vertexIndex)
        }
        return
      }

      const featureId = getFeatureIdFromEntity(entity)

      if (featureId && gisStore.features.has(featureId)) {
        // If in edit mode and clicking on different feature, exit edit mode first
        if (editingFeatureId && editingFeatureId !== featureId) {
          exitEditMode()
        }

        if (isCtrlPressed) {
          // Ctrl+Click: Toggle selection
          gisStore.toggleSelection(featureId)
        } else {
          // Normal click: Single selection
          gisStore.selectFeature(featureId, false)
        }

        // Apply highlight to selected features
        applySelectionHighlights()
      }
    } else {
      // Click on empty space
      if (editingFeatureId) {
        // Exit edit mode when clicking empty space
        exitEditMode()
      } else if (!isCtrlPressed) {
        // Deselect all (unless Ctrl is held)
        gisStore.deselectFeature()
        applySelectionHighlights()
      }
    }

    // Reset drag state
    isDragging = false
    dragFeatureId = null
    dragStartPosition = null
  }, Cesium.ScreenSpaceEventType.LEFT_UP)
}

/**
 * Extract featureId from entity
 */
function getFeatureIdFromEntity(entity: any): string | null {
  let featureId: string | null = null

  if (entity.properties && entity.properties.featureId) {
    const prop = entity.properties.featureId
    featureId = prop.getValue ? prop.getValue(Cesium.JulianDate.now()) : prop
  }

  // Fallback: try entity.id
  if (!featureId && typeof entity.id === 'string') {
    featureId = entity.id
  }

  return featureId
}

/**
 * Extract vertexIndex from entity (for vertex markers)
 */
function getVertexIndexFromEntity(entity: any): number | null {
  if (entity.properties && entity.properties.vertexIndex !== undefined) {
    const prop = entity.properties.vertexIndex
    const value = prop.getValue ? prop.getValue(Cesium.JulianDate.now()) : prop
    return typeof value === 'number' ? value : null
  }
  return null
}

/**
 * Disable camera controls (during drag)
 */
function disableCameraControls(viewer: any): void {
  viewer.scene.screenSpaceCameraController.enableRotate = false
  viewer.scene.screenSpaceCameraController.enableTranslate = false
  viewer.scene.screenSpaceCameraController.enableZoom = false
  viewer.scene.screenSpaceCameraController.enableTilt = false
  viewer.scene.screenSpaceCameraController.enableLook = false
}

/**
 * Enable camera controls (after drag)
 */
function enableCameraControls(viewer: any): void {
  viewer.scene.screenSpaceCameraController.enableRotate = true
  viewer.scene.screenSpaceCameraController.enableTranslate = true
  viewer.scene.screenSpaceCameraController.enableZoom = true
  viewer.scene.screenSpaceCameraController.enableTilt = true
  viewer.scene.screenSpaceCameraController.enableLook = true
}

/**
 * Enter edit mode for a feature
 */
function enterEditMode(featureId: string): void {
  // Exit existing edit mode if any
  if (editingFeatureId && editingFeatureId !== featureId) {
    exitEditMode()
  }

  const graphic = gisStore.graphics.get(featureId)
  if (!graphic) return

  editingFeatureId = featureId
  gisStore.enterEditMode(featureId)

  // Start edit on graphic (shows vertex markers)
  graphic.startEdit()

  console.log('Entered edit mode for feature:', featureId)
}

/**
 * Exit edit mode
 */
function exitEditMode(): void {
  if (!editingFeatureId) return

  const graphic = gisStore.graphics.get(editingFeatureId)
  if (graphic) {
    // Stop edit on graphic (hides vertex markers)
    graphic.stopEdit()

    // Sync geometry to store
    updateFeatureGeometry(editingFeatureId, graphic)
  }

  gisStore.exitEditMode()
  editingFeatureId = null

  // Reset vertex drag state
  isDraggingVertex = false
  dragVertexIndex = -1
  dragVertexFeatureId = null

  console.log('Exited edit mode')
}

/**
 * Delete a vertex from the editing feature
 */
function deleteVertex(featureId: string, vertexIndex: number): void {
  const graphic = gisStore.graphics.get(featureId) as any
  const feature = gisStore.features.get(featureId)
  if (!graphic || !feature) return

  try {
    if (graphic instanceof PolygonGraphic) {
      // Polygon needs at least 3 vertices
      const positions = graphic.getPositions()
      if (positions && positions.length <= 3) {
        console.warn('Cannot delete vertex: polygon must have at least 3 vertices')
        return
      }
      graphic.removeVertex(vertexIndex)
    } else if (graphic instanceof LineGraphic) {
      // Line needs at least 2 vertices
      const positions = graphic.getPositions()
      if (!positions || positions.length <= 2) {
        console.warn('Cannot delete vertex: line must have at least 2 vertices')
        return
      }
      // Remove vertex by updating positions
      const newPositions = positions.filter((_: any, i: number) => i !== vertexIndex)
      graphic.stopEdit() // Stop edit to hide old markers
      graphic.updatePositions(newPositions)
      graphic.startEdit() // Re-enter edit to show updated markers
    }

    // Update feature geometry
    updateFeatureGeometry(featureId, graphic)

    // Re-enter edit mode to refresh vertex markers
    if (graphic instanceof PolygonGraphic) {
      graphic.stopEdit()
      graphic.startEdit()
    }

    console.log('Deleted vertex', vertexIndex, 'from feature', featureId)
  } catch (error) {
    console.error('Failed to delete vertex:', error)
  }
}

/**
 * Update feature geometry from graphic positions after move
 */
function updateFeatureGeometry(featureId: string, graphic: any) {
  const feature = gisStore.features.get(featureId)
  if (!feature) return

  const positions = graphic.getPositions()
  if (!positions || positions.length === 0) return

  // Convert positions to GeoJSON coordinates
  const coordinates = positions.map((pos: any) => {
    const cartographic = Cesium.Cartographic.fromCartesian(pos)
    return [
      Cesium.Math.toDegrees(cartographic.longitude),
      Cesium.Math.toDegrees(cartographic.latitude),
      cartographic.height
    ]
  })

  // Update geometry based on feature type
  switch (feature.type) {
    case 'point':
      feature.geometry.coordinates = coordinates[0]
      break
    case 'line':
      feature.geometry.coordinates = coordinates
      break
    case 'polygon':
      // Close polygon ring
      feature.geometry.coordinates = [[...coordinates, coordinates[0]]]
      break
    case 'circle':
      // Circle: store center and recalculate radius
      feature.geometry.coordinates = coordinates[0]
      if (graphic.getRadius) {
        feature.properties = feature.properties || {}
        feature.properties.radius = graphic.getRadius()
      }
      break
    case 'rectangle':
      // Rectangle: store as polygon
      const sw = coordinates[0]
      const ne = coordinates[1]
      feature.geometry.coordinates = [[
        [sw[0], ne[1]], // NW
        [ne[0], ne[1]], // NE
        [ne[0], sw[1]], // SE
        [sw[0], sw[1]], // SW
        [sw[0], ne[1]]  // Close
      ]]
      break
  }

  // Update timestamp
  gisStore.updateFeature(featureId, { updatedAt: new Date() })
}

/**
 * Check if user is focused on an input field
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false
  const tagName = activeElement.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || activeElement.getAttribute('contenteditable') === 'true'
}

/**
 * Delete all selected features
 */
function deleteSelectedFeatures(): void {
  const selectedIds = Array.from(gisStore.selectedFeatureIds)
  if (selectedIds.length === 0) return

  console.log('Deleting selected features:', selectedIds)

  // Remove each selected feature
  selectedIds.forEach(featureId => {
    gisStore.removeFeature(featureId)
  })

  // Clear selection
  gisStore.deselectFeature()
}

/**
 * Select all features
 */
function selectAllFeatures(): void {
  const allFeatureIds = Array.from(gisStore.features.keys())
  if (allFeatureIds.length === 0) return

  console.log('Selecting all features:', allFeatureIds.length)

  // Select all features
  gisStore.selectFeature(allFeatureIds, true)

  // Apply highlights
  applySelectionHighlights()
}

/**
 * Apply highlight effect to all selected features
 */
function applySelectionHighlights() {
  const selectedIds = gisStore.selectedFeatureIds

  // Iterate through all graphics and update highlight state
  gisStore.graphics.forEach((graphic, featureId) => {
    const shouldHighlight = selectedIds.has(featureId)
    if (graphic.setHighlight) {
      graphic.setHighlight(shouldHighlight)
    }
  })
}

/**
 * Refresh graphics from features after undo/redo
 * This ensures the visual representation matches the feature state
 */
function refreshGraphicsFromFeatures() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  // Find features that need graphics created (restored by undo)
  gisStore.features.forEach((feature, featureId) => {
    if (!gisStore.graphics.has(featureId)) {
      // Feature exists but no graphic - create one
      const graphic = createGraphicFromFeature(feature, viewer)
      if (graphic) {
        gisStore.graphics.set(featureId, graphic)
        console.log('Recreated graphic for restored feature:', featureId)
      }
    }
  })

  // Find graphics that need to be removed (feature removed by undo)
  const graphicsToRemove: string[] = []
  gisStore.graphics.forEach((_, featureId) => {
    if (!gisStore.features.has(featureId)) {
      graphicsToRemove.push(featureId)
    }
  })
  graphicsToRemove.forEach(featureId => {
    const graphic = gisStore.graphics.get(featureId)
    if (graphic) {
      graphic.destroy()
      gisStore.graphics.delete(featureId)
      console.log('Removed graphic for deleted feature:', featureId)
    }
  })

  // Update highlights
  applySelectionHighlights()
}

// Watch for selection changes (from list or other sources)
watch(
  () => [...gisStore.selectedFeatureIds],
  () => {
    applySelectionHighlights()
  },
  { deep: true }
)

// Watch for tool type changes
watch(() => gisStore.toolType, (newToolType, oldToolType) => {
  if (oldToolType) {
    deactivateTool()
  }

  if (newToolType && isDrawTool(newToolType)) {
    activateTool(newToolType as DrawToolType)
  } else if (newToolType && isAnalysisTool(newToolType)) {
    activateAnalysisTool(newToolType)
  }
})

/**
 * Check if tool type is a drawing tool
 */
function isDrawTool(toolType: string | null): boolean {
  if (!toolType) return false
  return ['point', 'line', 'circle', 'rectangle', 'polygon'].includes(toolType)
}

/**
 * Check if tool type is an analysis tool
 */
function isAnalysisTool(toolType: string | null): boolean {
  if (!toolType) return false
  return ['volume', 'flood', 'profile', 'measure3d'].includes(toolType)
}

/**
 * Activate drawing tool
 */
function activateTool(toolType: DrawToolType) {
  const viewer = cesiumStore.viewer
  if (!viewer) {
    console.warn('Cesium viewer not ready')
    return
  }

  try {
    // Create new tool instance with style from store
    const style = gisStore.drawStyle
    const tool = new DrawTool(viewer, {
      geometryType: toolType as any, // toolType is 'point' | 'line' | 'circle' | 'rectangle' | 'polygon'
      style: {
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        lineType: style.lineType,
        pointColor: style.pointColor,
        pointSize: style.pointSize
      },
      onComplete: (feature: Feature) => {
        // Convert Feature to Graphic
        const graphic = createGraphicFromFeature(feature, viewer)
        if (!graphic) {
          console.error('Failed to create graphic from feature:', feature)
          return
        }

        // Register feature and graphic to GISStore
        gisStore.addFeature(feature, graphic)

        // For MVP: Keep tool active for easier use (user can click away to deactivate)
        // Future: Add toggle for continuous mode in UI
        // if (!gisStore.continuousMode) {
        //   gisStore.deactivateTool()
        // }
      },
      onCancel: () => {
        // User cancelled drawing
        console.log('Drawing cancelled')
      }
    })

    // Activate the tool
    tool.activate()

    // Store tool instance
    currentTool.value = tool

    // Update store state
    gisStore.startDrawing()
  } catch (error) {
    console.error('Failed to activate drawing tool:', error)
  }
}

/**
 * Deactivate current tool
 */
function deactivateTool() {
  if (currentTool.value) {
    try {
      currentTool.value.deactivate()
      currentTool.value = null
      gisStore.cancelDrawing()
    } catch (error) {
      console.error('Failed to deactivate tool:', error)
    }
  }
}

/**
 * Activate analysis tool
 */
function activateAnalysisTool(toolType: string) {
  const viewer = cesiumStore.viewer
  if (!viewer) {
    console.warn('Cesium viewer not ready')
    return
  }

  try {
    switch (toolType) {
      case 'volume':
        activateVolumeTool(viewer)
        break
      case 'flood':
        // TODO: Implement FloodTool
        console.log('Flood tool not yet implemented')
        break
      case 'profile':
        // TODO: Implement ProfileTool
        console.log('Profile tool not yet implemented')
        break
      case 'measure3d':
        // TODO: Implement Measure3DTool
        console.log('3D Measure tool not yet implemented')
        break
      default:
        console.warn('Unknown analysis tool type:', toolType)
    }
  } catch (error) {
    console.error('Failed to activate analysis tool:', error)
  }
}

/**
 * Activate volume calculation tool
 */
function activateVolumeTool(viewer: any) {
  // Clear previous volume result if any
  if (volumeTool.value) {
    volumeTool.value.clearResult()
  }

  const tool = new VolumeTool(viewer, {
    baseHeight: 0,
    onComplete: (result: VolumeAnalysisResult) => {
      console.log('Volume analysis complete:', result)
      // Emit event or update store with result
      // For now, the result visualization is handled by VolumeTool itself
    },
    onCancel: () => {
      console.log('Volume analysis cancelled')
    }
  })

  tool.activate()
  currentTool.value = tool
  volumeTool.value = tool
  gisStore.startDrawing()
}

/**
 * Create Graphic instance from Feature
 */
function createGraphicFromFeature(feature: Feature, viewer: any) {
  const { geometry, style, name, properties } = feature

  // Convert coordinates to Cartesian3
  const positions = convertCoordinatesToCartesian3(geometry)
  if (!positions || positions.length === 0) {
    console.error('Failed to convert geometry coordinates:', geometry)
    return null
  }

  // Create appropriate Graphic based on type
  let graphic
  try {
    switch (feature.type) {
      case 'point':
        graphic = new PointGraphic(viewer, {
          name,
          style,
          label: name
        })
        break
      case 'line':
        graphic = new LineGraphic(viewer, {
          name,
          style
        })
        break
      case 'circle': {
        // Circle needs center and radius
        if (!properties?.radius) {
          console.error('Circle missing radius property:', feature)
          return null
        }
        // CircleGraphic.create() expects [center, edgePoint]
        // Calculate edge point from center + radius
        const centerPos = positions[0]
        const centerCarto = Cesium.Cartographic.fromCartesian(centerPos)
        const edgePos = Cesium.Cartesian3.fromRadians(
          centerCarto.longitude + properties.radius / 6378137, // approximate
          centerCarto.latitude,
          centerCarto.height
        )
        const circlePositions = [centerPos, edgePos]

        graphic = new CircleGraphic(viewer, {
          name,
          style
        })
        graphic.create(circlePositions)
        graphic.bindFeatureId(feature.id)
        console.log(`Created circle graphic:`, feature.id, circlePositions.length, 'positions')
        return graphic
      }
      case 'rectangle': {
        // Rectangle is stored as Polygon with 5 positions (4 corners + closing point)
        // RectangleGraphic.create() expects [corner1, corner2] (opposite corners)
        if (positions.length < 4) {
          console.error('Rectangle needs at least 4 corner positions:', positions.length)
          return null
        }
        // Use corner 0 (SW) and corner 2 (NE) as opposite corners
        const rectanglePositions = [positions[0], positions[2]]

        graphic = new RectangleGraphic(viewer, {
          name,
          style
        })
        graphic.create(rectanglePositions)
        graphic.bindFeatureId(feature.id)
        console.log(`Created rectangle graphic:`, feature.id, rectanglePositions.length, 'positions')
        return graphic
      }
      case 'polygon':
        graphic = new PolygonGraphic(viewer, {
          name,
          style
        })
        break
      default:
        console.error('Unknown feature type:', feature.type)
        return null
    }

    // Create the graphic with positions
    graphic.create(positions)

    // Bind featureId to graphic and its entities for selection
    graphic.bindFeatureId(feature.id)

    console.log(`Created ${feature.type} graphic:`, feature.id, positions.length, 'positions')
    return graphic
  } catch (error) {
    console.error(`Error creating ${feature.type} graphic:`, error, feature)
    return null
  }
}

/**
 * Convert Feature geometry coordinates to Cesium.Cartesian3 array
 */
function convertCoordinatesToCartesian3(geometry: any): any[] {
  if (!geometry || !geometry.coordinates) {
    console.error('Invalid geometry:', geometry)
    return []
  }

  const coords = geometry.coordinates

  try {
    switch (geometry.type) {
      case 'Point':
        // Single coordinate [lon, lat, height?]
        if (!Array.isArray(coords) || coords.length < 2) {
          console.error('Invalid Point coordinates:', coords)
          return []
        }
        return [Cesium.Cartesian3.fromDegrees(coords[0], coords[1], coords[2] || 0)]

      case 'LineString':
        // Array of coordinates [[lon, lat, height?], ...]
        if (!Array.isArray(coords)) {
          console.error('Invalid LineString coordinates:', coords)
          return []
        }
        return coords.map((c: number[]) => {
          if (!Array.isArray(c) || c.length < 2) {
            console.warn('Invalid coordinate in LineString:', c)
            return null
          }
          return Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0)
        }).filter((p: any) => p !== null)

      case 'Polygon':
        // Array of rings, use first ring (exterior)
        if (!Array.isArray(coords) || coords.length === 0) {
          console.error('Invalid Polygon coordinates:', coords)
          return []
        }
        const ring = coords[0]
        if (!Array.isArray(ring)) {
          console.error('Invalid Polygon ring:', ring)
          return []
        }
        return ring.map((c: number[]) => {
          if (!Array.isArray(c) || c.length < 2) {
            console.warn('Invalid coordinate in Polygon:', c)
            return null
          }
          return Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0)
        }).filter((p: any) => p !== null)

      default:
        console.warn('Unsupported geometry type:', geometry.type)
        return []
    }
  } catch (error) {
    console.error('Error converting coordinates:', error, geometry)
    return []
  }
}

/**
 * Cleanup on unmount
 */
function cleanup() {
  deactivateTool()

  // Destroy selection handler and keyboard listeners
  if (selectionHandler) {
    if ((selectionHandler as any)._keyboardCleanup) {
      (selectionHandler as any)._keyboardCleanup()
    }
    selectionHandler.destroy()
    selectionHandler = null
  }

  // Cleanup snap service
  if (snapService) {
    snapService.destroy()
    snapService = null
  }
  removeSnapIndicator()
}

// ========== Snap Functions ==========

/**
 * Initialize snap service
 */
function initSnapService(): void {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  snapService = new SnapService(viewer, {
    enabled: gisStore.snapEnabled,
    tolerance: gisStore.snapTolerance,
    snapToVertex: true,
    snapToEdge: true
  })

  // Sync existing features
  snapService.syncFromStore(gisStore.graphics)

  // Create snap indicator entity
  createSnapIndicator()
}

/**
 * Create snap indicator entity
 */
function createSnapIndicator(): void {
  const viewer = cesiumStore.viewer
  if (!viewer || snapIndicator) return

  snapIndicator = viewer.entities.add({
    id: '_snap_indicator',
    position: Cesium.Cartesian3.ZERO,
    show: false,
    point: {
      pixelSize: 12,
      color: Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  })
}

/**
 * Remove snap indicator entity
 */
function removeSnapIndicator(): void {
  const viewer = cesiumStore.viewer
  if (viewer && snapIndicator) {
    viewer.entities.remove(snapIndicator)
    snapIndicator = null
  }
}

/**
 * Update snap indicator position and visibility
 */
function updateSnapIndicator(target: SnapTarget | null): void {
  if (!snapIndicator) return

  _currentSnapTarget = target

  if (target) {
    snapIndicator.position = target.position
    snapIndicator.show = true

    // Change color based on snap type
    if (target.type === 'vertex') {
      snapIndicator.point.color = Cesium.Color.ORANGE
      snapIndicator.point.pixelSize = 14
    } else {
      snapIndicator.point.color = Cesium.Color.YELLOW
      snapIndicator.point.pixelSize = 10
    }
  } else {
    snapIndicator.show = false
  }
}

/**
 * Find snap target for screen position (exported for DrawTool integration)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _findSnapTarget(screenPosition: { x: number; y: number }): SnapTarget | null {
  if (!snapService || !gisStore.snapEnabled) return null

  // Update snap service options
  snapService.setOptions({
    enabled: gisStore.snapEnabled,
    tolerance: gisStore.snapTolerance
  })

  return snapService.findSnapTarget(new Cesium.Cartesian2(screenPosition.x, screenPosition.y))
}

/**
 * Sync features to snap service when graphics change
 */
function syncSnapFeatures(): void {
  if (snapService) {
    snapService.syncFromStore(gisStore.graphics)
  }
}

// Watch for feature changes to sync snap targets
watch(() => gisStore.featureCount, () => {
  syncSnapFeatures()
})

// Watch for snap enabled changes
watch(() => gisStore.snapEnabled, (enabled) => {
  if (snapService) {
    snapService.setOptions({ enabled })
  }
  if (!enabled) {
    updateSnapIndicator(null)
  }
})

// Export snap functions for future integration
defineExpose({
  findSnapTarget: _findSnapTarget,
  getCurrentSnapTarget: () => _currentSnapTarget
})
</script>
