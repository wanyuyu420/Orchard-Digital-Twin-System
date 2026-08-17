<template>
  <!-- This is a logical component with no template -->
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, ref } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useDrawStore } from '@/stores/draw'
import { useFeatureStore } from '@/stores/feature'
import type { Coordinate } from '@/types/measure'
import type { PointFeature, LineFeature, CircleFeature } from '@/types/feature'
import { DEFAULT_STYLE } from '@/types/draw'
import { sampleSurfacePositions } from '@/utils/surfaceSampler'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const drawStore = useDrawStore()
const featureStore = useFeatureStore()

// Entity tracking map
const featureEntityMap = ref<Map<string, any[]>>(new Map())

// Common cursor preview point (for all tools)
const cursorPreviewPoint = ref<any>(null)

// Line drawing state
const lineVertices = ref<Coordinate[]>([])
const linePreviewEntities = ref<any[]>([])

// Circle drawing state
const circleCenter = ref<Coordinate | null>(null)
const circlePreview = ref<any>(null)

// Current cursor position
const currentCursorPosition = ref<any>(null)

// Throttle for mouse move
let lastMoveTime = 0
const MOVE_THROTTLE_MS = 16 // ~60fps

// Click debounce for point tool (prevent double-click adding multiple points)
let lastClickTime = 0
const CLICK_DEBOUNCE_MS = 300

// Event handler
let handler: any = null

// Drag state for custom panning
let isDragging = false
let dragStartPosition: any = null
let dragStartCameraPosition: any = null

// Store camera controller config and default interactions to restore after drawing
let previousCameraControllerState: {
  enableZoom: boolean
  enableTranslate: boolean
  enableRotate: boolean
  enableTilt: boolean
  enableLook: boolean
  enableCollisionDetection: boolean
  translateEventTypes: any
  zoomEventTypes: any
  tiltEventTypes: any
  rotateEventTypes: any
  lookEventTypes: any
  minimumZoomDistance: number
  maximumZoomDistance: number
} | null = null
let defaultLeftDoubleClickAction: any = null

onMounted(() => {
  setupEventHandlers()
})

onUnmounted(() => {
  cleanup()
})

// Watch active tool changes
watch(
  () => drawStore.activeTool,
  (newTool, oldTool) => {
    if (oldTool !== newTool) {
      // Clean up previous tool state
      cleanupDrawingState()

      if (newTool) {
        // Entering draw mode - configure camera for drawing (left-drag = pan)
        disableCameraControls()
        disableDefaultDoubleClick()
      } else {
        // Exiting draw mode
        restoreCameraControls()
        restoreDefaultDoubleClick()
      }
    }
  }
)

