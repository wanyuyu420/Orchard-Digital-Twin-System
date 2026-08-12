<template>
  <transition name="fade">
    <div v-if="visible" class="query-result-window glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span class="panel-title">查询结果</span>
          <span class="result-badge">{{ result?.totalTrees || 0 }} 棵</span>
          <span class="result-info" v-if="hasFilters">
            <i class="fa-solid fa-filter"></i> 已筛选
          </span>
        </div>
        <div class="header-right">
          <button class="btn-re" @click="toggleTreeMarkers" :title="showMarkers ? '隐藏标记' : '显示标记'">
            <i class="fa-solid" :class="showMarkers ? 'fa-eye' : 'fa-eye-slash'"></i>
          </button>
          <button class="close-btn" @click="close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="panel-body">
        <!-- 统计卡片 -->
        <div class="stats-row" v-if="result?.statistics">
          <div class="stat-item">
            <span class="stat-val">{{ result.statistics.averageNdvi.toFixed(2) }}</span>
            <span class="stat-lbl">平均NDVI</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ result.statistics.averageCanopyHeight.toFixed(1) }}m</span>
            <span class="stat-lbl">平均冠高</span>
          </div>
          <div class="stat-item">
            <span class="stat-val healthy">{{ result.statistics.healthyCount }}</span>
            <span class="stat-lbl">健康</span>
          </div>
          <div class="stat-item">
            <span class="stat-val warning">{{ result.statistics.warningCount }}</span>
            <span class="stat-lbl">预警</span>
          </div>
          <div class="stat-item">
            <span class="stat-val critical">{{ result.statistics.criticalCount }}</span>
            <span class="stat-lbl">严重</span>
          </div>
        </div>

        <!-- 搜索框 -->
        <div class="search-box">
          <i class="fa-solid fa-search"></i>
          <input v-model="searchText" placeholder="搜索果树ID、品种..." />
        </div>

        <!-- 果树列表 -->
        <div class="tree-list" v-if="filteredTrees.length > 0">
          <div
            v-for="poi in filteredTrees"
            :key="poi.id"
            class="tree-card"
            :class="{ selected: selectedTreeId === poi.id }"
            @click="selectTree(poi)"
          >
            <div class="tree-status" :class="poi.healthStatus"></div>
            <div class="tree-body">
              <div class="tree-name">{{ poi.name || poi.id }}</div>
              <div class="tree-meta">
                <span>冠高 {{ poi.canopyHeight }}m</span>
                <span>{{ poi.healthStatus === 'healthy' ? '健康' : poi.healthStatus === 'warning' ? '预警' : '严重' }}</span>
              </div>
            </div>
            <div class="tree-arrow">
              <i class="fa-solid fa-chevron-right"></i>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <i class="fa-solid fa-tree empty-icon"></i>
          <p>{{ searchText ? '没有匹配的果树' : '暂无查询结果' }}</p>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="panel-footer">
        <button class="foot-btn" @click="close">关闭</button>
        <button class="foot-btn primary" @click="flyToTrees" v-if="filteredTrees.length > 0">
          <i class="fa-solid fa-location-crosshairs"></i> 定位到地图
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { useCesiumStore } from '@/stores/cesium'
import type { FruitTreePoi, TsomQueryResult } from '@/types/orchard'

declare const Cesium: any

const orchardStore = useOrchardStore()
const cesiumStore = useCesiumStore()

const props = defineProps<{
  visible: boolean
  result: TsomQueryResult | null
}>()

const emit = defineEmits<{
  close: []
}>()

const searchText = ref('')
const selectedTreeId = ref<string | null>(null)
const showMarkers = ref(true)

const hasFilters = computed(() => {
  const r = props.result
  if (!r?.queryParams) return false
  const q = r.queryParams
  return !!(q.varieties?.length || q.healthStatuses?.length || q.startDate)
})

const filteredTrees = computed(() => {
  if (!props.result?.pois?.length) return []
  if (!searchText.value) return props.result.pois
  const t = searchText.value.toLowerCase()
  return props.result.pois.filter(
    (p: FruitTreePoi) =>
      p.id.toLowerCase().includes(t) ||
      p.name?.toLowerCase().includes(t) ||
      p.healthStatus.includes(t),
  )
})

