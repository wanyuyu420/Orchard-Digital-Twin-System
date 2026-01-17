<template>
  <div class="profile-result">
    <div class="data-item highlight">
      <span class="data-label">
        <i class="fa-solid fa-route"></i>
        路径长度
      </span>
      <span class="data-value">{{ formatDistance(data.totalLength) }}</span>
    </div>

    <div class="data-grid">
      <div class="grid-item">
        <span class="grid-label">最高点</span>
        <span class="grid-value">{{ data.maxElevation?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">最低点</span>
        <span class="grid-value">{{ data.minElevation?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">累计爬升</span>
        <span class="grid-value">{{ data.totalAscent?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">累计下降</span>
        <span class="grid-value">{{ data.totalDescent?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">平均高程</span>
        <span class="grid-value">{{ data.avgElevation?.toFixed(1) }} m</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">采样点数</span>
        <span class="grid-value">{{ data.samples?.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: any
}

const props = defineProps<Props>()

const formatDistance = (meters: number): string => {
  if (!meters) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(1)} m`
}
</script>