function setupEventHandlers() {
  const viewer = cesiumStore.viewer
  if (!viewer) {
    console.warn('Cesium viewer not ready')
    return
  }

  const scene = viewer.scene
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas)

  // Left click
  handler.setInputAction((click: any) => {
    handleClick(click.position)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  // Double click - for completing line/polygon drawing
  handler.setInputAction((click: any) => {
    handleDoubleClick(click.position)
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  // Mouse move
  handler.setInputAction((movement: any) => {
    handleMouseMove(movement.endPosition)
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  // Right click - cancel (right-drag for panning is untouched)
  handler.setInputAction(() => {
    handleRightClick()
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

  // Left drag start - for custom panning in draw mode
  handler.setInputAction((movement: any) => {
    handleLeftDragStart(movement.position)
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

  // Left drag end
  handler.setInputAction(() => {
    handleLeftDragEnd()
  }, Cesium.ScreenSpaceEventType.LEFT_UP)
}

// Custom pan implementation for draw mode
function handleLeftDragStart(position: any) {
  if (!drawStore.activeTool) return

  const viewer = cesiumStore.viewer
  if (!viewer) return

  isDragging = true
  dragStartPosition = Cesium.Cartesian2.clone(position)

  // Store camera state at drag start
  const camera = viewer.scene.camera
  dragStartCameraPosition = Cesium.Cartesian3.clone(camera.position)
}

function handleLeftDragEnd() {
  isDragging = false
  dragStartPosition = null
  dragStartCameraPosition = null
}

function handleClick(screenPosition: any) {
  if (!drawStore.activeTool) return

  const cartesian = pickPosition(screenPosition)
  if (!cartesian) return

  const coord = cartesianToCoordinate(cartesian)

  switch (drawStore.activeTool) {
    case 'point':
      // Debounce to prevent double-click adding multiple points
      {
        const now = Date.now()
        if (now - lastClickTime < CLICK_DEBOUNCE_MS) {
          return // Ignore click within debounce period
        }
        lastClickTime = now
        handlePointClick(coord, cartesian)
      }
      break
    case 'line':
      handleLineClick(coord, cartesian)
      break
    case 'circle':
      handleCircleClick(coord, cartesian)
      break
  }
}

function handleDoubleClick(screenPosition: any) {
  if (!drawStore.activeTool) return

  const cartesian = pickPosition(screenPosition)
  if (!cartesian) return

  switch (drawStore.activeTool) {
    case 'line':
      // Complete line drawing on double-click
      if (lineVertices.value.length >= 2) {
        completeLineDrawing()
      }
      break
    case 'polygon':
      // Complete polygon drawing on double-click
      // (This will be implemented when polygon tool is added)
      break
    case 'point':
      // Ignore double-click for point tool (already debounced)
      break
    case 'circle':
      // Circle doesn't need double-click
      break
  }
}

function handleMouseMove(screenPosition: any) {
  // Handle custom panning when dragging in draw mode
  if (isDragging && drawStore.activeTool && dragStartPosition) {
    handlePanDrag(screenPosition)
    return // Don't process drawing updates while panning
  }

  if (!drawStore.activeTool) return

  const cartesian = pickPosition(screenPosition)
  if (!cartesian) return

  // Always update cursor position immediately (no throttle)
  currentCursorPosition.value = cartesian

  // Update cursor preview point immediately (no throttle for cursor)
  updateCursorPreview(cartesian)

  // Throttle other preview updates
  const now = Date.now()
  if (now - lastMoveTime < MOVE_THROTTLE_MS) return
  lastMoveTime = now

  switch (drawStore.activeTool) {
    case 'line':
      if (lineVertices.value.length > 0) {
        updateLinePreview()
      }
      break
    case 'circle':
      if (circleCenter.value) {
        updateCirclePreview()
      }
      break
  }
}

// Handle pan drag - move camera based on mouse movement
function handlePanDrag(currentPosition: any) {
  const viewer = cesiumStore.viewer
  if (!viewer || !dragStartPosition || !dragStartCameraPosition) return

  const camera = viewer.scene.camera
  const ellipsoid = viewer.scene.globe.ellipsoid

  // Calculate the movement delta
  const deltaX = currentPosition.x - dragStartPosition.x
  const deltaY = currentPosition.y - dragStartPosition.y

  // Skip if movement is too small (likely just a click)
  if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return

  // Get camera height for scaling
  const cameraHeight = ellipsoid.cartesianToCartographic(camera.position).height

  // Scale factor based on camera height (higher = faster pan)
  // Using 0.001 for reasonable pan speed that matches middle-button pan
  const scaleFactor = cameraHeight * 0.001

  // Calculate movement in camera's local coordinate system
  const right = Cesium.Cartesian3.cross(camera.direction, camera.up, new Cesium.Cartesian3())
  Cesium.Cartesian3.normalize(right, right)

  // Movement vectors (negative because we want to move opposite to drag direction)
  const rightMovement = Cesium.Cartesian3.multiplyByScalar(
    right,
    -deltaX * scaleFactor,
    new Cesium.Cartesian3()
  )
  const upMovement = Cesium.Cartesian3.multiplyByScalar(
    camera.up,
    deltaY * scaleFactor,
    new Cesium.Cartesian3()
  )

  // Apply movement to original camera position
  const newPosition = Cesium.Cartesian3.clone(dragStartCameraPosition)
  Cesium.Cartesian3.add(newPosition, rightMovement, newPosition)
  Cesium.Cartesian3.add(newPosition, upMovement, newPosition)

  // Update camera position
  camera.position = newPosition
}
function handleRightClick() {
  // Right click always cancels current drawing
  cleanupDrawingState()
}

// Point tool implementation
function handlePointClick(coord: Coordinate, cartesian: any) {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  // Create point feature
  const featureId = featureStore.generateId()

  const pointEntity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: DEFAULT_STYLE.pointSize,
      color: Cesium.Color.fromCssColorString(DEFAULT_STYLE.strokeColor),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })

  // Save entity mapping
  featureEntityMap.value.set(featureId, [pointEntity])

  // Create feature object
  const feature: PointFeature = {
    id: featureId,
    type: 'point',
    name: `点标注 ${featureId.slice(-6)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    style: { ...DEFAULT_STYLE },
    properties: {},
    visible: true,
    position: coord,
  }

  featureStore.addFeature(feature)
}

// Common cursor preview for all tools
function updateCursorPreview(cartesian: any) {
  const viewer = cesiumStore.viewer
  if (!viewer || !cartesian) return

  if (!cursorPreviewPoint.value) {
    cursorPreviewPoint.value = viewer.entities.add({
      position: cartesian,
      point: {
        pixelSize: 8,
        color: Cesium.Color.YELLOW.withAlpha(0.8),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  } else {
    // Directly update position for instant response
    cursorPreviewPoint.value.position = cartesian
  }
}

function clearCursorPreview() {
  const viewer = cesiumStore.viewer
  if (!viewer || !cursorPreviewPoint.value) return

  viewer.entities.remove(cursorPreviewPoint.value)
  cursorPreviewPoint.value = null
}

// Line tool implementation
function handleLineClick(coord: Coordinate, cartesian: any) {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  // Add vertex
  lineVertices.value.push(coord)

  // Add vertex marker
  const marker = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 8,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })

  linePreviewEntities.value.push(marker)
}

function updateLinePreview() {
  const viewer = cesiumStore.viewer
  if (!viewer || lineVertices.value.length === 0 || !currentCursorPosition.value) return

  // Remove old preview line
  const oldPreview = linePreviewEntities.value.find((e) => e.polyline)
  if (oldPreview) {
    viewer.entities.remove(oldPreview)
    linePreviewEntities.value = linePreviewEntities.value.filter((e) => e !== oldPreview)
  }

  // Create preview line using CallbackProperty for smooth animation
  const previewLine = viewer.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        if (!currentCursorPosition.value) return []
        return [
          ...lineVertices.value.map((v) => Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, v.height || 0)),
          currentCursorPosition.value,
        ]
      }, false),
      width: 4,
      arcType: Cesium.ArcType.GEODESIC,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15,
        color: Cesium.Color.CYAN.withAlpha(0.85),
      }),
    },
  })

  linePreviewEntities.value.push(previewLine)
}

function completeLineDrawing() {
  if (lineVertices.value.length < 2) return

  const viewer = cesiumStore.viewer
  if (!viewer) return

  const featureId = featureStore.generateId()
  const entities: any[] = []

  // Calculate total length
  let totalLength = 0
  for (let i = 0; i < lineVertices.value.length - 1; i++) {
    const dist = calculateDistance(lineVertices.value[i], lineVertices.value[i + 1])
    totalLength += dist
  }

  // Add final line with height from model surface
  const basePositions = lineVertices.value.map((v) =>
    Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, v.height || 0)
  )

  // 沿模型表面密集采样，使线条贴附在 3D 图上
  const positions = sampleSurfacePositions(viewer.scene, basePositions)

  const line = viewer.entities.add({
    polyline: {
      positions,
      width: DEFAULT_STYLE.strokeWidth + 1,
      arcType: Cesium.ArcType.GEODESIC,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.12,
        color: Cesium.Color.fromCssColorString(DEFAULT_STYLE.strokeColor),
      }),
    },
  })
  entities.push(line)

  // Add length label at midpoint
  const midIndex = Math.floor(lineVertices.value.length / 2)
  const midVert = lineVertices.value[midIndex]
  const midPoint = Cesium.Cartesian3.fromDegrees(
    midVert.longitude,
    midVert.latitude,
    (midVert.height || 0) + 5
  )

  const lengthText =
    totalLength > 1000 ? `${(totalLength / 1000).toFixed(2)} km` : `${totalLength.toFixed(2)} m`

  const label = viewer.entities.add({
    position: midPoint,
    label: {
      text: lengthText,
      font: '14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -10),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  entities.push(label)

  // Save entity mapping
  featureEntityMap.value.set(featureId, entities)

  // Create feature
  const feature: LineFeature = {
    id: featureId,
    type: 'line',
    name: `线路径 ${featureId.slice(-6)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    style: { ...DEFAULT_STYLE },
    properties: {},
    visible: true,
    vertices: [...lineVertices.value],
    length: totalLength,
    lineType: 'solid',
  }

  featureStore.addFeature(feature)

  // Clean up
  clearLineDrawingState()
}

function clearLineDrawingState() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  linePreviewEntities.value.forEach((entity) => {
    viewer.entities.remove(entity)
  })

  lineVertices.value = []
  linePreviewEntities.value = []
}

// Circle tool implementation
function handleCircleClick(coord: Coordinate, _cartesian: any) {
  if (!circleCenter.value) {
    // First click - set center
    circleCenter.value = coord
  } else {
    // Second click - complete circle
    completeCircleMeasurement()
  }
}

function updateCirclePreview() {
  const viewer = cesiumStore.viewer
  if (!viewer || !circleCenter.value) return

  if (!circlePreview.value) {
    const centerPos = Cesium.Cartesian3.fromDegrees(
      circleCenter.value.longitude,
      circleCenter.value.latitude,
      circleCenter.value.height || 0
    )

    circlePreview.value = viewer.entities.add({
      position: centerPos,
      ellipse: {
        semiMinorAxis: new Cesium.CallbackProperty(() => {
          if (!circleCenter.value || !currentCursorPosition.value) return 0
          const curCoord = cartesianToCoordinate(currentCursorPosition.value)
          return calculateDistance(circleCenter.value, curCoord)
        }, false),
        semiMajorAxis: new Cesium.CallbackProperty(() => {
          if (!circleCenter.value || !currentCursorPosition.value) return 0
          const curCoord = cartesianToCoordinate(currentCursorPosition.value)
          return calculateDistance(circleCenter.value, curCoord)
        }, false),
        material: Cesium.Color.fromCssColorString(DEFAULT_STYLE.fillColor),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(DEFAULT_STYLE.strokeColor),
        outlineWidth: DEFAULT_STYLE.strokeWidth,
      },
    })
  }
}

function completeCircleMeasurement() {
  if (!circleCenter.value || !currentCursorPosition.value) return

  const viewer = cesiumStore.viewer
  if (!viewer) return

  const featureId = featureStore.generateId()
  const curCoord = cartesianToCoordinate(currentCursorPosition.value)
  const radius = calculateDistance(circleCenter.value, curCoord)
  const area = Math.PI * radius * radius

  const centerPos = Cesium.Cartesian3.fromDegrees(
    circleCenter.value.longitude,
    circleCenter.value.latitude,
    circleCenter.value.height || 0
  )

  // Add circle
  const circle = viewer.entities.add({
    position: centerPos,
    ellipse: {
      semiMinorAxis: radius,
      semiMajorAxis: radius,
      material: Cesium.Color.fromCssColorString(DEFAULT_STYLE.fillColor),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString(DEFAULT_STYLE.strokeColor),
      outlineWidth: DEFAULT_STYLE.strokeWidth,
    },
  })

  // Add label
  const areaText = area > 1000000 ? `${(area / 1000000).toFixed(2)} km²` : `${area.toFixed(2)} m²`

  const radiusText = radius > 1000 ? `${(radius / 1000).toFixed(2)} km` : `${radius.toFixed(2)} m`

  const label = viewer.entities.add({
    position: centerPos,
    label: {
      text: `${areaText}\n半径: ${radiusText}`,
      font: '14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })

  // Save entities
  featureEntityMap.value.set(featureId, [circle, label])

  // Create feature
  const feature: CircleFeature = {
    id: featureId,
    type: 'circle',
    name: `圆形 ${featureId.slice(-6)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    style: { ...DEFAULT_STYLE },
    properties: {},
    visible: true,
    center: circleCenter.value,
    radius,
    area,
  }

  featureStore.addFeature(feature)

  // Clean up
  clearCircleDrawingState()
}

function clearCircleDrawingState() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  if (circlePreview.value) {
    viewer.entities.remove(circlePreview.value)
    circlePreview.value = null
  }

  circleCenter.value = null
}

// Utility functions
function pickPosition(screenPosition: any) {
  const viewer = cesiumStore.viewer
  if (!viewer) return null

  const scene = viewer.scene
  return scene.pickPosition(screenPosition) || scene.camera.pickEllipsoid(screenPosition)
}

function cartesianToCoordinate(cartesian: any): Coordinate {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height,
  }
}

function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const pos1 = Cesium.Cartesian3.fromDegrees(coord1.longitude, coord1.latitude, coord1.height || 0)
  const pos2 = Cesium.Cartesian3.fromDegrees(coord2.longitude, coord2.latitude, coord2.height || 0)

  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromCartesian(pos1),
    Cesium.Cartographic.fromCartesian(pos2)
  )

  return geodesic.surfaceDistance
}

function cleanupDrawingState() {
  clearCursorPreview()
  clearLineDrawingState()
  clearCircleDrawingState()
  currentCursorPosition.value = null
}

function cleanup() {
  if (handler) {
    handler.destroy()
    handler = null
  }
  cleanupDrawingState()
  restoreDefaultDoubleClick()
  restoreCameraControls()
}

// Configure camera controls for drawing mode
// In 3D mode: disable default left-drag rotate, allow middle/right drag for navigation
function disableCameraControls() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const scene = viewer.scene
  const controller = scene.screenSpaceCameraController

  if (!previousCameraControllerState) {
    // Clone the event types to preserve original settings
    previousCameraControllerState = {
      enableZoom: controller.enableZoom,
      enableTranslate: controller.enableTranslate,
      enableRotate: controller.enableRotate,
      enableTilt: controller.enableTilt,
      enableLook: controller.enableLook,
      enableCollisionDetection: controller.enableCollisionDetection,
      translateEventTypes: cloneEventTypes(controller.translateEventTypes),
      zoomEventTypes: cloneEventTypes(controller.zoomEventTypes),
      tiltEventTypes: cloneEventTypes(controller.tiltEventTypes),
      rotateEventTypes: cloneEventTypes(controller.rotateEventTypes),
      lookEventTypes: cloneEventTypes(controller.lookEventTypes),
      minimumZoomDistance: controller.minimumZoomDistance,
      maximumZoomDistance: controller.maximumZoomDistance,
    }
  }

  // Enable all camera controls
  controller.enableZoom = true
  controller.enableTranslate = true
  controller.enableRotate = true
  controller.enableTilt = true
  controller.enableLook = true
  controller.enableCollisionDetection = false

  // Key insight: In Cesium's 3D mode (globe view):
  // - "rotate" is actually the orbit/look-around behavior
  // - "translate" only works in 2D/Columbus view
  // - "look" is for first-person camera rotation
  //
  // To achieve "pan" effect with left-drag in 3D:
  // Option 1: Remove left-drag from all controllers (no camera movement on left-drag)
  // Option 2: Use a custom handler to implement pan
  //
  // For now, let's remove left-drag from camera controls entirely
  // so drawing works without accidental camera movement

  // Empty array or undefined removes the event binding
  // Rotate: only middle drag
  controller.rotateEventTypes = [Cesium.CameraEventType.MIDDLE_DRAG]

  // Tilt: Ctrl + middle drag
  controller.tiltEventTypes = [
    { eventType: Cesium.CameraEventType.MIDDLE_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
  ]

  // Look: Shift + left drag (for free look if needed)
  controller.lookEventTypes = [
    { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.SHIFT },
  ]

  // Translate: Removed from left drag in 3D (only works in 2D anyway)
  controller.translateEventTypes = []

  // Zoom: wheel, pinch, and right drag
  controller.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH,
    Cesium.CameraEventType.RIGHT_DRAG,
  ]

  console.log('绘制模式已启用：')
  console.log('  - 左键点击/双击 = 绘制操作')
  console.log('  - 中键拖拽 = 旋转视角')
  console.log('  - 右键拖拽 = 缩放')
  console.log('  - 滚轮 = 缩放')
  console.log('  - Shift+左键拖拽 = 自由视角')
}

// Helper function to clone event types
function cloneEventTypes(eventTypes: any): any {
  if (!eventTypes) return eventTypes
  if (Array.isArray(eventTypes)) {
    return eventTypes.map((et) => {
      if (typeof et === 'object' && et !== null) {
        return { ...et }
      }
      return et
    })
  }
  if (typeof eventTypes === 'object') {
    return { ...eventTypes }
  }
  return eventTypes
}

// Restore camera controls
function restoreCameraControls() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const scene = viewer.scene
  const controller = scene.screenSpaceCameraController

  if (previousCameraControllerState) {
    controller.enableZoom = previousCameraControllerState.enableZoom
    controller.enableTranslate = previousCameraControllerState.enableTranslate
    controller.enableRotate = previousCameraControllerState.enableRotate
    controller.enableTilt = previousCameraControllerState.enableTilt
    controller.enableLook = previousCameraControllerState.enableLook
    controller.enableCollisionDetection = previousCameraControllerState.enableCollisionDetection
    controller.translateEventTypes = previousCameraControllerState.translateEventTypes
    controller.zoomEventTypes = previousCameraControllerState.zoomEventTypes
    controller.tiltEventTypes = previousCameraControllerState.tiltEventTypes
    controller.rotateEventTypes = previousCameraControllerState.rotateEventTypes
    controller.lookEventTypes = previousCameraControllerState.lookEventTypes
    previousCameraControllerState = null
  } else {
    controller.enableZoom = true
    controller.enableRotate = true
    controller.enableTilt = true
    controller.enableLook = true
    controller.enableTranslate = true
    controller.enableCollisionDetection = true
  }
}

function disableDefaultDoubleClick() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const eventHandler = viewer.cesiumWidget?.screenSpaceEventHandler
  if (!eventHandler) return

  const existingAction = eventHandler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  if (existingAction) {
    defaultLeftDoubleClickAction = existingAction
    eventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  }
}

function restoreDefaultDoubleClick() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const eventHandler = viewer.cesiumWidget?.screenSpaceEventHandler
  if (eventHandler && defaultLeftDoubleClickAction) {
    eventHandler.setInputAction(
      defaultLeftDoubleClickAction,
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    )
    defaultLeftDoubleClickAction = null
  }
}

// Watch for feature deletions
watch(
  () => featureStore.features,
  (newFeatures, oldFeatures) => {
    if (!oldFeatures) return

    const oldIds = new Set(oldFeatures.map((f) => f.id))
    const newIds = new Set(newFeatures.map((f) => f.id))

    oldIds.forEach((id) => {
      if (!newIds.has(id)) {
        removeFeatureEntities(id)
      }
    })

    if (newFeatures.length === 0 && oldFeatures.length > 0) {
      removeAllFeatureEntities()
    }
  },
  { deep: true }
)

function removeFeatureEntities(id: string) {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  const entities = featureEntityMap.value.get(id)
  if (entities) {
    entities.forEach((entity) => {
      try {
        viewer.entities.remove(entity)
      } catch (e) {
        console.warn('Failed to remove entity:', e)
      }
    })
    featureEntityMap.value.delete(id)
  }
}

function removeAllFeatureEntities() {
  const viewer = cesiumStore.viewer
  if (!viewer) return

  featureEntityMap.value.forEach((entities) => {
    entities.forEach((entity) => {
      try {
        viewer.entities.remove(entity)
      } catch (e) {
        console.warn('Failed to remove entity:', e)
      }
    })
  })
  featureEntityMap.value.clear()
}
</script>

<style scoped>
/* No styles needed for logical component */
</style>
