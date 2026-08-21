import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElNotification } from 'element-plus'
import type {
  FruitTreePoi,
  TsomQueryParams,
  TsomQueryResult,
  OrchardStatistics,
  AnalysisResult,
  UploadedFile,
  GeoServerLayer,
  QueryLevel,
  ModuleMenuItem,
  ChartStatistics,
  FertilizerPlanOut,
  AlertTreeItem,
  UploadPlotTask,
} from '@/types/orchard'
import { useGISStore } from '@/stores/gis'
import * as orchardApi from '@/api/orchard'
import type { TaskStatus } from '@/api/orchard'
import { growthIndexToHealth, normalizeToClosedRing } from '@/utils/spatial'
import { computeAreaFromDem } from '@/utils/mapStats'
import { DOM_RECT } from '@/utils/orchardPreview'
import { buildChartFromLoadedTileset } from '@/utils/chartFromBasemap'

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

  // ---- 底图统计（读自 3D Tiles / DEM，绕开 GeoScene 挂起）----
  const mapStats = ref<{ totalTrees: number; areaMu: number; ready: boolean }>({
    totalTrees: 0,
    areaMu: 0,
    ready: false,
  })

  /** 地1 数据源（OrchardTilesetLayer 加载时写入），供驾驶舱统计回退时复用。 */
  const plot1DataBase = ref('')

  /** 从底图刷新统计（trees 瓦片加载成功后调用）。DEM 异步加载，未就绪时最多重试数秒。 */
  async function refreshMapStats(): Promise<void> {
    // 树点计数：数据源随上传状态切换（地1 果园范围 → 上传文件范围）。
    // 只读树点（后端 FeatureServer returnCountOnly），不数 3D 树模型。
    let totalTrees = 0
    try {
      const res = await orchardApi.getTreeCountByBbox(treePointSourceBbox.value)
      totalTrees = res.data.count
    } catch (e) {
      console.warn('[mapStats] 树点计数失败:', e)
    }

    let areaMu = computeAreaFromDem((window as any).DEM)
    for (let i = 0; i < 12 && areaMu === 0; i++) {
      await new Promise((r) => setTimeout(r, 500))
      areaMu = computeAreaFromDem((window as any).DEM)
    }
    mapStats.value = { totalTrees, areaMu, ready: true }
    console.log(`[mapStats] 树点统计: ${totalTrees} 棵树, ${areaMu.toFixed(1)} 亩`)
  }

  // ---- 历史老树（开屏拾取点） ----
  const historicalTreesLoading = ref(false)
  const historicalTreePois = ref<FruitTreePoi[]>([])
  const historicalTreesVisible = ref(false) // 历史老树点默认隐藏（用户确认），避免与地2 树点混淆

  // ---- 选择范围 ----
  const selectionRange = ref<{
    type: 'rectangle' | 'circle' | 'polygon'
    coordinates: any
    radius?: number
  } | null>(null)

  // ---- 文件上传 ----
  const uploadedFiles = ref<UploadedFile[]>([])
  const activeFileId = ref<string | null>(null)
  const showUploadPanel = ref(false)

  // ---- 分析结果 ----
  const analysisResults = ref<AnalysisResult[]>([])
  const activeAnalysisId = ref<string | null>(null)
  const showAnalysisWindow = ref(false)

  // ---- 变量施肥推荐 ----
  const showFertilizationWindow = ref(false)
  const fertilizerPlan = ref<FertilizerPlanOut | null>(null)
  const fertilizationLoading = ref(false)
  const fertilizationError = ref<string | null>(null)

  // ---- 弱树告警 ----
  const alerts = ref<AlertTreeItem[]>([])
  const alertsTotal = ref(0)
  const alertsThreshold = ref(0.15)
  const alertsLoading = ref(false)
  const alertsVisible = ref(true)
  const showAlertsWindow = ref(false)
  /** 弱树告警查询失败信息（GeoScene 冷缓存超时等原因），空串表示无错误 */
  const alertsError = ref('')

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
    type: 'point' | 'line' | 'rectangle' | 'circle' | 'polygon'
    coordinates: any
    /** Cesium 地图上的 feature ID，删除图层时同步移除地图图形 */
    featureId?: string
    /** 圆形框选的半径(m)，矩形/多边形为 undefined（施肥/查询构造多边形环需要） */
    radius?: number
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

  /**
   * 关闭搜索界面并清空查询结果。
   * 与仅隐藏面板的 closeAllPanels 不同：关闭搜索面板时同时清空 tsomQueryResult，
   * 触发 OrchardMainLayout 的标记 watch → clearTreeMarkers()，地图上的搜索树点随之消失。
   * 注意：不清 selectionRange——底图上的框选是用户手画的，施肥方案/处方图要复用，
   * 关搜索界面不该把框选数据一起抹掉（清框选走 PoiDrawToolbar 的🗑️清除按钮）。
   * 互斥切换（开图层管理/图表时自动关闭查询）仍走 closeAllPanels，不清结果，可回看。
   */
  function closeSearchPanels() {
    closeAllPanels()
    selectedPois.value = []
    tsomQueryResult.value = null
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
    // 地2（上传地块）激活时传 batch_id='orange_tree'，地1 不传（查 historical_zone 为主）
    const batchId = activePlotTaskId.value ? 'orange_tree' : undefined
    const params: TsomQueryParams = {
      rangeType: range.type,
      coordinates: range.coordinates,
      radius: range.radius,
      batchId,
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

  /** 写入一条分析结果（同文件重复分析时替换旧结果），并设为当前查看项 */
  function pushAnalysisResult(result: AnalysisResult) {
    const oldIdx = analysisResults.value.findIndex((r) => r.fileId === result.fileId)
    if (oldIdx >= 0) analysisResults.value.splice(oldIdx, 1)
    analysisResults.value.push(result)
    activeAnalysisId.value = result.id
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
        // 同步"上传地块"图层任务（进度 / 完成 / 失败），保证图层与文件行状态一致
        syncPlotFromTask(row, res.data)

        if (status === 'completed') {
          stopPolling(row.id)
          // 推理完成 → 把 fresh_trees 打点到地图，上传后立即看到新检测的树
          const fresh = res.data.fresh_trees ?? []
          if (fresh.length > 0) {
            const pois: FruitTreePoi[] = fresh.map((t) => ({
              id: String(t.id),
              name: `新树${t.id}`,
              longitude: t.lng,
              latitude: t.lat,
              altitude: undefined,
              canopyHeight: t.height_m ?? 0,
              canopyDiameter: t.crown_diameter ?? 0,
              canopyVolume: t.volume_m3 ?? 0,
              healthStatus: growthIndexToHealth(t.growth_index),
              orchardId: '',
              orchardName: '冠层解析',
            }))
            selectedPois.value = pois
            tsomQueryResult.value = {
              id: 'upload-' + taskId,
              queryParams: {
                rangeType: 'rectangle',
                coordinates: [],
              },
              totalTrees: fresh.length,
              pois,
              statistics: {
                averageNdvi: 0,
                totalArea: 0,
                averageCanopyHeight: 0,
                averageCanopyVolume: 0,
                healthyCount: 0,
                warningCount: 0,
                criticalCount: 0,
              },
              executedAt: new Date().toISOString(),
            }
            console.log(`[orchardStore] inference done, ${pois.length} new trees on map`)
          }

          // 生成真实分析结果，供"查看分析"窗口展示
          let healthyCount = 0
          let warningCount = 0
          let criticalCount = 0
          let heightSum = 0
          let heightCount = 0
          let areaSum = 0
          fresh.forEach((t) => {
            const h = growthIndexToHealth(t.growth_index)
            if (h === 'healthy') healthyCount++
            else if (h === 'warning') warningCount++
            else criticalCount++
            if (typeof t.height_m === 'number' && isFinite(t.height_m)) {
              heightSum += t.height_m
              heightCount++
            }
            if (typeof t.area_m2 === 'number' && isFinite(t.area_m2)) areaSum += t.area_m2
          })
          pushAnalysisResult({
            id: 'analysis-' + taskId,
            name: `冠层解析 · ${row.name}`,
            type: 'canopy',
            fileId: row.id,
            executedAt: new Date().toISOString(),
            status: 'completed',
            data: {
              totalTrees: fresh.length,
              healthyCount,
              warningCount,
              criticalCount,
              averageHeight: heightCount ? Number((heightSum / heightCount).toFixed(2)) : 0,
              totalArea: Number(areaSum.toFixed(2)),
            },
          })

          // 上传后自动弹出分析结果窗口（勾选"上传后自动弹出"时）
          if (autoShowAnalysis.value) {
            showAnalysisWindow.value = true
          }
        } else if (status === 'failed') {
          stopPolling(row.id)
          // 失败也生成一条分析结果，窗口展示失败原因
          pushAnalysisResult({
            id: 'analysis-' + taskId,
            name: `冠层解析 · ${row.name}`,
            type: 'canopy',
            fileId: row.id,
            executedAt: new Date().toISOString(),
            status: 'failed',
            data: { error: res.data.message || '分析失败' },
          })
        }
      } catch (err) {
        console.error('[orchardStore] task poll failed:', err)
        stopPolling(row.id)
      }
    }, 2000)
    pollTimers.set(row.id, timer)
  }

  /** 按关联文件 id 查找"上传地块"图层任务（数据管理页上传同步生成） */
  function findPlotByFileId(fileId: string): UploadPlotTask | undefined {
    return plotTasks.value.find((t) => t.fileId === fileId)
  }

  /** 把同一后端任务的轮询状态同步到"上传地块"图层任务（进度/完成/失败） */
  function syncPlotFromTask(row: UploadedFile, status: TaskStatus) {
    const pt = findPlotByFileId(row.id)
    if (!pt) return
    pt.taskId = row.taskId ?? pt.taskId
    pt.analysisProgress = Math.round((status.progress ?? 0) * 100)
    if (status.status === 'completed') {
      pt.status = 'completed'
      pt.analysisProgress = 100
      pt.totalTrees = status.total_trees ?? 0
      pt.freshTrees = (status.fresh_trees ?? []).map((t) => ({
        id: String(t.id),
        batch_id: 'orange_tree',
        lng: t.lng,
        lat: t.lat,
        area_m2: t.area_m2,
        height_m: t.height_m,
        crown_diameter: t.crown_diameter,
        volume_m3: t.volume_m3,
        growth_index: t.growth_index,
      }))
    } else if (status.status === 'failed') {
      pt.status = 'failed'
    } else {
      pt.status = 'processing'
    }
  }

  async function uploadSingleFile(file: File) {
    // 仅支持无人机正射影像 .tif/.tiff
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.tif') && !lower.endsWith('.tiff')) {
      const err = new Error('仅支持 .tif/.tiff 无人机正射影像文件')
      console.error('[orchardStore]', err.message)
      throw err
    }

    // 读 TIF 边界（只解析文件头，不读像素），供"上传地块"图层贴位与双击跳转
    let domRect: [number, number, number, number] | null = null
    try {
      domRect = await orchardApi.readTifBounds(file)
    } catch (e) {
      console.warn('[orchardStore] 读取 TIF 边界失败（图层仍可显示）:', e)
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

    // 同步创建"上传地块"图层任务：完成后在图层区显示、可单击加载地2 / 双击跳转
    // （与侧边栏 uploadTifAndInterpret 共用 plotTasks 数据结构，fileId 关联回本文件）
    plotTasks.value.unshift({
      id: 'plot-' + row.id,
      fileId: row.id,
      taskId: '',
      fileName: file.name,
      fileSize: file.size,
      status: 'uploading',
      uploadProgress: 0,
      analysisProgress: 0,
      totalTrees: 0,
      freshTrees: [],
      domRect,
      createdAt: row.uploadedAt,
    })

    try {
      const res = await orchardApi.uploadFile(file)
      row.taskId = res.data.task_id
      const pt = findPlotByFileId(row.id)
      if (pt) pt.status = 'processing'
      startPolling(row, res.data.task_id)
      return row
    } catch (err) {
      const idx = uploadedFiles.value.findIndex((f) => f.id === row.id)
      if (idx >= 0) {
        uploadedFiles.value[idx].status = 'failed'
        uploadedFiles.value[idx].message = '上传失败'
      }
      const pt = findPlotByFileId(row.id)
      if (pt) pt.status = 'failed'
      console.error('[orchardStore] Upload failed:', err)
      throw err
    }
  }

  async function deleteFile(fileId: string) {
    // 后端无删除接口，仅从本地会话列表移除并停止轮询
    stopPolling(fileId)
    uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== fileId)
    // 同步移除关联的"上传地块"图层任务（数据管理页上传生成）
    const linked = findPlotByFileId(fileId)
    if (linked && activePlotTaskId.value === linked.id) activePlotTaskId.value = null
    plotTasks.value = plotTasks.value.filter((t) => t.fileId !== fileId)
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

  // ---- 变量施肥推荐 ----
  /** 触发浏览器下载一个 Blob 为文件 */
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** 读框选范围 → 闭合经纬度环（无框选时抛错，按钮置灰兜底） */
  function selectionCoordinates(): number[][] {
    const range = selectionRange.value
    if (!range) {
      throw new Error('请先在地图上框选区域')
    }
    return normalizeToClosedRing({
      type: range.type,
      coordinates: range.coordinates,
      radius: range.radius,
    })
  }

  /** 施肥区域（面状框选图层），缺省回退当前 selectionRange */
  interface FertRegion {
    type: 'rectangle' | 'circle' | 'polygon'
    coordinates: number[][]
    radius?: number
  }

  /** 生成变量施肥方案（apply=true 时同时把等级写回 GeoScene）。
   *  region 指定某个框选图层（矩形/圆形/多边形）；不传则用当前 selectionRange。 */
  async function generateFertilizationPlan(opts?: { apply?: boolean; region?: FertRegion }) {
    fertilizationLoading.value = true
    fertilizationError.value = null
    try {
      const coordinates = opts?.region
        ? normalizeToClosedRing({
            type: opts.region.type,
            coordinates: opts.region.coordinates,
            radius: opts.region.radius,
          })
        : selectionCoordinates()
      const res = await orchardApi.generateFertilizationPlan({
        coordinates,
        apply: opts?.apply ?? false,
      })
      fertilizerPlan.value = res.data
      return res.data
    } catch (err: any) {
      fertilizationError.value =
        err?.response?.data?.detail || err?.message || '生成施肥方案失败'
      throw err
    } finally {
      fertilizationLoading.value = false
    }
  }

  /** 导出处方图（CSV 喂无人机/施肥机，GeoJSON 供 Cesium 二次确认）。region 同 generateFertilizationPlan */
  async function exportFertilizationPlan(format: 'csv' | 'geojson', region?: FertRegion) {
    const coordinates = region
      ? normalizeToClosedRing({
          type: region.type,
          coordinates: region.coordinates,
          radius: region.radius,
        })
      : selectionCoordinates()
    const res = await orchardApi.exportFertilizationPlan({ coordinates }, format)
    triggerDownload(res.data as Blob, `fertilizer_plan.${format}`)
  }

  // ---- 弱树告警 ----
  async function fetchTreeAlerts() {
    alertsLoading.value = true
    alertsError.value = ''
    // 立即弹出窗口，让用户看到"巡检中"状态而不是无响应
    showAlertsWindow.value = true
    try {
      const res = await orchardApi.getTreeAlerts()
      alerts.value = res.data.alerts
      alertsTotal.value = res.data.total
      alertsThreshold.value = res.data.growth_threshold
      alertsVisible.value = true
      return res.data
    } catch (err) {
      // GeoScene 冷缓存查询可能 20s 超时（503），给用户明确提示而不是"无弱树告警"
      alertsError.value = err instanceof Error && err.message
        ? err.message
        : '弱树告警查询失败，GIS 服务繁忙或超时，请稍后重试'
      console.error('[orchardStore] fetchTreeAlerts failed:', err)
      throw err
    } finally {
      alertsLoading.value = false
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

  // ---- 上传地块任务（地2 切换，与地1 共存叠加） ----
  const plotTasks = ref<UploadPlotTask[]>([])
  const activePlotTaskId = ref<string | null>(null)

  const activePlotTask = computed(() =>
    plotTasks.value.find((t) => t.id === activePlotTaskId.value) ?? null,
  )

  /**
   * 当前树点数据源范围 [west, south, east, north]：
   * 已上传地2（activePlotTask 优先，其次最近完成的上传地块）用上传文件 WGS84 边界；
   * 未上传时用地1 果园范围 DOM_RECT。果园态势 / 冠层解析右侧面板的树点数据均以它为准。
   */
  const treePointSourceBbox = computed<[number, number, number, number]>(() => {
    const uploaded = plotTasks.value.filter((t) => t.status === 'completed' && t.domRect)
    if (uploaded.length > 0) {
      const active = uploaded.find((t) => t.id === activePlotTaskId.value)
      return (active ?? uploaded[0]).domRect!
    }
    return [DOM_RECT.west, DOM_RECT.south, DOM_RECT.east, DOM_RECT.north]
  })

  /** 树点数据源名称（用于面板标注：地1 果园范围 / 上传文件名） */
  const treePointSourceLabel = computed(() => {
    const uploaded = plotTasks.value.filter((t) => t.status === 'completed' && t.domRect)
    if (uploaded.length > 0) {
      const active = uploaded.find((t) => t.id === activePlotTaskId.value)
      return (active ?? uploaded[0]).fileName
    }
    return '地1 果园范围'
  })

  const POLL_INTERVAL_MS = 2000

  function removePlotTask(id: string) {
    const t = plotTasks.value.find((x) => x.id === id)
    plotTasks.value = plotTasks.value.filter((x) => x.id !== id)
    if (activePlotTaskId.value === id) activePlotTaskId.value = null
    // 数据管理页上传生成的关联文件行一并移除
    if (t?.fileId) {
      stopPolling(t.fileId)
      uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== t.fileId)
      if (activeFileId.value === t.fileId) activeFileId.value = null
    }
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

  /** 点击"已完成"任务卡片 / 双击跳转 → 加载或叠加显示地2（与地1 恒共存）。 */
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
      // 优先从底图读取(遍历已加载的 trees 瓦片,读每棵树 batch table 属性统计)
      let data: ChartStatistics | null = null
      try {
        data = buildChartFromLoadedTileset()
        if (data) {
          console.log(
            `[orchardStore] 图表数据来自底图: ${data.metrics.length} 个指标, 时间 ${data.timestamp}`,
          )
        } else {
          console.warn('[orchardStore] 底图瓦片未就绪,回退后端接口')
        }
      } catch (e) {
        console.warn('[orchardStore] 底图读图失败,回退后端接口:', e)
      }

      // 底图不可用才走后端接口
      if (!data) {
        const res = await orchardApi.getChartStatistics()
        data = res.data as ChartStatistics
      }
      chartData.value = data
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
    // 注意：不再调用 fetchAnalysisResults() —— 后端无 /analysis/list 端点，
    // 每次启动打 404，且返回的 analysisResults 无 UI 使用（死代码）。
    // 若后端补上该端点再恢复调用。
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
    uploadedFiles,
    activeFileId,
    showUploadPanel,
    analysisResults,
    activeAnalysisId,
    showAnalysisWindow,
    showFertilizationWindow,
    fertilizerPlan,
    fertilizationLoading,
    fertilizationError,
    alerts,
    alertsTotal,
    alertsThreshold,
    alertsLoading,
    alertsVisible,
    showAlertsWindow,
    alertsError,
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
    activeUploadedFile,
    // plot task state
    plotTasks,
    activePlotTaskId,
    activePlotTask,
    plot1DataBase,
    // 树点数据源（果园态势 / 冠层解析面板用，随上传状态在地1 果园 ↔ 上传文件间切换）
    treePointSourceBbox,
    treePointSourceLabel,
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
    closeSearchPanels,
    goBackQueryLevel,
    executeTsomQuery,
    executeFilterQuery,
    setSelectionRange,
    clearSelection,
    uploadSingleFile,
    deleteFile,
    fetchAnalysisResults,
    generateFertilizationPlan,
    exportFertilizationPlan,
    fetchTreeAlerts,
    fetchGeoServerLayers,
    mapStats,
    refreshMapStats,
    init,
  }
})
