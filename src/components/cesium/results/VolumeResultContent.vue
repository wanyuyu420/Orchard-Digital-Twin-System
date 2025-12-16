<template>
  <div class="volume-result">
    <div class="data-item highlight">
      <span class="data-label">
        <i class="fa-solid fa-cube"></i>
        体积
      </span>
      <span class="data-value">{{ formatVolume(data.volume) }}</span>
    </div>

    <div class="data-item">
      <span class="data-label">
        <i class="fa-solid fa-vector-square"></i>
        面积
      </span>
      <span class="data-value">{{ formatArea(data.area) }}</span>
    </div>

    <div class="data-grid">
      <div class="grid-item">
        <span class="grid-label">最高点</span>
        <span class="grid-value">{{ data.maxHeight?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">最低点</span>
        <span class="grid-value">{{ data.minHeight?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">基准面</span>
        <span class="grid-value">{{ data.baseHeight?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">三角面</span>
        <span class="grid-value">{{ data.triangleCount }}</span>
      </div>
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
