import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MeasureToolType, Measurement, DrawingState } from '@/types/measure'

export const useMeasureStore = defineStore('measure', () => {
  // Active tool state
  const activeTool = ref<MeasureToolType>(null)

  // Measurement history
  const measurements = ref<Measurement[]>([])

  // Current drawing state
  const currentDrawing = ref<DrawingState>({
    isDrawing: false,
    toolType: null,
    vertices: [],
  })

  // Actions
  function setTool(tool: MeasureToolType) {
    activeTool.value = tool
    if (tool) {
      resetDrawing()
    }
  }

  function addMeasurement(measurement: Measurement) {
    measurements.value.push(measurement)
  }

  function removeMeasurement(id: string) {
    const index = measurements.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      measurements.value.splice(index, 1)
    }
  }

  function clearAll() {
    measurements.value = []
    resetDrawing()
  }

  function resetDrawing() {
    currentDrawing.value = {
      isDrawing: false,
      toolType: activeTool.value,
      vertices: [],
    }
  }

  function startDrawing() {
    currentDrawing.value.isDrawing = true
    currentDrawing.value.toolType = activeTool.value
    currentDrawing.value.vertices = []
  }

  function cancelDrawing() {
    resetDrawing()
  }

  return {
    // State
    activeTool,
    measurements,
    currentDrawing,

    // Actions
    setTool,
    addMeasurement,
    removeMeasurement,
    clearAll,
    resetDrawing,
    startDrawing,
    cancelDrawing,
  }
})
