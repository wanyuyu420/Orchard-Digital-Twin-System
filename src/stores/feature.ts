// GIS 要素管理状态

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Feature,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  HistoryEntry,
  HistoryStack,
  PointFeature,
  LineFeature,
  PolygonFeature,
} from '@/types/feature'
import type { Coordinate } from '@/types/measure'

export const useFeatureStore = defineStore('feature', () => {
  // 要素列表
  const features = ref<Feature[]>([])

  // 选中的要素 ID 集合
  const selectedFeatureIds = ref<Set<string>>(new Set())

  // 历史记录栈
  const history = ref<HistoryStack>({
    entries: [],
    currentIndex: -1,
    maxSize: 50,
  })

  // 计算属性：按类型分组的要素
  const featuresByType = computed(() => {
    const grouped: Record<string, Feature[]> = {}
    features.value.forEach((feature) => {
      if (!grouped[feature.type]) {
        grouped[feature.type] = []
      }
      grouped[feature.type].push(feature)
    })
    return grouped
  })

  // 计算属性：选中的要素
  const selectedFeatures = computed(() => {
    return features.value.filter((f) => selectedFeatureIds.value.has(f.id))
  })

  // 计算属性：是否可以撤销
  const canUndo = computed(() => history.value.currentIndex >= 0)

  // 计算属性：是否可以重做
  const canRedo = computed(() => {
    return history.value.currentIndex < history.value.entries.length - 1
  })

  // 生成唯一 ID
  function generateId(): string {
    return `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加要素
  function addFeature(feature: Feature) {
    features.value.push(feature)

    // 记录历史
    addHistoryEntry({
      id: generateId(),
      action: 'add',
      timestamp: new Date(),
      featureId: feature.id,
      afterState: feature,
    })
  }

  // 更新要素
  function updateFeature(id: string, updates: Partial<Feature>) {
    const index = features.value.findIndex((f) => f.id === id)
    if (index === -1) return

    const beforeState = features.value[index]
    // Use Object.assign to preserve type
    features.value[index] = Object.assign({}, features.value[index], updates, {
      updatedAt: new Date(),
    })

    // 记录历史
    addHistoryEntry({
      id: generateId(),
      action: 'update',
      timestamp: new Date(),
      featureId: id,
      beforeState,
      afterState: features.value[index],
    })
  }

  // 删除要素
  function deleteFeature(id: string) {
    const index = features.value.findIndex((f) => f.id === id)
    if (index === -1) return

    const deletedFeature = features.value[index]
    features.value.splice(index, 1)

    // 从选中集合中移除
    selectedFeatureIds.value.delete(id)

    // 记录历史
    addHistoryEntry({
      id: generateId(),
      action: 'delete',
      timestamp: new Date(),
      featureId: id,
      beforeState: deletedFeature,
    })
  }

  // 批量删除要素
  function deleteFeatures(ids: string[]) {
    ids.forEach((id) => deleteFeature(id))
  }

  // 清空所有要素
  function clearAllFeatures() {
    features.value = []
    selectedFeatureIds.value.clear()
    history.value.entries = []
    history.value.currentIndex = -1
  }

  // 选中要素
  function selectFeature(id: string, multi = false) {
    if (!multi) {
      selectedFeatureIds.value.clear()
    }
    selectedFeatureIds.value.add(id)
  }

  // 取消选中要素
  function deselectFeature(id: string) {
    selectedFeatureIds.value.delete(id)
  }

  // 切换选中状态
  function toggleFeatureSelection(id: string) {
    if (selectedFeatureIds.value.has(id)) {
      selectedFeatureIds.value.delete(id)
    } else {
      selectedFeatureIds.value.add(id)
    }
  }

  // 全选
  function selectAll() {
    features.value.forEach((f) => selectedFeatureIds.value.add(f.id))
  }

  // 取消所有选中
  function deselectAll() {
    selectedFeatureIds.value.clear()
  }

  // 反选
  function invertSelection() {
    const newSelection = new Set<string>()
    features.value.forEach((f) => {
      if (!selectedFeatureIds.value.has(f.id)) {
        newSelection.add(f.id)
      }
    })
    selectedFeatureIds.value = newSelection
  }

  // 切换要素可见性
  function toggleFeatureVisibility(id: string) {
    const feature = features.value.find((f) => f.id === id)
    if (feature) {
      updateFeature(id, { visible: !feature.visible })
    }
  }

  // 添加历史记录
  function addHistoryEntry(entry: HistoryEntry) {
    // 如果不在历史栈顶部，删除后面的记录
    if (history.value.currentIndex < history.value.entries.length - 1) {
      history.value.entries.splice(history.value.currentIndex + 1)
    }

    // 添加新记录
    history.value.entries.push(entry)
    history.value.currentIndex++

    // 限制历史记录数量
    if (history.value.entries.length > history.value.maxSize) {
      history.value.entries.shift()
      history.value.currentIndex--
    }
  }

  // 撤销
  function undo() {
    if (!canUndo.value) return

    const entry = history.value.entries[history.value.currentIndex]

    switch (entry.action) {
      case 'add':
        // 撤销添加 = 删除（不记录历史）
        {
          const index = features.value.findIndex((f) => f.id === entry.featureId)
          if (index !== -1) {
            features.value.splice(index, 1)
          }
        }
        break

      case 'delete':
        // 撤销删除 = 恢复
        if (entry.beforeState) {
          features.value.push(entry.beforeState as Feature)
        }
        break

      case 'update':
      case 'style':
      case 'move':
        // 撤销更新 = 恢复旧状态
        if (entry.beforeState) {
          const index = features.value.findIndex((f) => f.id === entry.featureId)
          if (index !== -1) {
            features.value[index] = Object.assign({}, features.value[index], entry.beforeState)
          }
        }
        break
    }

    history.value.currentIndex--
  }

  // 重做
  function redo() {
    if (!canRedo.value) return

    history.value.currentIndex++
    const entry = history.value.entries[history.value.currentIndex]

    switch (entry.action) {
      case 'add':
        // 重做添加
        if (entry.afterState) {
          features.value.push(entry.afterState as Feature)
        }
        break

      case 'delete':
        // 重做删除
        {
          const index = features.value.findIndex((f) => f.id === entry.featureId)
          if (index !== -1) {
            features.value.splice(index, 1)
          }
        }
        break

      case 'update':
      case 'style':
      case 'move':
        // 重做更新
        if (entry.afterState) {
          const index = features.value.findIndex((f) => f.id === entry.featureId)
          if (index !== -1) {
            features.value[index] = Object.assign({}, features.value[index], entry.afterState)
          }
        }
        break
    }
  }

  // 导出为 GeoJSON
  function exportGeoJSON(selectedOnly = false): GeoJSONFeatureCollection {
    const featuresToExport = selectedOnly ? selectedFeatures.value : features.value

    const geoJSONFeatures: GeoJSONFeature[] = featuresToExport.map((feature) => {
      let geometry: GeoJSONFeature['geometry']

      switch (feature.type) {
        case 'point':
          geometry = {
            type: 'Point',
            coordinates: [feature.position.longitude, feature.position.latitude],
          }
          break

        case 'line':
          geometry = {
            type: 'LineString',
            coordinates: feature.vertices.map((v) => [v.longitude, v.latitude]),
          }
          break

        case 'polygon':
        case 'area':
          geometry = {
            type: 'Polygon',
            coordinates: [feature.vertices.map((v) => [v.longitude, v.latitude])],
          }
          break

        case 'circle':
          // 圆形转为多边形（32个点近似）
          {
            const points: number[][] = []
            const numPoints = 32
            for (let i = 0; i <= numPoints; i++) {
              const angle = (i / numPoints) * 2 * Math.PI
              const offset = feature.radius / 111320 // 粗略转换为度
              const lon = feature.center.longitude + offset * Math.cos(angle)
              const lat = feature.center.latitude + offset * Math.sin(angle)
              points.push([lon, lat])
            }
            geometry = {
              type: 'Polygon',
              coordinates: [points],
            }
          }
          break

        case 'rectangle':
          geometry = {
            type: 'Polygon',
            coordinates: [
              [
                [feature.southwest.longitude, feature.southwest.latitude],
                [feature.northeast.longitude, feature.southwest.latitude],
                [feature.northeast.longitude, feature.northeast.latitude],
                [feature.southwest.longitude, feature.northeast.latitude],
                [feature.southwest.longitude, feature.southwest.latitude],
              ],
            ],
          }
          break

        case 'distance':
          geometry = {
            type: 'LineString',
            coordinates: [
              [feature.startPoint.longitude, feature.startPoint.latitude],
              [feature.endPoint.longitude, feature.endPoint.latitude],
            ],
          }
          break

        default:
          geometry = {
            type: 'Point',
            coordinates: [0, 0],
          }
      }

      return {
        type: 'Feature',
        id: feature.id,
        geometry,
        properties: {
          name: feature.name,
          description: feature.description,
          type: feature.type,
          style: feature.style,
          ...feature.properties,
        },
      }
    })

    return {
      type: 'FeatureCollection',
      features: geoJSONFeatures,
      crs: {
        type: 'name',
        properties: {
          name: 'EPSG:4326',
        },
      },
    }
  }

  // 从 GeoJSON 导入
  function importGeoJSON(geoJSON: GeoJSONFeatureCollection): { success: number; failed: number } {
    let success = 0
    let failed = 0

    geoJSON.features.forEach((geoFeature) => {
      try {
        const { geometry, properties } = geoFeature
        const id = generateId()
        const now = new Date()

        switch (geometry.type) {
          case 'Point':
            {
              const [lon, lat] = geometry.coordinates as number[]
              const pointFeature: PointFeature = {
                id,
                type: 'point',
                name: properties?.name || `Point ${id.slice(-6)}`,
                description: properties?.description,
                createdAt: now,
                updatedAt: now,
                style: properties?.style || {
                  fillColor: '#ffcc33',
                  strokeColor: '#ffcc33',
                  strokeWidth: 3,
                  pointSize: 10,
                  opacity: 1,
                },
                properties: properties || {},
                visible: true,
                position: { longitude: lon, latitude: lat },
              }
              features.value.push(pointFeature)
              success++
            }
            break

          case 'LineString':
            {
              const coords = geometry.coordinates as number[][]
              const vertices: Coordinate[] = coords.map(([lon, lat]) => ({
                longitude: lon,
                latitude: lat,
              }))
              const lineFeature: LineFeature = {
                id,
                type: 'line',
                name: properties?.name || `Line ${id.slice(-6)}`,
                description: properties?.description,
                createdAt: now,
                updatedAt: now,
                style: properties?.style || {
                  fillColor: '#ffcc33',
                  strokeColor: '#ffcc33',
                  strokeWidth: 3,
                  pointSize: 10,
                  opacity: 1,
                },
                properties: properties || {},
                visible: true,
                vertices,
                length: 0, // 需要重新计算
                lineType: 'solid',
              }
              features.value.push(lineFeature)
              success++
            }
            break

          case 'Polygon':
            {
              const coords = (geometry.coordinates as number[][][])[0]
              const vertices: Coordinate[] = coords.map(([lon, lat]) => ({
                longitude: lon,
                latitude: lat,
              }))
              const polygonFeature: PolygonFeature = {
                id,
                type: 'polygon',
                name: properties?.name || `Polygon ${id.slice(-6)}`,
                description: properties?.description,
                createdAt: now,
                updatedAt: now,
                style: properties?.style || {
                  fillColor: 'rgba(255, 204, 51, 0.3)',
                  strokeColor: '#ffcc33',
                  strokeWidth: 3,
                  pointSize: 10,
                  opacity: 1,
                },
                properties: properties || {},
                visible: true,
                vertices,
                area: 0, // 需要重新计算
              }
              features.value.push(polygonFeature)
              success++
            }
            break

          default:
            failed++
        }
      } catch (error) {
        console.error('导入要素失败:', error)
        failed++
      }
    })

    return { success, failed }
  }

  return {
    // State
    features,
    selectedFeatureIds,
    history,

    // Computed
    featuresByType,
    selectedFeatures,
    canUndo,
    canRedo,

    // Actions
    generateId,
    addFeature,
    updateFeature,
    deleteFeature,
    deleteFeatures,
    clearAllFeatures,
    selectFeature,
    deselectFeature,
    toggleFeatureSelection,
    selectAll,
    deselectAll,
    invertSelection,
    toggleFeatureVisibility,
    undo,
    redo,
    exportGeoJSON,
    importGeoJSON,
  }
})
