<template>
	<!-- This is a logical component with no template -->
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useGISStore } from '@/stores/gis'
import { useOrchardStore } from '@/stores/orchard'
import { DrawTool } from '@/cesium/gis/tools/DrawTool'
import { VolumeTool, type VolumeAnalysisResult } from '@/cesium/gis/tools/VolumeTool'
import { FloodTool, type FloodAnalysisResult } from '@/cesium/gis/tools/FloodTool'
import { ProfileTool, type ProfileAnalysisResult } from '@/cesium/gis/tools/ProfileTool'
import { Measure3DTool, type Measure3DResult } from '@/cesium/gis/tools/Measure3DTool'
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
const orchardStore = useOrchardStore()

// Current active tool instance
const currentTool = shallowRef<
	DrawTool | VolumeTool | FloodTool | ProfileTool | Measure3DTool | null
>(null)

// Volume analysis tool instance (persistent for result display)
const volumeTool = shallowRef<VolumeTool | null>(null)

// Flood analysis tool instance
const floodTool = shallowRef<FloodTool | null>(null)

// Profile analysis tool instance
const profileTool = shallowRef<ProfileTool | null>(null)

// Profile analysis result (for chart display)
const profileResult = shallowRef<ProfileAnalysisResult | null>(null)

// 3D Measure tool instance
const measure3dTool = shallowRef<Measure3DTool | null>(null)

// Selection event handler
let selectionHandler: any = null

// Track Ctrl/Shift key state
let isCtrlPressed = false
let isShiftPressed = false

// ========== Drag State ==========
let isDragging = false
let dragFeatureId: string | null = null
let dragStartPosition: any = null // Cartesian3

// ========== Vertex Edit State ==========
let editingFeatureId: string | null = null
let isDraggingVertex = false
let dragVertexIndex: number = -1
let dragVertexFeatureId: string | null = null

