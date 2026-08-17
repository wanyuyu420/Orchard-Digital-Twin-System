<template>
  <transition name="fade">
    <div v-if="orchardStore.showAlertsWindow" class="alerts-window glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span class="panel-title">弱树告警</span>
          <span v-if="orchardStore.alertsTotal > 0" class="total-badge">
            {{ orchardStore.alertsTotal }}
          </span>
        </div>
        <div class="header-right">
          <button class="close-btn" @click="orchardStore.showAlertsWindow = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="panel-body">
        <!-- 加载中 -->
        <div v-if="orchardStore.alertsLoading" class="loading-state">
          <i class="fa-solid fa-circle-notch fa-spin loading-icon"></i>
          <p>正在巡检弱树…</p>
        </div>

        <!-- 查询失败（GeoScene 冷缓存超时等） -->
        <div v-else-if="orchardStore.alertsError" class="error-state">
          <i class="fa-solid fa-triangle-exclamation error-icon"></i>
          <p>弱树告警查询失败</p>
          <p class="error-hint">{{ orchardStore.alertsError }}</p>
          <el-button
            size="small"
            :loading="orchardStore.alertsLoading"
            @click="orchardStore.fetchTreeAlerts().catch(() => {})"
          >
            <i class="fa-solid fa-rotate"></i>
            重新查询
          </el-button>
        </div>

        <!-- 空态 -->
        <div v-else-if="orchardStore.alerts.length === 0" class="empty-state">
          <i class="fa-solid fa-circle-check empty-icon"></i>
          <p>无弱树告警</p>
          <p class="empty-hint">当前没有生长指数低于阈值的果树</p>
        </div>

        <!-- 告警列表 -->
        <template v-else>
          <div class="threshold-row">
            <i class="fa-solid fa-filter"></i>
            生长指数阈值 &lt; {{ orchardStore.alertsThreshold }}
            <span class="threshold-count">命中 {{ orchardStore.alertsTotal }} 棵</span>
          </div>

          <div class="alert-list">
            <div v-for="tree in orchardStore.alerts" :key="tree.id" class="alert-item">
              <span class="alert-dot"></span>
              <div class="alert-info">
                <div class="alert-title">
                  树 #{{ tree.id }}
                  <span
                    v-if="tree.growth_index !== null && tree.growth_index !== undefined"
                    class="growth-index"
                    :class="{ missing: tree.growth_index < 0.4 }"
                  >
                    长势 {{ tree.growth_index.toFixed(2) }}
                  </span>
                </div>
                <div class="alert-meta">
                  <span>经度 {{ fmtCoord(tree.lng) }}</span>
                  <span>纬度 {{ fmtCoord(tree.lat) }}</span>
                  <span v-if="tree.area_m2 !== null && tree.area_m2 !== undefined">
                    冠幅 {{ tree.area_m2.toFixed(1) }}㎡
                  </span>
                </div>
              </div>
              <span class="fert-badge" :class="fertClass(tree.fertilizer_level)">
                {{ fertLabel(tree.fertilizer_level) }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <div class="panel-footer">
        <div class="footer-hint">
          <el-checkbox v-model="orchardStore.alertsVisible" size="small" style="color: #94a3b8">
            地图显示红点
          </el-checkbox>
        </div>
        <el-button
          size="small"
          :loading="orchardStore.alertsLoading"
          @click="orchardStore.fetchTreeAlerts().catch(() => {})"
        >
          <i class="fa-solid fa-rotate"></i>
          刷新
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

/** 坐标格式化：null/undefined/NaN 显示 "--"，避免 toFixed 崩溃 */
function fmtCoord(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v)
    ? '--'
    : v.toFixed(5)
}

/** 施肥等级 → 中文标签 */
function fertLabel(level: number): string {
  switch (level) {
    case 1: return '轻度施肥'
    case 2: return '中度施肥'
    case 3: return '重度施肥'
    default: return '未施肥'
  }
}

function fertClass(level: number): string {
  switch (level) {
    case 1: return 'fert-light'
    case 2: return 'fert-medium'
    case 3: return 'fert-heavy'
    default: return 'fert-none'
  }
}
</script>

<style scoped lang="scss">
.alerts-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 480px;
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
    color: $alert-red;
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

  .total-badge {
    font-size: 11px;
    font-weight: 600;
    color: $alert-red;
    background: rgba(239, 68, 68, 0.1);
    padding: 1px 8px;
    border-radius: 10px;
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
  padding: 12px 18px;
  border-top: 1px solid $border-subtle;

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
    color: $alert-red;
    margin-bottom: 10px;
  }

  p { font-size: 13px; }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    color: $success-green;
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
  }
}

.error-state {
  text-align: center;
  padding: 32px 20px;
  color: $text-sub;

  .error-icon {
    font-size: 36px;
    color: $alert-red;
    margin-bottom: 10px;
  }

  p {
    font-size: 14px;
    color: $text-sub;
  }

  .error-hint {
    font-size: 12px;
    color: $text-dim;
    margin: 6px 0 14px;
    word-break: break-all;
  }
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $text-sub;
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);

  .threshold-count {
    margin-left: auto;
    color: $alert-red;
    font-weight: 600;
  }
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid $border-subtle;

  .alert-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $alert-red;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
    flex-shrink: 0;
  }

  .alert-info {
    flex: 1;
    min-width: 0;
  }

  .alert-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: $text-main;

    .growth-index {
      font-size: 11px;
      font-weight: 500;
      color: $warn-yellow;
      padding: 0 6px;
      border-radius: 8px;
      background: rgba(234, 179, 8, 0.1);

      &.missing {
        color: $alert-red;
        background: rgba(239, 68, 68, 0.1);
      }
    }
  }

  .alert-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: $text-dim;
    margin-top: 3px;
  }
}

.fert-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
  flex-shrink: 0;

  &.fert-light { color: $success-green; background: rgba(34, 197, 94, 0.1); }
  &.fert-medium { color: $warn-yellow; background: rgba(234, 179, 8, 0.1); }
  &.fert-heavy { color: $alert-red; background: rgba(239, 68, 68, 0.1); }
  &.fert-none { color: $text-dim; background: rgba(100, 116, 139, 0.1); }
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
