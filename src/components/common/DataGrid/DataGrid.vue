<template>
  <div class="data-grid">
    <!-- Toolbar -->
    <div class="grid-toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <i class="fa-solid fa-search"></i>
          <input type="text" v-model="searchQuery" placeholder="搜索..." @input="onSearchInput" />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <slot name="filters"></slot>
      </div>

      <div class="toolbar-right">
        <span class="total-count">共 {{ total.toLocaleString() }} 条</span>
        <button class="btn-secondary" @click="$emit('export')">
          <i class="fa-solid fa-download"></i> 导出
        </button>
        <button class="btn-primary" @click="$emit('create')">
          <i class="fa-solid fa-plus"></i> 新增
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="{ sortable: col.sortable, sorted: sortBy === col.key }"
              :style="col.width ? { width: col.width } : {}"
              @click="col.sortable && toggleSort(col.key)"
            >
              {{ col.label }}
              <i v-if="col.sortable" :class="getSortIcon(col.key)"></i>
            </th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length + 1" class="loading-cell">
              <i class="fa-solid fa-spinner fa-spin"></i> 加载中...
            </td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td :colspan="columns.length + 1" class="empty-cell">
              <i class="fa-solid fa-inbox"></i> 暂无数据
            </td>
          </tr>
          <tr v-else v-for="item in items" :key="item.id">
            <td v-for="col in columns" :key="col.key">
              <template v-if="col.render">
                <component :is="col.render" :value="item[col.key]" :item="item" />
              </template>
              <template v-else-if="col.type === 'boolean'">
                <span :class="item[col.key] ? 'tag-simulated' : 'tag-real'">
                  {{ item[col.key] ? '模拟' : '真实' }}
                </span>
              </template>
              <template v-else-if="col.type === 'status'">
                <span :class="'status-' + item[col.key]">{{ item[col.key] }}</span>
              </template>
              <template v-else-if="col.type === 'datetime'">
                {{ formatDateTime(item[col.key]) }}
              </template>
              <template v-else>
                {{ item[col.key] ?? '-' }}
              </template>
            </td>
            <td class="actions-cell">
              <button class="action-btn edit" @click="$emit('edit', item)" title="编辑">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="action-btn delete" @click="$emit('delete', item)" title="删除">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="grid-pagination">
      <div class="page-size-selector">
        <span>每页</span>
        <select v-model.number="localPageSize" @change="onPageSizeChange">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
        <span>条</span>
      </div>

      <div class="page-controls">
        <button class="page-btn" :disabled="page <= 1" @click="goToPage(page - 1)">
          <i class="fa-solid fa-chevron-left"></i>
        </button>

        <template v-for="p in visiblePages" :key="p">
          <span v-if="p === '...'" class="page-ellipsis">...</span>
          <button
            v-else
            class="page-btn"
            :class="{ active: p === page }"
            @click="goToPage(p as number)"
          >
            {{ p }}
          </button>
        </template>

        <button class="page-btn" :disabled="page >= totalPages" @click="goToPage(page + 1)">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <div class="page-info">第 {{ page }} / {{ totalPages }} 页</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  width?: string
  type?: 'text' | 'boolean' | 'status' | 'datetime' | 'number'
  render?: any
}

const props = defineProps<{
  columns: Column[]
  items: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  loading?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', size: number): void
  (e: 'update:sortBy', key: string): void
  (e: 'update:sortOrder', order: 'asc' | 'desc'): void
  (e: 'search', query: string): void
  (e: 'create'): void
  (e: 'edit', item: any): void
  (e: 'delete', item: any): void
  (e: 'export'): void
}>()

const searchQuery = ref('')
const localPageSize = ref(props.pageSize)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.pageSize,
  (val) => {
    localPageSize.value = val
  }
)

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('search', searchQuery.value)
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''
  emit('search', '')
}

function toggleSort(key: string) {
  if (props.sortBy === key) {
    emit('update:sortOrder', props.sortOrder === 'asc' ? 'desc' : 'asc')
  } else {
    emit('update:sortBy', key)
    emit('update:sortOrder', 'desc')
  }
}

function getSortIcon(key: string): string {
  if (props.sortBy !== key) return 'fa-solid fa-sort'
  return props.sortOrder === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'
}

function goToPage(p: number) {
  if (p >= 1 && p <= props.totalPages) {
    emit('update:page', p)
  }
}

function onPageSizeChange() {
  emit('update:pageSize', localPageSize.value)
  emit('update:page', 1)
}

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = props.totalPages
  const current = props.page

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')

    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) pages.push(i)

    if (current < total - 2) pages.push('...')
    pages.push(total)
  }

  return pages
})

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped lang="scss">
.data-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.grid-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 10px;
  min-width: 200px;

  i {
    color: $text-sub;
    font-size: 12px;
  }

  input {
    flex: 1;
    background: none;
    border: none;
    color: $text-main;
    font-size: 13px;
    margin-left: 8px;
    outline: none;

    &::placeholder {
      color: $text-sub;
    }
  }

  .clear-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 0 4px;

    &:hover {
      color: $text-main;
    }
  }
}

.total-count {
  font-size: 12px;
  color: $text-sub;
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

.table-container {
  flex: 1;
  overflow: auto;
  @include custom-scrollbar;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
  }

  th {
    background: rgba(0, 0, 0, 0.3);
    color: $text-sub;
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;

    &.sortable {
      cursor: pointer;
      user-select: none;

      &:hover {
        color: $text-main;
      }

      i {
        margin-left: 4px;
        font-size: 10px;
      }
    }

    &.sorted {
      color: $neon-cyan;
    }
  }

  td {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .actions-col {
    width: 80px;
    text-align: center;
  }

  .actions-cell {
    text-align: center;
  }
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 40px !important;
  color: $text-sub;

  i {
    margin-right: 8px;
  }
}

.action-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &.edit {
    color: $neon-cyan;

    &:hover {
      background: rgba($neon-cyan, 0.1);
    }
  }

  &.delete {
    color: $alert-red;

    &:hover {
      background: rgba($alert-red, 0.1);
    }
  }
}

.tag-simulated {
  background: rgba($warn-yellow, 0.15);
  color: $warn-yellow;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.tag-real {
  background: rgba($success-green, 0.15);
  color: $success-green;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.status-active {
  color: $success-green;
}

.status-offline,
.status-deleted {
  color: $text-sub;
}

.status-warning {
  color: $warn-yellow;
}

.grid-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: $text-sub;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 6px;

  select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: $text-main;
    padding: 4px 8px;
    cursor: pointer;
  }
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: $text-sub;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }

  &.active {
    background: $neon-cyan;
    border-color: $neon-cyan;
    color: #000;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.page-ellipsis {
  padding: 0 4px;
}

.page-info {
  min-width: 100px;
  text-align: right;
}
</style>
