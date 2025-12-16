<template>
  <GlassPanel title="未来趋势" icon="fa-solid fa-cloud-sun-rain">
    <div class="weather-row">
      <div class="weather-item">
        <div class="day">今天</div>
        <i class="weather-icon fa-solid fa-cloud-showers-heavy text-neon"></i>
        <div class="precip font-mono">{{ store.totalRainfall.toFixed(1) }}mm</div>
      </div>
      <div class="weather-item">
        <div class="day">明天</div>
        <i class="weather-icon fa-solid fa-cloud-rain"></i>
        <div class="precip font-mono">20mm</div>
      </div>
      <div class="weather-item">
        <div class="day">周三</div>
        <i class="weather-icon fa-solid fa-sun text-warn"></i>
        <div class="precip font-mono">0mm</div>
      </div>
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard'
import GlassPanel from '@/components/common/GlassPanel.vue'

const store = useDashboardStore()
</script>

<style scoped lang="scss">
.weather-row {
  display: flex;
  justify-content: space-between;
  text-align: center;
}

.weather-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.day {
  font-size: 12px;
  color: $text-sub;
}

.weather-icon {
  font-size: 18px;
  margin: 4px 0;
}

.precip {
  font-size: 12px;
  font-weight: bold;
}

.text-neon {
  @include text-glow($neon-cyan);
}

.text-warn {
  color: $warn-yellow;
  text-shadow: 0 0 8px rgba($warn-yellow, 0.4);
}
</style>
