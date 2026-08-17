<template>
  <transition name="fade">
    <div v-if="orchardStore.showFertilizationWindow" class="fertilization-window glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <i class="fa-solid fa-droplet"></i>
          <span class="panel-title">变量施肥方案</span>
        </div>
        <div class="header-right">
          <button class="close-btn" @click="orchardStore.showFertilizationWindow = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="panel-body">
        <!-- 计算中 -->
        <div v-if="orchardStore.fertilizationLoading" class="loading-state">
          <i class="fa-solid fa-circle-notch fa-spin loading-icon"></i>
          <p>正在计算施肥方案…</p>
        </div>

        <!-- 出错 -->
        <div v-else-if="orchardStore.fertilizationError" class="error-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{{ orchardStore.fertilizationError }}</span>
        </div>

        <!-- 无方案 → 引导生成 -->
        <div v-else-if="!orchardStore.fertilizerPlan" class="empty-state">
          <i class="fa-solid fa-droplet empty-icon"></i>
          <p>{{ hasSelection ? '已框选区域，点击下方按钮生成方案' : '请先在地图框选区域' }}</p>
          <p class="empty-hint">
            系统将按生长指数/树冠面积/紧密度/坡度四项指标，为区域内的每棵树推荐施肥等级
          </p>
        </div>

        <!-- 有方案 → 三档统计 + 明细 -->
        <template v-else>
          <div class="stats-row">
            <div class="stat-card light">
              <div class="stat-num">{{ orchardStore.fertilizerPlan.summary.light_level_count }}</div>
              <div class="stat-label">轻度施肥</div>
            </div>
            <div class="stat-card medium">
              <div class="stat-num">{{ orchardStore.fertilizerPlan.summary.medium_level_count }}</div>
              <div class="stat-label">中度施肥</div>
            </div>
            <div class="stat-card heavy">
              <div class="stat-num">{{ orchardStore.fertilizerPlan.summary.heavy_level_count }}</div>
              <div class="stat-label">重度施肥</div>
            </div>
          </div>

          <div class="meta-row">
            <span>共 {{ orchardStore.fertilizerPlan.total_trees }} 棵树</span>
            <span>分级：{{ orchardStore.fertilizerPlan.mode === 'quantile' ? '区域内分位' : '固定阈值' }}</span>
            <span v-if="orchardStore.fertilizerPlan.applied" class="applied-tag">
              <i class="fa-solid fa-check"></i> 已写回施肥等级
            </span>
          </div>

          <div class="plan-list">
            <div v-for="item in orchardStore.fertilizerPlan.plan" :key="item.id" class="plan-item">
              <span class="tree-id">树 #{{ item.id }}</span>
              <span class="demand">需肥得分 {{ (item.demand_score * 100).toFixed(0) }}%</span>
              <span class="level-change">
                <span class="level-badge" :class="levelClass(item.current_level)">
                  {{ levelLabel(item.current_level) }}
                </span>
                <i class="fa-solid fa-arrow-right"></i>
                <span class="level-badge" :class="levelClass(item.recommended_level)">
                  {{ levelLabel(item.recommended_level) }}
                </span>
              </span>
            </div>
            <div v-if="orchardStore.fertilizerPlan.plan.length === 0" class="empty-hint" style="text-align: center">
              框选区域内未检测到果树
            </div>
          </div>
        </template>
      </div>

      <div class="panel-footer">
        <!-- 无方案 → 单个生成按钮 -->
        <template v-if="!orchardStore.fertilizerPlan && !orchardStore.fertilizationLoading">
          <el-button
            type="primary"
            size="small"
            :disabled="!hasSelection"
            :loading="orchardStore.fertilizationLoading"
            @click="onGenerate"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            生成施肥方案
          </el-button>
          <span v-if="!hasSelection" class="footer-hint">请先在地图框选区域</span>
        </template>

        <!-- 有方案 → 写回选项 + 重新生成 + 导出 -->
        <template v-else-if="orchardStore.fertilizerPlan">
          <el-checkbox v-model="applyOnWrite" size="small" style="color: #94a3b8">
            生成时写回施肥等级
          </el-checkbox>
          <div class="footer-actions">
            <el-button
              size="small"
              :loading="orchardStore.fertilizationLoading"
              @click="onRegenerate"
            >
              <i class="fa-solid fa-rotate"></i>
              重新生成
            </el-button>
            <el-dropdown trigger="click" @command="onExport">
              <el-button size="small">
                <i class="fa-solid fa-download"></i>
                导出处方图
                <i class="fa-solid fa-chevron-down"></i>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="csv">CSV（机具作业表）</el-dropdown-item>
                  <el-dropdown-item command="geojson">GeoJSON（地图要素）</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

