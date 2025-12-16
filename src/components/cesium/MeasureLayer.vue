<template>
  <!-- This is a logical component with no template -->
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { useCesiumStore } from '@/stores/cesium'
import { useGISStore } from '@/stores/gis'
import { MeasureTool } from '@/cesium/gis/tools/MeasureTool'
import type { MeasureToolType } from '@/types/measure'

declare const Cesium: any

const cesiumStore = useCesiumStore()
const gisStore = useGISStore()

// Current active tool instance
const currentTool = shallowRef<MeasureTool | null>(null)

onMounted(() => {
  // Set viewer in GIS store
  if (cesiumStore.viewer) {
    gisStore.setViewer(cesiumStore.viewer)
  }
})

onUnmounted(() => {
  cleanup()
})

// Watch for tool type changes (backward compatibility with old measure store API)
watch(
  () => gisStore.toolType,
  (newToolType, oldToolType) => {
    if (oldToolType) {
      deactivateTool()
    }

    if (newToolType && isMeasureTool(newToolType)) {
      activateTool(newToolType as MeasureToolType)
    }
  }
)

/**
 * Check if tool type is a measurement tool
 */
function isMeasureTool(toolType: string | null): boolean {
  if (!toolType) return false
  return (
    toolType === 'measure-distance' ||
    toolType === 'measure-area' ||
    toolType === 'distance' ||
    toolType === 'area'
  )
}

/**
 * Activate measurement tool
 */
function activateTool(toolType: string) {
  const viewer = cesiumStore.viewer
  if (!viewer) {
    console.warn('Cesium viewer not ready')
    return
  }

  // Determine measure type from tool type
  const measureType =
    toolType === 'measure-distance' || toolType === 'distance'
      ? ('distance' as MeasureToolType)
      : ('area' as MeasureToolType)

  try {
    // Create new tool instance
    const tool = new MeasureTool(viewer, {
      measureType: measureType,
      onComplete: (measurement) => {
        // Add measurement to store
        gisStore.addMeasurement(measurement)

        // If not in continuous mode, deactivate tool
        if (!gisStore.continuousMode) {
          gisStore.deactivateTool()
        }
      },
      onCancel: () => {
        // User cancelled measurement
        console.log('Measurement cancelled')
      },
    })

    // Activate the tool
    tool.activate()

    // Store tool instance
    currentTool.value = tool

    // Update store state
    gisStore.startDrawing()
  } catch (error) {
    console.error('Failed to activate measurement tool:', error)
  }
}

/**
 * Deactivate current tool
 */
function deactivateTool() {
  if (currentTool.value) {
    currentTool.value.deactivate()
    currentTool.value.destroy()
    currentTool.value = null
  }
}

/**
 * Cleanup on unmount
 */
function cleanup() {
  deactivateTool()

  // Remove all measurement entities
  const viewer = cesiumStore.viewer
  if (viewer) {
    const entitiesToRemove: any[] = []

    viewer.entities.values.forEach((entity: any) => {
      if (
        entity.id &&
        (entity.id.startsWith('measure_') ||
          entity.id.includes('_line') ||
          entity.id.includes('_label') ||
          entity.id.includes('_polygon'))
      ) {
        entitiesToRemove.push(entity)
      }
    })

    entitiesToRemove.forEach((entity) => {
      viewer.entities.remove(entity)
    })
  }
}

// Watch for measurement removals to clean up entities
watch(
  () => gisStore.measurements.length,
  () => {
    // When measurements are cleared, remove all measurement entities
    if (gisStore.measurements.length === 0) {
      cleanup()
    }
  }
)

// Watch for individual measurement removals
const previousMeasurementIds = new Set<string>()
watch(
  () => gisStore.measurements,
  (newMeasurements) => {
    const currentIds = new Set(newMeasurements.map((m) => m.id))

    // Find removed measurement IDs
    const removedIds = Array.from(previousMeasurementIds).filter((id) => !currentIds.has(id))

    // Remove entities for deleted measurements
    const viewer = cesiumStore.viewer
    if (viewer && removedIds.length > 0) {
      removedIds.forEach((id) => {
        const lineEntity = viewer.entities.getById(`${id}_line`)
        const labelEntity = viewer.entities.getById(`${id}_label`)
        const polygonEntity = viewer.entities.getById(`${id}_polygon`)

        if (lineEntity) viewer.entities.remove(lineEntity)
        if (labelEntity) viewer.entities.remove(labelEntity)
        if (polygonEntity) viewer.entities.remove(polygonEntity)
      })
    }

    // Update previous IDs
    previousMeasurementIds.clear()
    currentIds.forEach((id) => previousMeasurementIds.add(id))
  },
  { deep: true }
)
</script>

<style scoped>
/* No styles needed for logical component */
</style>
