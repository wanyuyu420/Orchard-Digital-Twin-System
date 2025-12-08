<template>
  <div class="simulation-layout">
    <!-- Flood Visualization Layer (rendered when engine is flood/hydro) -->
    <FloodLayer v-if="isFloodEngine" />

    <!-- Left Sidebar: Config -->
    <transition name="sidebar-left">
      <aside v-show="!isUiHidden" class="sidebar left">
        <SimConfig />
      </aside>
    </transition>

    <!-- Right Sidebar: Results -->
    <transition name="sidebar-right">
      <aside v-show="!isUiHidden" class="sidebar right">
        <SimResult />
      </aside>
    </transition>

    <!-- Bottom Dock: Timeline -->
    <transition name="slide-up">
      <div v-show="!isUiHidden" class="bottom-timeline-container">
        <TimelineControl />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSimulationStore } from '@/stores/simulation';
import SimConfig from '@/components/business/SimConfig.vue';
import SimResult from '@/components/business/SimResult.vue';
import TimelineControl from '@/components/common/TimelineControl.vue';
import FloodLayer from '@/components/cesium/FloodLayer.vue';

const appStore = useAppStore();
const simulationStore = useSimulationStore();
const isUiHidden = computed(() => appStore.isUiHidden);

// Show flood layer when engine is flood or hydro
const isFloodEngine = computed(() => {
  const engine = simulationStore.state.engine;
  return engine === 'flood' || engine === 'hydro';
});

onMounted(() => {
  simulationStore.fetchData();
});
</script>

<style scoped lang="scss">
.simulation-layout {
  display: flex;
  justify-content: space-between;
  height: 100%;
  padding: 20px;
  pointer-events: none;
}

.sidebar {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  pointer-events: auto;
}

.bottom-timeline-container {
  position: absolute;
  bottom: 100px; /* Above dock */
  left: 380px;   /* Clear left sidebar */
  right: 380px;  /* Clear right sidebar */
  pointer-events: auto;
}

// Transition for bottom panel
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s $ease-out;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>