import { apiClient } from './client'
import type {
  FruitTreePoi,
  TsomQueryParams,
  TsomQueryResult,
  FertilizationPlan,
  AnalysisResult,
  UploadedFile,
  RenderParams,
  GeoServerLayer,
} from '@/types/orchard'

/** 根据POI ID获取果树详细信息 */
export function getFruitTreeById(id: string) {
  return apiClient.get<FruitTreePoi>(`/orchard/trees/${id}`)
}

/** TSOM空间查询 - 根据绘制范围查询果树POI */
export function queryTsom(params: TsomQueryParams) {
  return apiClient.post<TsomQueryResult>('/orchard/tsom/query', params)
}

/** 精细查询 - 查询所有符合条件的果树（不需要绘制范围） */
export function queryTreesByFilter(params: TsomQueryParams) {
  return apiClient.post<TsomQueryResult>('/orchard/trees/filter', params)
}

/** 获取园区统计数据 */
export function getOrchardStatistics(orchardId: string) {
  return apiClient.get(`/orchard/${orchardId}/statistics`)
}

/** 获取所有园区列表 */
export function getOrchardList() {
  return apiClient.get('/orchard/list')
}

/** 获取指定园区的所有果树 */
export function getOrchardTrees(orchardId: string, page = 1, pageSize = 100) {
  return apiClient.get(`/orchard/${orchardId}/trees`, { params: { page, page_size: pageSize } })
}

/** 获取分析结果 */
export function getAnalysisResult(analysisId: string) {
  return apiClient.get<AnalysisResult>(`/analysis/${analysisId}`)
}

/** 获取分析结果列表 */
export function getAnalysisResults(params?: { type?: string; status?: string }) {
  return apiClient.get<AnalysisResult[]>('/analysis/list', { params })
}

/** 获取施肥方案 */
export function getFertilizationPlan(planId: string) {
  return apiClient.get<FertilizationPlan>(`/fertilization/${planId}`)
}

/** 获取施肥方案列表 */
export function getFertilizationPlans(orchardId?: string) {
  return apiClient.get<FertilizationPlan[]>('/fertilization/list', {
    params: orchardId ? { orchard_id: orchardId } : {},
  })
}

/** 保存/更新颜色渲染参数 */
export function saveRenderParams(params: RenderParams) {
  return apiClient.post('/render/params', params)
}

/** 获取当前渲染参数 */
export function getRenderParams() {
  return apiClient.get<RenderParams>('/render/params')
}

/** 获取GeoServer图层配置 */
export function getGeoserverLayers() {
  return apiClient.get<GeoServerLayer[]>('/geoserver/layers')
}

/** 上传文件 - 返回上传任务信息 */
export function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ data: UploadedFile }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10分钟超时
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total))
      }
    },
  })
}

/** 获取上传文件列表 */
export function getUploadedFiles() {
  return apiClient.get<UploadedFile[]>('/upload/files')
}

/** 删除上传文件 */
export function deleteUploadedFile(fileId: string) {
  return apiClient.delete(`/upload/files/${fileId}`)
}

/** 下载分析结果文件 */
export function downloadAnalysisFile(fileId: string) {
  return apiClient.get(`/download/${fileId}`, { responseType: 'blob' })
}

/** 获取上传文件的子级分析文件 */
export function getChildFiles(parentId: string) {
  return apiClient.get<UploadedFile[]>(`/upload/files/${parentId}/children`)
}

/** 获取冠层图表统计数据 */
export function getChartStatistics() {
  return apiClient.get('/orchard/chart-data')
}
