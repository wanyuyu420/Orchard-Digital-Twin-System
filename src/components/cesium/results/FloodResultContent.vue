<template>
  <div class="flood-result">
    <div class="data-item highlight">
      <span class="data-label">
        <i class="fa-solid fa-water"></i>
        当前水位
      </span>
      <span class="data-value">{{ data.waterLevel?.toFixed(1) }} m</span>
    </div>

    <div class="data-item">
      <span class="data-label">
        <i class="fa-solid fa-vector-square"></i>
        淹没面积
      </span>
      <span class="data-value">{{ formatArea(data.floodedArea) }}</span>
    </div>

    <div class="data-item">
      <span class="data-label">
        <i class="fa-solid fa-cube"></i>
        淹没体积
      </span>
      <span class="data-value">{{ formatVolume(data.floodedVolume) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: any
}

const props = defineProps<Props>()

const formatVolume = (cubic: number): string => {
  if (!cubic) return '0 m³'
  if (cubic >= 1e6) return `${(cubic / 1e6).toFixed(2)} km³`
  if (cubic >= 1e3) return `${(cubic / 1e3).toFixed(1)} 千m³`
  return `${cubic.toFixed(1)} m³`
}

const formatArea = (sqMeters: number): string => {
  if (!sqMeters) return '0 m²'
  if (sqMeters >= 1e6) return `${(sqMeters / 1e6).toFixed(2)} km²`
  if (sqMeters >= 1e4) return `${(sqMeters / 1e4).toFixed(2)} 公顷`
  return `${sqMeters.toFixed(0)} m²`
}
</script>