function selectTree(poi: FruitTreePoi) {
  selectedTreeId.value = poi.id
  // 打开详情面板
  orchardStore.openDetailPanel(poi)
}

function toggleTreeMarkers() {
  showMarkers.value = !showMarkers.value
  // 让父级能控制标记显示
}

function flyToTrees() {
  const viewer = cesiumStore.viewer
  if (!viewer || !filteredTrees.value.length) return
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  filteredTrees.value.forEach((p: FruitTreePoi) => {
    if (p.longitude < minLon) minLon = p.longitude
    if (p.longitude > maxLon) maxLon = p.longitude
    if (p.latitude < minLat) minLat = p.latitude
    if (p.latitude > maxLat) maxLat = p.latitude
  })
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(minLon - 0.01, minLat - 0.01, maxLon + 0.01, maxLat + 0.01),
    duration: 1.5,
  })
}

function close() {
  emit('close')
}

watch(() => props.result, () => {
  selectedTreeId.value = null
  searchText.value = ''
})
</script>

<style scoped lang="scss">
.query-result-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 560px;
  max-height: 80vh;
  z-index: $z-layer-7;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: $neon-cyan;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .result-badge {
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 8px;
    background: rgba(34, 211, 238, 0.1);
    color: $neon-cyan;
  }

  .result-info {
    font-size: 11px;
    color: $orchard-orange;
    padding: 2px 8px;
    border-radius: 8px;
    background: rgba(251, 146, 60, 0.1);
  }

  .btn-re {
    background: none;
    border: 1px solid $border-subtle;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;

    &:hover { color: $text-main; border-color: $border-glass; }
  }

  .close-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover { color: $alert-red; }
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
}

.stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);

  .stat-item {
    flex: 1;
    text-align: center;

    .stat-val {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: $neon-cyan;
      font-family: $font-code;

      &.healthy { color: $success-green; }
      &.warning { color: $warn-yellow; }
      &.critical { color: $alert-red; }
    }
    .stat-lbl {
      font-size: 10px;
      color: $text-dim;
      margin-top: 2px;
    }
  }
}

.variety-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;

  .variety-tag {
    font-size: 11px;
    padding: 2px 10px;
    border-radius: 10px;
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
    color: $orchard-green;
  }
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid $border-subtle;
  border-radius: 8px;
  margin-bottom: 12px;

  i { color: $text-dim; font-size: 13px; }

  input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: $text-main;
    font-size: 13px;
    font-family: $font-ui;

    &::placeholder { color: $text-dim; }
  }
}

.tree-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tree-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;

  &:hover { background: rgba(255, 255, 255, 0.05); }

  &.selected {
    border-color: $orchard-orange;
    background: rgba(251, 146, 60, 0.08);
  }

  .tree-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    &.healthy { background: $success-green; }
    &.warning { background: $warn-yellow; }
    &.critical { background: $alert-red; }
  }

  .tree-body {
    flex: 1;
    min-width: 0;

    .tree-name {
      font-size: 13px;
      font-weight: 500;
      color: $text-main;
    }
    .tree-meta {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;
      span {
        font-size: 11px;
        color: $text-dim;
        background: rgba(100, 116, 139, 0.1);
        padding: 1px 6px;
        border-radius: 3px;
      }
    }
  }

  .tree-arrow { color: $text-dim; font-size: 12px; }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    color: $text-dim;
    margin-bottom: 12px;
  }
  p { color: $text-sub; font-size: 13px; }
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid $border-subtle;

  .foot-btn {
    padding: 7px 16px;
    border-radius: 8px;
    border: 1px solid $border-subtle;
    background: transparent;
    color: $text-sub;
    cursor: pointer;
    font-size: 13px;
    font-family: $font-ui;
    transition: all 0.15s;

    &:hover { color: $text-main; border-color: $border-glass; }

    &.primary {
      background: rgba(34, 211, 238, 0.15);
      border-color: rgba(34, 211, 238, 0.3);
      color: $neon-cyan;
      &:hover { background: rgba(34, 211, 238, 0.25); }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
