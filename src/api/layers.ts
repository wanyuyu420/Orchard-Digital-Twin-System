/**
 * GIS Layer API - 图层配置增删改查（对应后端 app/api/layers.py）
 */
import { apiClient } from './client'

/** 新建图层入参（镜像后端 LayerCreate） */
export interface LayerCreateInput {
  code: string
  name: string
  group_name?: string | null
  layer_type: string
  url?: string | null
  is_visible?: boolean
  is_enabled?: boolean
  icon?: string | null
  config?: Record<string, unknown> | null
  order?: number
  description?: string | null
}

/** 更新图层入参（镜像后端 LayerUpdate） */
export interface LayerUpdateInput {
  name?: string
  group_name?: string | null
  url?: string | null
  is_visible?: boolean
  is_enabled?: boolean
  icon?: string | null
  config?: Record<string, unknown> | null
  order?: number
  description?: string | null
}

/** 新建图层 */
export function createLayer(data: LayerCreateInput) {
  return apiClient.post('/layers', data)
}

/** 更新图层 */
export function updateLayer(id: number, data: LayerUpdateInput) {
  return apiClient.put(`/layers/${id}`, data)
}

/** 删除图层 */
export function deleteLayer(id: number) {
  return apiClient.delete(`/layers/${id}`)
}

/**
 * 切换图层显隐（后端为 query 参数 visible，非 body）
 * PATCH /layers/{id}/visibility?visible=...
 */
export function setLayerVisibility(id: number, visible: boolean) {
  return apiClient.patch(`/layers/${id}/visibility`, null, {
    params: { visible },
  })
}
