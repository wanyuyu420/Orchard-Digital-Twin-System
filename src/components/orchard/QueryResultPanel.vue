<template>
  <transition name="slide-right">
    <!-- 3查询结果窗口 -->
    <div v-if="orchardStore.showResultPanel && orchardStore.tsomQueryResult" class="result-panel glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <button class="back-btn" @click="orchardStore.goBackQueryLevel">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="panel-title">查询结果</span>
          <span class="result-count">
            {{ orchardStore.tsomQueryResult.totalTrees }} 棵果树
          </span>
        </div>
        <button class="close-btn" @click="orchardStore.closeAllPanels">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 统计概览 -->
      <div class="stats-overview" v-if="orchardStore.tsomQueryResult.statistics">
        <div class="stat-item">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.statistics.averageCanopyHeight.toFixed(1) }}m</span>
          <span class="stat-label">平均冠高</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.statistics.averageCanopyVolume.toFixed(1) }}m³</span>
          <span class="stat-label">平均体积</span>
        </div>
        <div class="stat-item">
          <span class="stat-value healthy">{{ orchardStore.tsomQueryResult.statistics.healthyCount }}</span>
          <span class="stat-label">健康</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ orchardStore.tsomQueryResult.totalTrees }}</span>
          <span class="stat-label">总数</span>
        </div>
      </div>

      <!-- 果树POI列表 - 4点击结果项弹出详细内容窗口 -->
      <div class="poi-list">
        <div class="section-label">果树列表</div>
        <div
          v-for="poi in orchardStore.tsomQueryResult.pois"
          :key="poi.id"
          class="poi-item"
          @click="onPoiClick(poi)"
        >
          <div class="poi-status" :class="poi.healthStatus"></div>
          <div class="poi-info">
            <div class="poi-name">{{ poi.name || `果树 #${poi.id.slice(0, 8)}` }}</div>
            <div class="poi-meta">
                <span>冠高 {{ poi.canopyHeight }}m</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right poi-arrow"></i>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useOrchardStore } from '@/stores/orchard'
import type { FruitTreePoi } from '@/types/orchard'

const orchardStore = useOrchardStore()

function onPoiClick(poi: FruitTreePoi) {
  // 4点击结果窗口，弹出更详细内容的窗口
  orchardStore.openDetailPanel(poi)
}
</script>

<style scoped lang="scss">
.result-panel {
  position: absolute;
  right: 24px;
  top: 80px;
  width: 460px;
  max-height: calc(100vh - 120px);
  z-index: $z-layer-6;
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
    gap: 10px;
  }

  .back-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover {
      color: $text-main;
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .result-count {
    font-size: 12px;
    color: $orchard-orange;
    background: rgba(251, 146, 60, 0.1);
    padding: 2px 10px;
    border-radius: 8px;
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

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;

  .stat-item {
    text-align: center;

    .stat-value {
      display: block;
      font-size: 20px;
      font-weight: 700;
      color: $neon-cyan;
      font-family: $font-code;

      &.healthy { color: $success-green; }
    }

    .stat-label {
      font-size: 11px;
      color: $text-dim;
      margin-top: 2px;
    }
  }
}

.variety-dist {
  padding: 12px 18px;
  border-bottom: 1px solid $border-subtle;

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .variety-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .variety-tag {
    font-size: 12px;
    padding: 3px 10px;
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 12px;
    color: $orchard-green;
  }
}

.poi-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px;

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.poi-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .poi-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &.healthy { background: $success-green; }
    &.warning { background: $warn-yellow; }
    &.critical { background: $alert-red; }
  }

  .poi-info {
    flex: 1;
    min-width: 0;

    .poi-name {
      font-size: 13px;
      color: $text-main;
      font-weight: 500;
    }

    .poi-meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: $text-dim;
      margin-top: 2px;

      span {
        background: rgba(100, 116, 139, 0.1);
        padding: 1px 6px;
        border-radius: 3px;
      }
    }
  }

  .poi-arrow {
    color: $text-dim;
    font-size: 12px;
  }
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s $ease-out;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
