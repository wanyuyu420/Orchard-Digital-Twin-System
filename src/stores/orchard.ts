import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElNotification } from 'element-plus'
import type {
  FruitTreePoi,
  TsomQueryParams,
  TsomQueryResult,
  OrchardStatistics,
  RenderParams,
  AnalysisResult,
  FertilizationPlan,
  UploadedFile,
  GeoServerLayer,
  QueryLevel,
  ModuleMenuItem,
  ChartStatistics,
  UploadPlotTask,
} from '@/types/orchard'
import { DEFAULT_RENDER_PARAMS } from '@/types/orchard'
import { useGISStore } from '@/stores/gis'
import * as orchardApi from '@/api/orchard'
import { growthIndexToHealth } from '@/utils/spatial'

export const useOrchardStore = defineStore('orchard', () => {
  // ---- 模块菜单 ----
  const menuItems = ref<ModuleMenuItem[]>([
    {
      id: 'orchard-dashboard',
      label: '果园态势',
      icon: 'fa-solid fa-seedling',
    },
    {
      id: 'canopy-analysis',
      label: '冠层解析',
      icon: 'fa-solid fa-cubes',
    },
    {
      id: 'agri-decision',
      label: '农情决策',
      icon: 'fa-solid fa-chart-line',
    },
    {
      id: 'data-management',
      label: '数据管理',
      icon: 'fa-solid fa-folder-tree',
    },
  ])

  // ---- 查询级联 ----
  const queryLevel = ref<QueryLevel>('menu')
  const activeQueryModule = ref<string | null>(null)
  const showQueryPanel = ref(false)
  const showResultPanel = ref(false)
  const showDetailPanel = ref(false)

  // ---- 果树数据 ----
  const selectedPois = ref<FruitTreePoi[]>([])
  const tsomQueryResult = ref<TsomQueryResult | null>(null)
  const orchardStatistics = ref<OrchardStatistics | null>(null)

  // ---- 历史老树（开屏拾取点） ----
  const historicalTreesLoading = ref(false)
  const historicalTreePois = ref<FruitTreePoi[]>([])
  const historicalTreesVisible = ref(true)

  // ---- 选择范围 ----
  const selectionRange = ref<{
    type: 'rectangle' | 'circle' | 'polygon'
    coordinates: any
    radius?: number
  } | null>(null)

  // ---- 渲染参数 ----
  const renderParams = ref<RenderParams>({ ...DEFAULT_RENDER_PARAMS })
  const useDefaultParams = ref(true)
  const showRenderSettings = ref(false)

  // ---- 文件上传 ----
  const uploadedFiles = ref<UploadedFile[]>([])
  const activeFileId = ref<string | null>(null)
  const showUploadPanel = ref(false)

  // ---- 分析结果 ----
  const analysisResults = ref<AnalysisResult[]>([])
  const activeAnalysisId = ref<string | null>(null)
  const showAnalysisWindow = ref(false)

  // ---- 施肥方案 ----
  const fertilizationPlans = ref<FertilizationPlan[]>([])
  const activeFertilizationId = ref<string | null>(null)
  const showFertilizationWindow = ref(false)
  /** 用户上传后是否自动弹出施肥窗口 */
  const autoShowFertilization = ref(true)
  /** 用户上传后是否自动弹出分析窗口 */
  const autoShowAnalysis = ref(true)

  // ---- GeoServer图层 ----
  const geoServerLayers = ref<GeoServerLayer[]>([])
  const activeLayerId = ref<string | null>(null)

  // ---- 侧边栏 ----
  const sidebarActiveTab = ref<'files' | 'layers'>('layers')
  const sidebarVisible = ref(true)

  // ---- 图层详细信息弹窗 ----
  const showLayerDetailPanel = ref(false)
  const selectedLayerDetail = ref<any>(null)

  // ---- 绘制几何记录 (保存到侧边栏图层下，删除时同步移除地图图形) ----
  interface DrawnGeometry {
    id: string
    name: string
    type: 'rectangle' | 'circle' | 'polygon'
    coordinates: any
    /** Cesium 地图上的 feature ID，删除图层时同步移除地图图形 */
    featureId?: string
    createdAt: string
    poiCount?: number
  }
  const drawnGeometries = ref<DrawnGeometry[]>([])

  // ---- 计算属性 ----
  const activeMenuLabel = computed(() => {
    const item = menuItems.value.find((m) => m.id === activeQueryModule.value)
    return item?.label ?? ''
  })

  const selectedRangePois = computed(() => selectedPois.value)

  const activeAnalysisResult = computed(() =>
    analysisResults.value.find((r) => r.id === activeAnalysisId.value),
  )

  const activeFertilizationPlan = computed(() =>
    fertilizationPlans.value.find((p) => p.id === activeFertilizationId.value),
  )

  const activeUploadedFile = computed(() =>
    uploadedFiles.value.find((f) => f.id === activeFileId.value),
  )

  // ---- 查询级联操作 ----
  function openQueryPanel(moduleId: string) {
    activeQueryModule.value = moduleId
    queryLevel.value = 'query'
    showQueryPanel.value = true
    showResultPanel.value = false
    showDetailPanel.value = false
  }

  function openResultPanel() {
    queryLevel.value = 'result'
    showResultPanel.value = true
  }

  // ---- 果树详情弹窗 ----
  const selectedPoiDetail = ref<FruitTreePoi | null>(null)

  function openDetailPanel(poi: FruitTreePoi) {
    selectedPoiDetail.value = poi
    queryLevel.value = 'detail'
    showDetailPanel.value = true
  }

  function closeAllPanels() {
    showQueryPanel.value = false
    showResultPanel.value = false
    showDetailPanel.value = false
    queryLevel.value = 'menu'
    // 不清理 selectedPoiDetail，切回来还能看
  }

  function goBackQueryLevel() {
    if (queryLevel.value === 'detail') {
      queryLevel.value = 'result'
      showDetailPanel.value = false
    } else if (queryLevel.value === 'result') {
      queryLevel.value = 'query'
      showResultPanel.value = false
    } else if (queryLevel.value === 'query') {
      queryLevel.value = 'menu'
      showQueryPanel.value = false
    }
  }

  // ---- TSOM查询 ----
  async function executeTsomQuery(params: TsomQueryParams) {
    try {
      const res = await orchardApi.queryTsom(params)
      tsomQueryResult.value = res.data
      selectedPois.value = res.data.pois
      queryLevel.value = 'result'
      showResultPanel.value = true
      return res.data
    } catch (err) {
      console.error('TSOM query failed:', err)
      throw err
    }
  }

  // ---- 精细查询（查全部树，不限制空间范围） ----
  async function executeFilterQuery(params: TsomQueryParams) {
    try {
      const res = await orchardApi.queryTreesByFilter(params)
      tsomQueryResult.value = res.data
      selectedPois.value = res.data.pois
      queryLevel.value = 'result'
      showResultPanel.value = true
      return res.data
    } catch (err) {
      console.error('Filter query failed:', err)
      throw err
    }
  }

  // ---- 选择范围 ----
  function setSelectionRange(range: NonNullable<typeof selectionRange.value>) {
    selectionRange.value = range
    // 选定范围后默认触发TSOM查询
    const params: TsomQueryParams = {
      rangeType: range.type,
      coordinates: range.coordinates,
      radius: range.radius,
    }
    return executeTsomQuery(params)
  }

  function saveDrawnGeometry(geometry: Omit<DrawnGeometry, 'id' | 'createdAt'>) {
    const id = 'draw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
    drawnGeometries.value.unshift({
      ...geometry,
      id,
      createdAt: new Date().toISOString(),
    })
    // 切换到图层标签页显示
    sidebarActiveTab.value = 'layers'
    return id
  }

  function removeDrawnGeometry(id: string) {
    const geo = drawnGeometries.value.find((g) => g.id === id)
    if (geo?.featureId) {
      // 同步移除 Cesium 地图上的图形
      const gisStore = useGISStore()
      gisStore.removeFeature(geo.featureId)
    }
    drawnGeometries.value = drawnGeometries.value.filter((g) => g.id !== id)
  }

  function clearSelection() {
    selectionRange.value = null
    selectedPois.value = []
    tsomQueryResult.value = null
  }

  // ---- 图层详细信息 ----
  function showLayerDetail(geo: any) {
    selectedLayerDetail.value = geo
    showLayerDetailPanel.value = true
  }

  function hideLayerDetail() {
    showLayerDetailPanel.value = false
    selectedLayerDetail.value = null
  }

  // ---- 渲染参数 ----
  function updateRenderParams(params: Partial<RenderParams>) {
    renderParams.value = { ...renderParams.value, ...params }
  }

  function resetRenderParams() {
    renderParams.value = { ...DEFAULT_RENDER_PARAMS }
  }

  function toggleDefaultParams() {
    useDefaultParams.value = !useDefaultParams.value
    if (useDefaultParams.value) {
      resetRenderParams()
    }
  }

  // ---- 文件操作（TIF 上传 → 后端推理任务，轮询进度） ----
  /** 任务轮询定时器表（本地行 id → intervalId） */
  const pollTimers = new Map<string, number>()

  function stopPolling(fileId: string) {
    const timer = pollTimers.get(fileId)
    if (timer !== undefined) {
      clearInterval(timer)
      pollTimers.delete(fileId)
    }
  }

  function startPolling(row: UploadedFile, taskId: string) {
    stopPolling(row.id)
    const timer = window.setInterval(async () => {
      try {
        const res = await orchardApi.getTaskStatus(taskId)
        const status = res.data.status
        const idx = uploadedFiles.value.findIndex((f) => f.id === row.id)
        if (idx < 0) {
          stopPolling(row.id)
          return
        }
        uploadedFiles.value[idx].status = status
        uploadedFiles.value[idx].message = res.data.message
        uploadedFiles.value[idx].uploadProgress = Math.round(res.data.progress * 100)
        uploadedFiles.value[idx].totalTrees = res.data.total_trees

        if (status === 'completed' || status === 'failed') {
          stopPolling(row.id)
        }
      } catch (err) {
        console.error('[orchardStore] task poll failed:', err)
        stopPolling(row.id)
      }
    }, 2000)
    pollTimers.set(row.id, timer)
  }

  async function uploadSingleFile(file: File) {
    // 仅支持无人机正射影像 .tif/.tiff
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.tif') && !lower.endsWith('.tiff')) {
      const err = new Error('仅支持 .tif/.tiff 无人机正射影像文件')
      console.error('[orchardStore]', err.message)
      throw err
    }

    const row: UploadedFile = {
      id: 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      name: file.name,
      size: file.size,
      type: 'image/tiff',
      uploadProgress: 0,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      analysisResults: [],
      childFiles: [],
    }
    uploadedFiles.value.push(row)
    activeFileId.value = row.id

    try {
      const res = await orchardApi.uploadFile(file)
      row.taskId = res.data.task_id
      startPolling(row, res.data.task_id)
      return row
    } catch (err) {
      const idx = uploadedFiles.value.findIndex((f) => f.id === row.id)
      if (idx >= 0) {
        uploadedFiles.value[idx].status = 'failed'
        uploadedFiles.value[idx].message = '上传失败'
      }
      console.error('[orchardStore] Upload failed:', err)
      throw err
    }
  }

  async function deleteFile(fileId: string) {
    // 后端无删除接口，仅从本地会话列表移除并停止轮询
    stopPolling(fileId)
    uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== fileId)
    if (activeFileId.value === fileId) {
      activeFileId.value = null
    }
  }

  // ---- 分析结果 ----
  async function fetchAnalysisResults() {
    try {
      const res = await orchardApi.getAnalysisResults()
      analysisResults.value = res.data
    } catch (err) {
      console.error('Failed to fetch analysis results:', err)
    }
  }

  // ---- 施肥方案 ----
  async function fetchFertilizationPlans(orchardId?: string) {
    try {
      const res = await orchardApi.getFertilizationPlans(orchardId)
      fertilizationPlans.value = res.data
    } catch (err) {
      console.error('Failed to fetch fertilization plans:', err)
    }
  }

  // ---- GeoServer图层 ----
  async function fetchGeoServerLayers() {
    try {
      const res = await orchardApi.getGeoserverLayers()
      geoServerLayers.value = res.data
    } catch (err) {
      console.error('Failed to fetch GeoServer layers:', err)
    }
  }

  // ---- 上传地块任务（地2 切换） ----
  const plotTasks = ref<UploadPlotTask[]>([])
  const activePlotTaskId = ref<string | null>(null)

  const activePlotTask = computed(() =>
    plotTasks.value.find((t) => t.id === activePlotTaskId.value) ?? null,
  )

  const POLL_INTERVAL_MS = 2000

  function removePlotTask(id: string) {
    plotTasks.value = plotTasks.value.filter((t) => t.id !== id)
    if (activePlotTaskId.value === id) activePlotTaskId.value = null
  }

  /** 上传 TIF 并启动后台分割 + 轮询（异步，不阻塞主界面） */
  async function uploadTifAndInterpret(file: File) {
    const domRect = await orchardApi.readTifBounds(file)

    const id = 'plot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
    plotTasks.value.unshift({
      id,
      taskId: '',
      fileName: file.name,
      fileSize: file.size,
      status: 'uploading',
      uploadProgress: 0,
      analysisProgress: 0,
      totalTrees: 0,
      freshTrees: [],
      domRect,
      createdAt: new Date().toISOString(),
    })

    // 始终通过 find 取 reactive proxy 更新，否则修改原始对象不会触发 Vue 响应式
    const findTask = () => plotTasks.value.find((t) => t.id === id)

    try {
      const res = await orchardApi.uploadTifAndInterpret(file, (p) => {
        const t = findTask()
        if (t) t.uploadProgress = p
      })
      const t = findTask()
      if (t) {
        t.uploadProgress = 100
        t.taskId = res.task_id
        t.status = 'processing'
      }
      startPlotPolling(id)
    } catch (err) {
      const t = findTask()
      if (t) t.status = 'failed'
      console.error('Upload TIF failed:', err)
      throw err
    }
  }

  /** 轮询后端分割进度，完成/失败后停止并通知 */
  function startPlotPolling(id: string) {
    const timer = setInterval(async () => {
      const t = plotTasks.value.find((task) => task.id === id)
      if (!t || t.status !== 'processing') {
        clearInterval(timer)
        return
      }
      try {
        const res = await orchardApi.getInterpretTask(t.taskId)
        t.analysisProgress = Math.round((res.progress ?? 0) * 100)
        if (res.status === 'completed') {
          t.status = 'completed'
          t.analysisProgress = 100
          t.totalTrees = res.total_trees
          t.freshTrees = res.fresh_trees ?? []
          clearInterval(timer)
          ElNotification({
            title: '地块分析完成',
            message: `${t.fileName}：提取树冠 ${t.totalTrees} 棵`,
            type: 'success',
            duration: 5000,
          })
        } else if (res.status === 'failed') {
          t.status = 'failed'
          clearInterval(timer)
          ElNotification({
            title: '地块分析失败',
            message: res.message || t.fileName,
            type: 'error',
            duration: 6000,
          })
        }
      } catch (err) {
        // 单次轮询失败忽略，下个周期重试
      }
    }, POLL_INTERVAL_MS)
  }

  /** 点击"已完成"任务卡片 → 触发加载地2 */
  function loadPlot(taskId: string) {
    const task = plotTasks.value.find((t) => t.id === taskId)
    if (!task || task.status !== 'completed') return
    activePlotTaskId.value = taskId
  }

  // ---- 冠层图表统计 ----
  const showChartDialog = ref(false)
  const chartData = ref<ChartStatistics | null>(null)
  const chartLoading = ref(false)
  const chartError = ref<string | null>(null)

  async function fetchChartData() {
    chartLoading.value = true
    chartError.value = null
    try {
      const res = await orchardApi.getChartStatistics()
      chartData.value = res.data as ChartStatistics
    } catch (err: any) {
      chartError.value = err?.message || '获取图表数据失败'
      console.error('[orchardStore] fetchChartData failed:', err)
    } finally {
      chartLoading.value = false
    }
  }

  // ---- 历史老树 ----
  async function fetchHistoricalTrees() {
    if (historicalTreesLoading.value) return
    historicalTreesLoading.value = true
    try {
      const res = await orchardApi.getHistoricalTrees()
      const pois: FruitTreePoi[] = res.data.trees.map((t) => ({
        id: String(t.id),
        name: t.batch_id || `历史树${t.id}`,
        longitude: t.lng,
        latitude: t.lat,
        altitude: undefined,
        canopyHeight: t.height_m ?? 0,
        canopyDiameter: t.crown_diameter ?? 0,
        canopyVolume: t.volume_m3 ?? 0,
        healthStatus: growthIndexToHealth(t.growth_index),
        orchardId: '',
        orchardName: '历史老树',
      }))
      historicalTreePois.value = pois
      console.log(`[orchardStore] historical trees loaded (${pois.length})`)
    } catch (err) {
      console.error('[orchardStore] fetchHistoricalTrees failed:', err)
    } finally {
      historicalTreesLoading.value = false
    }
  }

  // ---- 初始化 ----
  async function init() {
    await Promise.all([
      fetchAnalysisResults(),
    ])
  }

  return {
    // state
    menuItems,
    queryLevel,
    activeQueryModule,
    showQueryPanel,
    showResultPanel,
    showDetailPanel,
    selectedPois,
    tsomQueryResult,
    selectedPoiDetail,
    orchardStatistics,
    selectionRange,
    historicalTreesLoading,
    historicalTreePois,
    historicalTreesVisible,
    renderParams,
    useDefaultParams,
    showRenderSettings,
    uploadedFiles,
    activeFileId,
    showUploadPanel,
    analysisResults,
    activeAnalysisId,
    showAnalysisWindow,
    fertilizationPlans,
    activeFertilizationId,
    showFertilizationWindow,
    autoShowFertilization,
    autoShowAnalysis,
    geoServerLayers,
    activeLayerId,
    sidebarActiveTab,
    sidebarVisible,
    showLayerDetailPanel,
    selectedLayerDetail,
    drawnGeometries,
    saveDrawnGeometry,
    removeDrawnGeometry,
    showLayerDetail,
    hideLayerDetail,
    // computed
    activeMenuLabel,
    selectedRangePois,
    activeAnalysisResult,
    activeFertilizationPlan,
    activeUploadedFile,
    // plot task state
    plotTasks,
    activePlotTaskId,
    activePlotTask,
    removePlotTask,
    uploadTifAndInterpret,
    loadPlot,
    // chart state
    showChartDialog,
    chartData,
    chartLoading,
    chartError,
    // chart actions
    fetchChartData,
    // actions
    fetchHistoricalTrees,
    openQueryPanel,
    openResultPanel,
    openDetailPanel,
    closeAllPanels,
    goBackQueryLevel,
    executeTsomQuery,
    executeFilterQuery,
    setSelectionRange,
    clearSelection,
    updateRenderParams,
    resetRenderParams,
    toggleDefaultParams,
    uploadSingleFile,
    deleteFile,
    fetchAnalysisResults,
    fetchFertilizationPlans,
    fetchGeoServerLayers,
    init,
  }
})
