<template>
  <ModalBox title="数据管理中心" icon="fa-solid fa-database">
    <template #actions>
      <button class="btn-secondary" @click="store.exportToCsv">
        <i class="fa-solid fa-file-excel"></i> 导出
      </button>
      <button class="btn-primary" @click="store.openCreateModal" v-if="canCreate">
        <i class="fa-solid fa-plus"></i> 新增
      </button>
    </template>

    <div class="data-management">
      <!-- Entity Tabs -->
      <div class="entity-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: store.activeEntity === tab.key }"
          @click="store.setActiveEntity(tab.key)"
        >
          <i :class="tab.icon"></i>
          {{ tab.label }}
        </button>
      </div>

      <!-- Data Grid -->
      <DataGrid
        :columns="currentColumns"
        :items="store.items"
        :total="store.total"
        :page="store.page"
        :page-size="store.pageSize"
        :total-pages="store.totalPages"
        :loading="store.isLoading"
        :sort-by="store.sortBy"
        :sort-order="store.sortOrder"
        @update:page="store.setPage"
        @update:page-size="store.setPageSize"
        @update:sort-by="store.setSortBy"
        @update:sort-order="store.setSortOrder"
        @search="store.setSearch"
        @create="store.openCreateModal"
        @edit="store.openEditModal"
        @delete="store.openDeleteModal"
        @export="store.exportToCsv"
      >
        <template #filters>
          <!-- Simulated filter (common to all entities) -->
          <select
            class="filter-select"
            :value="store.filters.is_simulated"
            @change="
              (e) =>
                store.setFilter(
                  'is_simulated',
                  (e.target as HTMLSelectElement).value === ''
                    ? undefined
                    : (e.target as HTMLSelectElement).value === 'true'
                )
            "
          >
            <option value="">全部数据</option>
            <option value="false">真实数据</option>
            <option value="true">模拟数据</option>
          </select>

          <!-- Status filter for sensors -->
          <select
            v-if="store.activeEntity === 'sensors'"
            class="filter-select"
            :value="store.filters.status"
            @change="
              (e) => store.setFilter('status', (e.target as HTMLSelectElement).value || undefined)
            "
          >
            <option value="">全部状态</option>
            <option value="active">在线</option>
            <option value="offline">离线</option>
            <option value="deleted">已删除</option>
          </select>
        </template>
      </DataGrid>

      <!-- Form Modal -->
      <FormModal
        v-model="store.isFormModalOpen"
        :title="store.editingItem ? '编辑记录' : '新增记录'"
      >
        <form @submit.prevent="handleSubmit" class="entity-form">
          <!-- Sensor Form -->
          <template v-if="store.activeEntity === 'sensors'">
            <div class="form-group">
              <label>测点编号 *</label>
              <input type="text" v-model="formData.point_code" required placeholder="如: Pcg-1" />
            </div>
            <div class="form-group">
              <label>断面 *</label>
              <select v-model="formData.section_id" required>
                <option value="">选择断面</option>
                <option v-for="s in sections" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>传感器类型 *</label>
              <select v-model="formData.sensor_type_id" required>
                <option value="">选择类型</option>
                <option v-for="t in store.sensorTypes" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>状态</label>
              <select v-model="formData.status">
                <option value="active">在线</option>
                <option value="offline">离线</option>
              </select>
            </div>
          </template>

          <!-- Station Form -->
          <template v-if="store.activeEntity === 'stations'">
            <div class="form-group">
              <label>站点编码 *</label>
              <input type="text" v-model="formData.station_code" required placeholder="如: MQG" />
            </div>
            <div class="form-group">
              <label>站点名称 *</label>
              <input
                type="text"
                v-model="formData.station_name"
                required
                placeholder="如: 马圈沟水文站"
              />
            </div>
            <div class="form-group">
              <label>所属设施 *</label>
              <select v-model="formData.facility_id" required>
                <option value="">选择设施</option>
                <option v-for="f in store.facilities" :key="f.id" :value="f.id">
                  {{ f.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>河流名称</label>
              <input type="text" v-model="formData.river_name" placeholder="可选" />
            </div>
            <div class="form-group">
              <label>流域名称</label>
              <input type="text" v-model="formData.basin_name" placeholder="可选" />
            </div>
          </template>

          <!-- Facility Form -->
          <template v-if="store.activeEntity === 'facilities'">
            <div class="form-group">
              <label>设施编码 *</label>
              <input type="text" v-model="formData.code" required placeholder="如: F001" />
            </div>
            <div class="form-group">
              <label>设施名称 *</label>
              <input
                type="text"
                v-model="formData.name"
                required
                placeholder="如: 乌鲁木齐县水文监测中心"
              />
            </div>
            <div class="form-group">
              <label>设施类型</label>
              <input type="text" v-model="formData.facility_type" placeholder="如: 水文站、大坝" />
            </div>
            <div class="form-group">
              <label>位置描述</label>
              <textarea v-model="formData.location_desc" placeholder="可选"></textarea>
            </div>
          </template>

          <!-- Section Form -->
          <template v-if="store.activeEntity === 'sections'">
            <div class="form-group">
              <label>断面编码 *</label>
              <input type="text" v-model="formData.code" required placeholder="如: S001" />
            </div>
            <div class="form-group">
              <label>断面名称 *</label>
              <input
                type="text"
                v-model="formData.name"
                required
                placeholder="如: 发电引水洞进口断面"
              />
            </div>
            <div class="form-group">
              <label>所属设施 *</label>
              <select v-model="formData.facility_id" required>
                <option value="">选择设施</option>
                <option v-for="f in store.facilities" :key="f.id" :value="f.id">
                  {{ f.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>断面类型</label>
              <input type="text" v-model="formData.section_type" placeholder="可选" />
            </div>
            <div class="form-group">
              <label>桩号</label>
              <input type="text" v-model="formData.chainage" placeholder="如: 0+100" />
            </div>
          </template>

          <div class="form-group checkbox">
            <label>
              <input type="checkbox" v-model="formData.is_simulated" />
              标记为模拟数据
            </label>
          </div>
        </form>

        <template #footer>
          <button class="btn-cancel" @click="store.closeFormModal">取消</button>
          <button class="btn-submit" @click="handleSubmit" :disabled="store.isSubmitting">
            <i v-if="store.isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
            {{ store.editingItem ? '保存修改' : '确认新增' }}
          </button>
        </template>
      </FormModal>

      <!-- Delete Confirm Modal -->
      <DeleteConfirmModal
        v-model="store.isDeleteModalOpen"
        :loading="store.isSubmitting"
        @confirm="store.confirmDelete"
      />
    </div>
  </ModalBox>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import ModalBox from '@/components/common/ModalBox.vue'
import { DataGrid, FormModal, DeleteConfirmModal } from '@/components/common/DataGrid'
import { useDataManagementStore, type EntityType } from '@/stores/dataManagement'
import * as adminApi from '@/api/admin'

const store = useDataManagementStore()

const tabs: { key: EntityType; label: string; icon: string }[] = [
  { key: 'sensors', label: '传感器', icon: 'fa-solid fa-microchip' },
  { key: 'readings', label: '读数', icon: 'fa-solid fa-chart-line' },
  { key: 'stations', label: '水文站', icon: 'fa-solid fa-water' },
  { key: 'facilities', label: '设施', icon: 'fa-solid fa-building' },
  { key: 'sections', label: '断面', icon: 'fa-solid fa-layer-group' },
]

// Column definitions per entity
const sensorColumns = [
  { key: 'id', label: 'ID', sortable: true, width: '60px' },
  { key: 'point_code', label: '测点编号', sortable: true },
  { key: 'sensor_type_name', label: '类型' },
  { key: 'section_name', label: '断面' },
  { key: 'status', label: '状态', type: 'status' as const },
  { key: 'is_simulated', label: '数据来源', type: 'boolean' as const },
]

const readingColumns = [
  { key: 'id', label: 'ID', sortable: true, width: '60px' },
  { key: 'sensor_name', label: '传感器' },
  { key: 'metric_key', label: '指标' },
  { key: 'value_num', label: '数值', sortable: true },
  { key: 'unit', label: '单位' },
  { key: 'reading_time', label: '时间', sortable: true, type: 'datetime' as const },
  { key: 'quality_flag', label: '质量' },
  { key: 'is_simulated', label: '来源', type: 'boolean' as const },
]

const stationColumns = [
  { key: 'id', label: 'ID', sortable: true, width: '60px' },
  { key: 'station_code', label: '站点编码', sortable: true },
  { key: 'station_name', label: '站点名称', sortable: true },
  { key: 'river_name', label: '河流' },
  { key: 'basin_name', label: '流域' },
  { key: 'facility_name', label: '所属设施' },
  { key: 'is_simulated', label: '来源', type: 'boolean' as const },
]

const facilityColumns = [
  { key: 'id', label: 'ID', sortable: true, width: '60px' },
  { key: 'code', label: '编码', sortable: true },
  { key: 'name', label: '名称', sortable: true },
  { key: 'facility_type', label: '类型' },
  { key: 'section_count', label: '断面数', sortable: true },
  { key: 'is_simulated', label: '来源', type: 'boolean' as const },
]

const sectionColumns = [
  { key: 'id', label: 'ID', sortable: true, width: '60px' },
  { key: 'code', label: '编码', sortable: true },
  { key: 'name', label: '名称', sortable: true },
  { key: 'facility_name', label: '所属设施' },
  { key: 'section_type', label: '类型' },
  { key: 'chainage', label: '桩号' },
  { key: 'sensor_count', label: '传感器数' },
  { key: 'is_simulated', label: '来源', type: 'boolean' as const },
]

const currentColumns = computed(() => {
  switch (store.activeEntity) {
    case 'sensors':
      return sensorColumns
    case 'readings':
      return readingColumns
    case 'stations':
      return stationColumns
    case 'facilities':
      return facilityColumns
    case 'sections':
      return sectionColumns
    default:
      return []
  }
})

// Whether create is supported for current entity
const canCreate = computed(() => store.activeEntity !== 'readings')

// Form data
const formData = reactive<Record<string, any>>({})

// Sections for sensor form
const sections = ref<adminApi.SectionAdmin[]>([])

async function loadSections() {
  try {
    const res = await adminApi.fetchSections({ page_size: 100 })
    sections.value = res.items
  } catch (e) {
    console.error('Failed to load sections:', e)
  }
}

// Watch for form modal open to populate form data
watch(
  () => store.isFormModalOpen,
  (open) => {
    if (open) {
      if (store.editingItem) {
        Object.assign(formData, store.editingItem)
      } else {
        // Reset form for new item
        Object.keys(formData).forEach((k) => delete formData[k])
        formData.is_simulated = false
        formData.status = 'active'
      }
    }
  }
)

async function handleSubmit() {
  await store.saveItem({ ...formData })
}

onMounted(async () => {
  await Promise.all([store.fetchData(), store.fetchLookups(), loadSections()])
})
</script>

<style scoped lang="scss">
@use 'sass:color';

.data-management {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  min-height: 500px;
}

.entity-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px 4px 0 0;
  color: $text-sub;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  i {
    font-size: 12px;
  }

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    color: $neon-cyan;
    background: rgba($neon-cyan, 0.1);
    border-color: rgba($neon-cyan, 0.3);
    border-bottom-color: transparent;
  }
}

.filter-select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: $text-main;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgba($neon-cyan, 0.5);
  }
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(90deg, rgba($neon-cyan, 0.2), rgba($neon-cyan, 0.3));
  border: 1px solid $neon-cyan;
  color: $neon-cyan;

  &:hover {
    background: $neon-cyan;
    color: #000;
  }
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: $text-sub;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }
}

.entity-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    color: $text-sub;
  }

  input[type='text'],
  input[type='number'],
  select,
  textarea {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 10px 12px;
    color: $text-main;
    font-size: 14px;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: $neon-cyan;
    }

    &::placeholder {
      color: $text-sub;
      opacity: 0.6;
    }
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  &.checkbox {
    flex-direction: row;
    align-items: center;

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: $neon-cyan;
    }
  }
}

.btn-cancel,
.btn-submit {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: $text-sub;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }
}

.btn-submit {
  background: $neon-cyan;
  border: 1px solid $neon-cyan;
  color: #000;

  &:hover:not(:disabled) {
    background: color.adjust($neon-cyan, $lightness: 10%);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
