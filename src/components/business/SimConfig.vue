<template>
  <GlassPanel title="仿真配置" icon="fa-solid fa-sliders" :actions="['import', 'save']">
    <!-- Engine Select -->
    <div class="form-group">
      <label class="form-label">模型引擎</label>
      <select class="form-select" :value="state.engine" @change="onEngineChange">
        <option value="flood">HEC-RAS (洪水演进)</option>
        <option value="hydro">MIKE Hydro (流域水动力)</option>
        <option value="dam">HST-Stat (大坝位移回归)</option>
      </select>
    </div>

    <!-- Flood Event Select (for flood/hydro engines) -->
    <div v-if="state.engine !== 'dam' && store.floodEvents.length > 0" class="form-group">
      <label class="form-label">洪水事件</label>
      <select class="form-select" :value="store.selectedEventId" @change="onEventChange">
        <option v-for="event in store.floodEvents" :key="event.id" :value="event.id">
          {{ event.name }} ({{ severityLabel(event.severity) }})
        </option>
      </select>
      <div v-if="store.selectedEvent" class="event-info">
        <span class="event-tag" :class="'level-' + store.selectedEvent.level">
          {{ store.selectedEvent.level.toUpperCase() }}
        </span>
        <span class="event-region">{{ store.selectedEvent.region }}</span>
      </div>
    </div>

    <!-- Dynamic Forms -->
    <div v-if="state.engine !== 'dam'" class="form-group">
      <label class="form-label">入库流量 (m³/s)</label>
      <div class="range-wrapper">
        <input
          type="range"
          min="0"
          max="5000"
          step="10"
          v-model.number="state.flow"
          class="form-range"
        />
        <span class="value-display font-mono text-neon">{{ state.flow }}</span>
      </div>

      <label class="form-label mt-3">河道糙率 (n)</label>
      <input type="number" class="form-input" v-model.number="state.roughness" step="0.001" />
    </div>

    <div v-else class="form-group">
      <label class="form-label">库水位 (m)</label>
      <input type="number" class="form-input" v-model.number="state.waterHeight" />

      <label class="form-label">环境温度 (°C)</label>
      <input type="number" class="form-input" v-model.number="state.temperature" />

      <label class="form-label">时效因子 (θ)</label>
      <input type="number" class="form-input" v-model.number="state.agingFactor" step="0.001" />
    </div>

    <button class="btn-primary mt-4" :disabled="store.isLoading">
      <i class="fa-solid" :class="store.isLoading ? 'fa-spinner fa-spin' : 'fa-play'"></i>
      {{ store.isLoading ? '加载中...' : '开始计算' }}
    </button>
  </GlassPanel>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSimulationStore } from '@/stores/simulation'
import GlassPanel from '@/components/common/GlassPanel.vue'
import type { SimEngine } from '@/types/simulation'

const store = useSimulationStore()
const { state } = storeToRefs(store)

function onEngineChange(e: Event) {
  const target = e.target as HTMLSelectElement
  store.setEngine(target.value as SimEngine)
}

function onEventChange(e: Event) {
  const target = e.target as HTMLSelectElement
  store.selectEvent(target.value)
}

function severityLabel(severity: string): string {
  const labels: Record<string, string> = {
    mild: '中小洪水',
    medium: '大洪水',
    severe: '特大洪水',
  }
  return labels[severity] || severity
}
</script>

<style scoped lang="scss">
.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 5px;
}

.mt-3 {
  margin-top: 12px;
}
.mt-4 {
  margin-top: 20px;
}

.form-select,
.form-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  color: #fff;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-family: $font-ui;

  &:focus {
    border-color: $neon-cyan;
  }
}

.event-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.event-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: bold;

  &.level-blue {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  &.level-yellow {
    background: rgba(234, 179, 8, 0.2);
    color: $warn-yellow;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  &.level-orange {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }
  &.level-red {
    background: rgba(239, 68, 68, 0.2);
    color: $alert-red;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
}

.event-region {
  font-size: 11px;
  color: $text-sub;
}

.range-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-range {
  flex: 1;
  accent-color: $neon-cyan;
  height: 4px;
  cursor: pointer;
}

.value-display {
  width: 50px;
  text-align: right;
  font-size: 14px;
}

.text-neon {
  @include text-glow($neon-cyan);
}

.btn-primary {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.1), rgba(34, 211, 238, 0.2));
  border: 1px solid $neon-cyan;
  color: $neon-cyan;
  padding: 10px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: $neon-cyan;
    color: #000;
    @include box-glow($neon-cyan);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
