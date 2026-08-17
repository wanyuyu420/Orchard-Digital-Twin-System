<template>
  <div class="measure3d-result">
    <div class="data-item highlight">
      <span class="data-label">
        <i class="fa-solid fa-ruler"></i>
        斜距
      </span>
      <span class="data-value">{{ formatDistance(data.slopeDistance) }}</span>
    </div>

    <div class="data-item">
      <span class="data-label">
        <i class="fa-solid fa-arrows-left-right"></i>
        水平距离
      </span>
      <span class="data-value">{{ formatDistance(data.horizontalDistance) }}</span>
    </div>

    <div class="data-item">
      <span class="data-label">
        <i class="fa-solid fa-arrows-up-down"></i>
        垂直距离
      </span>
      <span class="data-value">
        {{ formatDistance(data.verticalDistance) }}
        <span :style="{ color: data.elevationDifference >= 0 ? '#10B981' : '#EF4444' }">
          {{ data.elevationDifference >= 0 ? '↑' : '↓' }}
        </span>
      </span>
    </div>

    <div class="data-grid">
      <div class="grid-item">
        <span class="grid-label">起点高程</span>
        <span class="grid-value">{{ data.startPoint?.elevation?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">终点高程</span>
        <span class="grid-value">{{ data.endPoint?.elevation?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">坡度角</span>
        <span class="grid-value">{{ data.slopeAngle?.toFixed(1) }}°</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">坡度</span>
        <span class="grid-value">{{ data.slopePercent?.toFixed(1) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: any
}

defineProps<Props>()

const formatDistance = (meters: number): string => {
  if (!meters) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(meters < 10 ? 2 : 1)} m`
}
</script>
