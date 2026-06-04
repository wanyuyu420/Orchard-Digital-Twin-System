/**
 * Data Management Store - handles CRUD operations and pagination for admin data
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as adminApi from '@/api/admin'

export type EntityType = 'sensors' | 'readings' | 'stations' | 'facilities' | 'sections'

export const useDataManagementStore = defineStore('dataManagement', () => {
  // Current entity tab
  const activeEntity = ref<EntityType>('sensors')

  // Pagination state
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const totalPages = ref(0)

  // Sorting state
  const sortBy = ref<string>('id')
  const sortOrder = ref<'asc' | 'desc'>('desc')

  // Search and filter state
  const searchQuery = ref('')
  const filters = ref<Record<string, any>>({})

  // Data state
  const items = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Lookup data
  const sensorTypes = ref<adminApi.SensorType[]>([])
  const facilities = ref<adminApi.FacilityAdmin[]>([])

  // Modal state
  const isFormModalOpen = ref(false)
  const isDeleteModalOpen = ref(false)
  const editingItem = ref<any>(null)
  const deletingItem = ref<any>(null)
  const isSubmitting = ref(false)

  // Fetch data based on active entity
  async function fetchData() {
    isLoading.value = true
    error.value = null

    try {
      const params = {
        page: page.value,
        page_size: pageSize.value,
        search: searchQuery.value || undefined,
        sort_by: sortBy.value,
        sort_order: sortOrder.value,
        ...filters.value,
      }

      let response: adminApi.PaginatedResponse<any>

      switch (activeEntity.value) {
        case 'sensors':
          response = await adminApi.fetchSensors(params)
          break
        case 'readings':
          response = await adminApi.fetchReadings(params)
          break
        case 'stations':
          response = await adminApi.fetchStations(params)
          break
        case 'facilities':
          response = await adminApi.fetchFacilities(params)
          break
        case 'sections':
          response = await adminApi.fetchSections(params)
          break
        default:
          throw new Error('Unknown entity type')
      }

      items.value = response.items
      total.value = response.total
      totalPages.value = response.total_pages
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch data'
      console.error('Fetch error:', e)
    } finally {
      isLoading.value = false
    }
  }

  // Fetch lookup data
  async function fetchLookups() {
    try {
      const [types, facs] = await Promise.all([
        adminApi.fetchSensorTypes(),
        adminApi.fetchFacilities({ page_size: 100 }),
      ])
      sensorTypes.value = types
      facilities.value = facs.items
    } catch (e) {
      console.error('Failed to fetch lookups:', e)
    }
  }

  // Change entity tab
  function setActiveEntity(entity: EntityType) {
    activeEntity.value = entity
    page.value = 1
    searchQuery.value = ''
    filters.value = {}
    sortBy.value = 'id'
    sortOrder.value = 'desc'
    fetchData()
  }

  // Pagination actions
  function setPage(p: number) {
    page.value = p
    fetchData()
  }

  function setPageSize(size: number) {
    pageSize.value = size
    page.value = 1
    fetchData()
  }

  // Sorting actions
  function setSortBy(key: string) {
    sortBy.value = key
    fetchData()
  }

  function setSortOrder(order: 'asc' | 'desc') {
    sortOrder.value = order
    fetchData()
  }

  // Search action
  function setSearch(query: string) {
    searchQuery.value = query
    page.value = 1
    fetchData()
  }

  // Filter actions
  function setFilter(key: string, value: any) {
    if (value === null || value === undefined || value === '') {
      delete filters.value[key]
    } else {
      filters.value[key] = value
    }
    page.value = 1
    fetchData()
  }

  function clearFilters() {
    filters.value = {}
    searchQuery.value = ''
    page.value = 1
    fetchData()
  }

  // CRUD Modal actions
  function openCreateModal() {
    editingItem.value = null
    isFormModalOpen.value = true
  }

  function openEditModal(item: any) {
    editingItem.value = { ...item }
    isFormModalOpen.value = true
  }

  function closeFormModal() {
    isFormModalOpen.value = false
    editingItem.value = null
  }

  function openDeleteModal(item: any) {
    deletingItem.value = item
    isDeleteModalOpen.value = true
  }

  function closeDeleteModal() {
    isDeleteModalOpen.value = false
    deletingItem.value = null
  }

  // Create/Update action
  async function saveItem(data: any): Promise<boolean> {
    isSubmitting.value = true
    try {
      if (editingItem.value?.id) {
        // Update
        switch (activeEntity.value) {
          case 'sensors':
            await adminApi.updateSensor(editingItem.value.id, data)
            break
          case 'stations':
            await adminApi.updateStation(editingItem.value.id, data)
            break
          case 'facilities':
            await adminApi.updateFacility(editingItem.value.id, data)
            break
          case 'sections':
            await adminApi.updateSection(editingItem.value.id, data)
            break
        }
      } else {
        // Create
        switch (activeEntity.value) {
          case 'sensors':
            await adminApi.createSensor(data)
            break
          case 'stations':
            await adminApi.createStation(data)
            break
          case 'facilities':
            await adminApi.createFacility(data)
            break
          case 'sections':
            await adminApi.createSection(data)
            break
        }
      }

      closeFormModal()
      await fetchData()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save'
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  // Delete action
  async function confirmDelete(): Promise<boolean> {
    if (!deletingItem.value) return false

    isSubmitting.value = true
    try {
      switch (activeEntity.value) {
        case 'sensors':
          await adminApi.deleteSensor(deletingItem.value.id)
          break
        case 'readings':
          await adminApi.deleteReading(deletingItem.value.id)
          break
        case 'stations':
          await adminApi.deleteStation(deletingItem.value.id)
          break
        case 'facilities':
          await adminApi.deleteFacility(deletingItem.value.id)
          break
        case 'sections':
          await adminApi.deleteSection(deletingItem.value.id)
          break
      }

      closeDeleteModal()
      await fetchData()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete'
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  // Export to CSV
  function exportToCsv() {
    if (items.value.length === 0) return

    const headers = Object.keys(items.value[0])
    const csvRows = [
      headers.join(','),
      ...items.value.map((item) =>
        headers
          .map((h) => {
            const val = item[h]
            if (val === null || val === undefined) return ''
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`
            return val
          })
          .join(',')
      ),
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeEntity.value}_export_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    // State
    activeEntity,
    page,
    pageSize,
    total,
    totalPages,
    sortBy,
    sortOrder,
    searchQuery,
    filters,
    items,
    isLoading,
    error,
    sensorTypes,
    facilities,
    isFormModalOpen,
    isDeleteModalOpen,
    editingItem,
    deletingItem,
    isSubmitting,

    // Actions
    fetchData,
    fetchLookups,
    setActiveEntity,
    setPage,
    setPageSize,
    setSortBy,
    setSortOrder,
    setSearch,
    setFilter,
    clearFilters,
    openCreateModal,
    openEditModal,
    closeFormModal,
    openDeleteModal,
    closeDeleteModal,
    saveItem,
    confirmDelete,
    exportToCsv,
  }
})