const applyOnWrite = ref(false)

const hasSelection = computed(() => !!orchardStore.selectionRange)

function onGenerate() {
  orchardStore.generateFertilizationPlan({ apply: applyOnWrite.value }).catch(() => {})
}

function onRegenerate() {
  orchardStore.generateFertilizationPlan({ apply: applyOnWrite.value }).catch(() => {})
}

function onExport(format: 'csv' | 'geojson') {
  orchardStore.exportFertilizationPlan(format).catch(() => {})
}

/** 施肥等级 → 中文标签（1 轻度 / 2 中度 / 3 重度） */
function levelLabel(level: number): string {
  switch (level) {
    case 1: return '轻度'
    case 2: return '中度'
    case 3: return '重度'
    default: return '未定'
  }
}

/** 施肥等级 → 徽章颜色（轻=绿 中=黄 重=红） */
function levelClass(level: number): string {
  switch (level) {
    case 1: return 'lv-light'
    case 2: return 'lv-medium'
    case 3: return 'lv-heavy'
    default: return 'lv-none'
  }
}
</script>

<style scoped lang="scss">
.fertilization-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  max-height: 70vh;
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
    gap: 12px;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
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
  padding: 18px;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid $border-subtle;

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .footer-hint {
    font-size: 12px;
    color: $text-dim;
  }
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: $text-sub;

  .loading-icon {
    font-size: 32px;
    color: $neon-cyan;
    margin-bottom: 10px;
  }

  p { font-size: 13px; }
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: $alert-red;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    color: $text-dim;
    margin-bottom: 12px;
  }

  p {
    color: $text-sub;
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
    color: $text-dim;
    margin-top: 6px;
    line-height: 1.6;
  }
}

// ---- 三档统计 ----
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat-card {
  text-align: center;
  padding: 12px 8px;
  border-radius: 10px;
  border: 1px solid $border-subtle;

  &.light { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.06); }
  &.medium { border-color: rgba(234, 179, 8, 0.3); background: rgba(234, 179, 8, 0.06); }
  &.heavy { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.06); }

  .stat-num {
    font-size: 22px;
    font-weight: 700;
    color: $text-main;
  }

  .stat-label {
    font-size: 11px;
    color: $text-sub;
    margin-top: 2px;
  }
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: $text-dim;
  margin-bottom: 10px;

  .applied-tag {
    color: $success-green;
  }
}

// ---- 明细列表 ----
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid $border-subtle;
  font-size: 12px;

  .tree-id {
    color: $text-sub;
    font-weight: 600;
    min-width: 56px;
  }

  .demand {
    color: $text-dim;
    flex: 1;
  }

  .level-change {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.level-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;

  &.lv-light { color: $success-green; background: rgba(34, 197, 94, 0.1); }
  &.lv-medium { color: $warn-yellow; background: rgba(234, 179, 8, 0.1); }
  &.lv-heavy { color: $alert-red; background: rgba(239, 68, 68, 0.1); }
  &.lv-none { color: $text-dim; background: rgba(100, 116, 139, 0.1); }
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