// ========== Snap State ==========
let snapService: SnapService | null = null
let snapIndicator: any = null // Cesium.Entity
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _currentSnapTarget: SnapTarget | null = null // For future DrawTool integration

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
		; (selectionHandler as any)._keyboardCleanup = () => {
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
		gisStore.selectedFeatureIds.forEach((featureId) => {
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
			gisStore.selectedFeatureIds.forEach((featureId) => {
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

	// Convert positions to Coordinates
	const coordinates = positions.map((pos: any) => {
		const cartographic = Cesium.Cartographic.fromCartesian(pos)
		return {
			longitude: Cesium.Math.toDegrees(cartographic.longitude),
			latitude: Cesium.Math.toDegrees(cartographic.latitude),
			height: cartographic.height,
		}
	})

	// Update geometry based on feature type
	switch (feature.type) {
		case 'point':
			feature.position = coordinates[0]
			break
		case 'line':
			feature.vertices = coordinates
			if (graphic.getLength) {
				feature.length = graphic.getLength()
			}
			break
		case 'polygon':
			feature.vertices = coordinates
			if (graphic.getArea) {
				feature.area = graphic.getArea()
			}
			break
		case 'circle':
			// Circle: store center and recalculate radius
			feature.center = coordinates[0]
			if (graphic.getRadius) {
				feature.radius = graphic.getRadius()
				feature.area = Math.PI * feature.radius * feature.radius
			}
			break
		case 'rectangle':
			// For rectangle, we need to re-calculate bounds from all interaction points
			// But for now, we just rely on existing structure if possible
			// Simplification: Assume coordinates allow us to derive SW/NE
			{
				let minLon = Number.MAX_VALUE, maxLon = -Number.MAX_VALUE
				let minLat = Number.MAX_VALUE, maxLat = -Number.MAX_VALUE
				coordinates.forEach((c: any) => {
					minLon = Math.min(minLon, c.longitude)
					maxLon = Math.max(maxLon, c.longitude)
					minLat = Math.min(minLat, c.latitude)
					maxLat = Math.max(maxLat, c.latitude)
				})
				feature.southwest = { longitude: minLon, latitude: minLat, height: coordinates[0].height }
				feature.northeast = { longitude: maxLon, latitude: maxLat, height: coordinates[0].height }
				feature.width = Cesium.Cartesian3.distance(
					Cesium.Cartesian3.fromDegrees(minLon, minLat), Cesium.Cartesian3.fromDegrees(maxLon, minLat)
				)
				feature.height = Cesium.Cartesian3.distance(
					Cesium.Cartesian3.fromDegrees(minLon, minLat), Cesium.Cartesian3.fromDegrees(minLon, maxLat)
				)
				feature.area = feature.width * feature.height
			}
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
	return (
		tagName === 'input' ||
		tagName === 'textarea' ||
		activeElement.getAttribute('contenteditable') === 'true'
	)
}

/**
 * Delete all selected features
 */
function deleteSelectedFeatures(): void {
	const selectedIds = Array.from(gisStore.selectedFeatureIds)
	if (selectedIds.length === 0) return

	console.log('Deleting selected features:', selectedIds)

	// Remove each selected feature, sync with orchardStore sidebar
	selectedIds.forEach((featureId) => {
		// Sync remove from orchardStore sidebar
		const geoIndex = orchardStore.drawnGeometries.findIndex(
			(g) => g.featureId === featureId
		)
		if (geoIndex !== -1) {
			orchardStore.drawnGeometries.splice(geoIndex, 1)
		}
		// Remove from gisStore (destroys graphic on map)
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
	graphicsToRemove.forEach((featureId) => {
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
watch(
	() => gisStore.toolType,
	(newToolType, oldToolType) => {
		if (oldToolType) {
			deactivateTool()
		}

		if (newToolType && isDrawTool(newToolType)) {
			activateTool(newToolType as DrawToolType)
		} else if (newToolType && isAnalysisTool(newToolType)) {
			activateAnalysisTool(newToolType)
		}
	}
)

/**
 * Check if tool type is a drawing tool
 * Accepts both prefixed ('draw-point') and unprefixed ('point', 'rectangle') names
 */
function isDrawTool(toolType: string | null): boolean {
	if (!toolType) return false
	return [
		'draw-point', 'draw-line', 'draw-circle', 'draw-rectangle', 'draw-polygon',
		'point', 'line', 'circle', 'rectangle', 'polygon',
	].includes(toolType)
}

/**
 * Normalize tool type to always have the 'draw-' prefix
 * Converts 'rectangle' → 'draw-rectangle', 'circle' → 'draw-circle', etc.
 * Passes through already-prefixed names unchanged
 */
function normalizeDrawToolType(toolType: string): string {
	if (toolType.startsWith('draw-')) return toolType
	return `draw-${toolType}`
}

/**
 * Check if tool type is an analysis tool
 */
function isAnalysisTool(toolType: string | null): boolean {
	if (!toolType) return false
	return ['volume', 'flood', 'profile', 'measure3d'].includes(toolType)
}

/**
 * Convert a Feature to sidebar-compatible coordinate format
 * Produces flat `[[lon, lat], ...]` arrays for zoom/display in LeftSidebar
 */
function featureToSidebarCoords(
	feature: Feature,
	type: 'rectangle' | 'circle' | 'polygon'
): number[][] {
	const f = feature as any
	switch (type) {
		case 'rectangle': {
			const sw = f.southwest
			const ne = f.northeast
			return [
				[sw.longitude, sw.latitude],
				[ne.longitude, sw.latitude],
				[ne.longitude, ne.latitude],
				[sw.longitude, ne.latitude],
			]
		}
		case 'circle': {
			const center = f.center
			return [[center.longitude, center.latitude]]
		}
		case 'polygon': {
			return f.vertices.map((v: any) => [v.longitude, v.latitude])
		}
		default:
			return []
	}
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
		// Normalize tool type: ensure 'draw-' prefix for internal use
		const normalizedType = normalizeDrawToolType(toolType as string)

		// Get tool-specific style from store (with localStorage persistence)
		const toolStyle = gisStore.getToolStyle(normalizedType as any)

		// Merge with defaults (fallback to drawStyle for any missing properties)
		const style = {
			strokeColor: toolStyle.strokeColor || gisStore.drawStyle.strokeColor,
			strokeWidth: toolStyle.strokeWidth ?? gisStore.drawStyle.strokeWidth,
			fillColor: toolStyle.fillColor || gisStore.drawStyle.fillColor,
			fillOpacity: toolStyle.fillOpacity ?? gisStore.drawStyle.fillOpacity,
			lineType: toolStyle.lineType || gisStore.drawStyle.lineType,
			pointColor: toolStyle.pointColor || gisStore.drawStyle.pointColor,
			pointSize: toolStyle.pointSize ?? gisStore.drawStyle.pointSize,
			iconType: toolStyle.iconType || gisStore.drawStyle.iconType,
		}

		const tool = new DrawTool(viewer, {
			geometryType: normalizedType.replace('draw-', '') as any, // Use normalized type
			style: style,
			onComplete: (feature: Feature) => {
				// Convert Feature to Graphic
				const graphic = createGraphicFromFeature(feature, viewer)
				if (!graphic) {
					console.error('Failed to create graphic from feature:', feature)
					return
				}

				// Register feature and graphic to GISStore
				gisStore.addFeature(feature, graphic)

				// Bridge to orchardStore for left sidebar layer display
				const geomType = normalizedType.replace('draw-', '') as 'rectangle' | 'circle' | 'polygon'
				if (['rectangle', 'circle', 'polygon'].includes(geomType)) {
					const nextNum = orchardStore.drawnGeometries.length + 1
					const layerName = `#${nextNum}`

					// Convert feature to sidebar-compatible coordinates
					const coords = featureToSidebarCoords(feature, geomType)

					orchardStore.saveDrawnGeometry({
						name: layerName,
						type: geomType,
						coordinates: coords,
						featureId: feature.id,
					})

					// 将绘制图形坐标同步到 selectionRange，供查询面板使用
					orchardStore.setSelectionRange({
						type: geomType,
						coordinates: coords,
					})
				}

				// For MVP: Keep tool active for easier use (user can click away to deactivate)
				// Future: Add toggle for continuous mode in UI
				// if (!gisStore.continuousMode) {
				//   gisStore.deactivateTool()
				// }
			},
			onCancel: () => {
				// User cancelled drawing
				console.log('Drawing cancelled')
			},
		})

		// Activate the tool
		tool.activate()

		// Store tool instance (both locally and in store for style updates)
		currentTool.value = tool
		gisStore.currentTool = tool

		// Update store state - use the original toolType so the UI can toggle correctly
		gisStore.startDrawing(toolType as string)
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
			gisStore.currentTool = null
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
				activateFloodTool(viewer)
				break
			case 'profile':
				activateProfileTool(viewer)
				break
			case 'measure3d':
				activateMeasure3DTool(viewer)
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
	const tool = new VolumeTool(viewer, {
		requiresTerrain: true, // 强制要求地形
		baseHeight: 0,
		onComplete: (result: VolumeAnalysisResult) => {
			console.log('Volume analysis complete:', result)
			// Emit event or update store with result
			// For now, the result visualization is handled by VolumeTool itself
		},
		onCancel: () => {
			console.log('Volume analysis cancelled')
		},
	})

	if (tool.activate()) {
		currentTool.value = tool
		volumeTool.value = tool
		gisStore.startDrawing()
	} else {
		// Activation failed (e.g. no terrain), reset tool type selection
		gisStore.setTool(null)
	}
}

/**
 * Activate flood simulation tool
 */
function activateFloodTool(viewer: any) {
	// Clear previous flood result if any
	if (floodTool.value) {
		floodTool.value.clear()
	}

	const tool = new FloodTool(viewer, {
		mode: 'polygon', // 默认使用多边形绘制模式
		requiresTerrain: true, // 强制要求地形
		initialWaterLevel: 5,
		waterLevelStep: 1,
		waterColor: '#1E90FF',
		waterOpacity: 0.6,
		dataSource: {
			type: 'polygon',
			minWaterLevel: 0,
			maxWaterLevel: 50,
		},
		onWaterLevelChange: (level: number, result: FloodAnalysisResult) => {
			console.log(`Water level: ${level}m, Area: ${result.floodedArea.toFixed(0)}m²`)
		},
		onComplete: (result: FloodAnalysisResult) => {
			console.log('Flood analysis complete:', result)
		},
		onCancel: () => {
			console.log('Flood analysis cancelled')
		},
	})

	if (tool.activate()) {
		currentTool.value = tool
		floodTool.value = tool
		gisStore.setFloodController({
			setWaterLevel: (level: number) => tool.setWaterLevel(level),
			raise: () => tool.raiseWaterLevel(),
			lower: () => tool.lowerWaterLevel(),
			toggleAnimation: () => tool.toggleAnimation(),
			setRiseRateMps: (mps: number) => tool.setRiseRateMps(mps),
			getRiseRateMps: () => tool.getRiseRateMps(),
		})
		gisStore.startDrawing()
	} else {
		gisStore.setTool(null)
	}
}

/**
 * Activate profile analysis tool
 */
function activateProfileTool(viewer: any) {
	profileResult.value = null

	const tool = new ProfileTool(viewer, {
		sampleInterval: 20,
		maxSamples: 500,
		onComplete: (result: ProfileAnalysisResult) => {
			console.log('Profile analysis complete:', result)
			profileResult.value = result
			// Note: ProfileTool itself already appends the result into gisStore.analysisResults.
			// Chart should be opened on demand from the results list ("查看剖面图表").
		},
		onProgress: () => {
			// Optional: update UI loading state
		},
		onCancel: () => {
			console.log('Profile analysis cancelled')
		},
	})

	if (tool.activate()) {
		currentTool.value = tool
		profileTool.value = tool
		gisStore.startDrawing()
	} else {
		gisStore.setTool(null)
	}
}

/**
 * Activate 3D measure tool
 */
function activateMeasure3DTool(viewer: any) {
	const tool = new Measure3DTool(viewer, {
		requiresTerrain: true, // 强制要求地形
		heightMode: 'terrain',
		customHeight: 0,
		onComplete: (result: Measure3DResult) => {
			console.log('Measure 3D complete:', result)
			console.log(
				`Slope: ${result.spaceDistance.toFixed(2)}m, Horizontal: ${result.horizontalDistance.toFixed(2)}m`
			)
		},
		onHeightModeChange: (mode) => {
			console.log(`Height mode changed to: ${mode}`)
		},
		onCancel: () => {
			console.log('3D Measure cancelled')
		},
	})

	if (tool.activate()) {
		currentTool.value = tool
		measure3dTool.value = tool
		gisStore.startDrawing()
	} else {
		gisStore.setTool(null)
	}
}

/**
 * Create Graphic instance from Feature
 */
function createGraphicFromFeature(feature: Feature, viewer: any) {
	const { style, name } = feature
	const properties = feature.properties || {}

	let positions: any[] = []

	try {
		// Extract positions based on feature type
		// 保留原始高度信息，不强制覆盖为固定值
		if (feature.type === 'point') {
			const p = feature.position
			positions = [Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, (p as any).height)]
		} else if (feature.type === 'line') {
			positions = feature.vertices.map(v => Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, (v as any).height))
		} else if (feature.type === 'polygon') {
			positions = feature.vertices.map(v => Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, (v as any).height))
		} else if (feature.type === 'circle') {
			const c = feature.center
			positions = [Cesium.Cartesian3.fromDegrees(c.longitude, c.latitude, (c as any).height)]
		} else if (feature.type === 'rectangle') {
			const sw = feature.southwest
			const ne = feature.northeast
			// Construct approximate corners for RectangleGraphic creation (opposite corners)
			const p1 = Cesium.Cartesian3.fromDegrees(sw.longitude, sw.latitude, (sw as any).height)
			const p2 = Cesium.Cartesian3.fromDegrees(ne.longitude, ne.latitude, (ne as any).height)
			positions = [p1, p2]
		}

		if (!positions || positions.length === 0) {
			console.error('Failed to get positions from feature:', feature)
			return null
		}

		// Create appropriate Graphic based on type
		let graphic
		switch (feature.type) {
			case 'point':
				graphic = new PointGraphic(viewer, {
					name,
					style,
					label: name,
				})
				break
			case 'line':
				graphic = new LineGraphic(viewer, {
					name,
					style,
					lineStyle: (style as any).lineType || 'solid', // Preserve lineType from feature
				})
				break
			case 'circle': {
				// Circle needs center and radius
				if (!feature.radius) {
					console.error('Circle missing radius property:', feature)
					return null
				}
				// 直接使用 feature 的 center 和 radius 创建圆形
				const centerPos = positions[0]
				const circleGraphic = new CircleGraphic(viewer, {
					name,
					style,
				})
				// 直接设置 center 和 radius，不通过 positions 计算
				circleGraphic.setCenterAndRadius(centerPos, feature.radius)
				circleGraphic.bindFeatureId(feature.id)
				console.log(`Created circle graphic:`, feature.id, 'center:', centerPos)
				return circleGraphic
			}
			case 'rectangle': {
				// Rectangle is stored as Polygon with 5 positions (4 corners + closing point)
				// RectangleGraphic.create() expects [corner1, corner2] (opposite corners)
				// Use positions[0] (SW) and positions[1] (NE) as opposite corners
				const rectanglePositions = [positions[0], positions[1]]

				graphic = new RectangleGraphic(viewer, {
					name,
					style,
				})
				graphic.create(rectanglePositions)
				graphic.bindFeatureId(feature.id)
				console.log(
					`Created rectangle graphic:`,
					feature.id,
					rectanglePositions.length,
					'positions'
				)
				return graphic
			}
			case 'polygon':
				graphic = new PolygonGraphic(viewer, {
					name,
					style,
				})
				break
			default:
				console.error('Unknown feature type:', (feature as any).type)
				return null
		}

		// Create the graphic with positions
		// Note: Circle and Rectangle handled above
		if (graphic) {
			graphic.create(positions)
			graphic.bindFeatureId(feature.id)
			console.log(`Created ${feature.type} graphic:`, feature.id, positions.length, 'positions')
		}

		return graphic
	} catch (error) {
		console.error(`Error creating ${(feature as any).type} graphic:`, error, feature)
		return null
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
			; (selectionHandler as any)._keyboardCleanup()
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
		snapToEdge: true,
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
			disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
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
		tolerance: gisStore.snapTolerance,
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
watch(
	() => gisStore.featureCount,
	() => {
		syncSnapFeatures()
	}
)

// Watch for snap enabled changes
watch(
	() => gisStore.snapEnabled,
	(enabled) => {
		if (snapService) {
			snapService.setOptions({ enabled })
		}
		if (!enabled) {
			updateSnapIndicator(null)
		}
	}
)

// Export snap functions for future integration
defineExpose({
	findSnapTarget: _findSnapTarget,
	getCurrentSnapTarget: () => _currentSnapTarget,
})
</script>
