<template>
  <div class="layer-detail-panel glass-panel" v-if="!orchardStore.showQueryPanel && orchardStore.showLayerDetailPanel && orchardStore.selectedLayerDetail">
    <div class="panel-header">
      <i class="fa-solid fa-info-circle"></i>
      {{ orchardStore.selectedLayerDetail.name || '图层信息' }}
      <button class="close-btn" @click="orchardStore.hideLayerDetail()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="panel-body">
      <div class="detail-item">
        <div class="detail-icon" :style="{ background: '#fb923c20' }">
          <i class="fa-solid" :class="drawIcon(orchardStore.selectedLayerDetail.type)" style="color: #fb923c"></i>
        </div>
        <div class="detail-content">
          <div class="detail-label">图形类型</div>
          <div class="detail-value">{{ drawTypeLabel(orchardStore.selectedLayerDetail.type) }}</div>
        </div>
      </div>

      <div class="detail-row">
        <span class="detail-label">创建时间</span>
        <span class="detail-value">{{ formatDrawDate(orchardStore.selectedLayerDetail.createdAt) }}</span>
      </div>

      <div class="detail-row" v-if="orchardStore.selectedLayerDetail.poiCount">
        <span class="detail-label">范围内果树</span>
        <span class="detail-value highlight">{{ orchardStore.selectedLayerDetail.poiCount }} 棵</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">面积</span>
        <span class="detail-value highlight">{{ calcArea(orchardStore.selectedLayerDetail) }}</span>
      </div>

      <div class="detail-section" v-if="orchardStore.selectedLayerDetail.coordinates">
        <div class="detail-section-title">坐标数据</div>
        <div class="coords-scroll">
          <div
            v-for="(coord, i) in flatCoords"
            :key="i"
            class="coord-line"
          >
            <span class="coord-idx">#{{ i + 1 }}</span>
            <span class="coord-val">{{ coord[0].toFixed(6) }}, {{ coord[1].toFixed(6) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOrchardStore } from '@/stores/orchard'

const orchardStore = useOrchardStore()

const flatCoords = computed(() => {
  const geo = orchardStore.selectedLayerDetail
  if (!geo?.coordinates) return []
  const c = geo.coordinates
  // GeoJSON nested format: [[[lon, lat], ...]]
  if (geo.type === 'polygon' && Array.isArray(c[0]) && Array.isArray(c[0][0])) {
    return c[0].slice(0, -1)
  }
  // Flat format: [[lon, lat], ...] (used by DrawTool)
  return Array.isArray(c[0]) ? c : []
})

function drawIcon(type: string): string {
  switch (type) {
    case 'rectangle': return 'fa-regular fa-square'
    case 'circle': return 'fa-regular fa-circle'
    case 'polygon': return 'fa-solid fa-draw-polygon'
    default: return 'fa-regular fa-file'
  }
}

function drawTypeLabel(type: string): string {
  switch (type) {
    case 'rectangle': return '矩形'
    case 'circle': return '圆形'
    case 'polygon': return '多边形'
    default: return type
  }
}

function formatDrawDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getFlatCoords(geo: any): number[][] {
  if (!geo?.coordinates) return []
  const c = geo.coordinates
  if (geo.type === 'polygon' && Array.isArray(c[0]) && Array.isArray(c[0][0])) {
    return c[0]
  }
  if (Array.isArray(c[0]) && typeof c[0][0] === 'number') {
    return c
  }
  return []
}

function calcArea(geo: any): string {
  const coords = getFlatCoords(geo)
  if (coords.length < 2) return '--'

  let sumLat = 0
  for (const c of coords) sumLat += c[1]
  const avgLat = sumLat / coords.length
  const latMetersPerDeg = 111320
  const lonMetersPerDeg = 111320 * Math.cos((avgLat * Math.PI) / 180)

  if (geo.type === 'circle') {
    const center = coords[0]
    const edge = coords[coords.length - 1] || coords[1]
    if (!edge) return '--'
    const dLat = (edge[1] - center[1]) * latMetersPerDeg
    const dLon = (edge[0] - center[0]) * lonMetersPerDeg
    const r = Math.sqrt(dLat * dLat + dLon * dLon)
    const areaSqm = Math.PI * r * r
    return formatArea(areaSqm)
  }

  const n = coords.length
  let areaDeg = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    areaDeg += coords[i][0] * coords[j][1]
    areaDeg -= coords[j][0] * coords[i][1]
  }
  areaDeg = Math.abs(areaDeg) / 2

  const areaSqm = areaDeg * latMetersPerDeg * lonMetersPerDeg
  return formatArea(areaSqm)
}

function formatArea(sqm: number): string {
  if (sqm >= 1e6) return (sqm / 1e6).toFixed(2) + ' km²'
  if (sqm >= 666.67) return (sqm / 666.67).toFixed(1) + ' 亩'
  return sqm.toFixed(0) + ' m²'
}
</script>

<style scoped lang="scss">
.layer-detail-panel {
  position: absolute;
  right: 16px;
  bottom: 60px;
  width: 360px;
  min-height: 400px;
  pointer-events: auto;
  z-index: $z-layer-4;

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    font-size: 14px;
    font-weight: 600;
    color: #fb923c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .close-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  .panel-body {
    padding: 12px 18px;
  }
}

.detail-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .detail-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 15px;
  }

  .detail-content {
    .detail-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    .detail-value {
      font-size: 13px;
      font-weight: 500;
      color: #ffffff;
      margin-top: 2px;
    }
  }
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .detail-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
  }

  .detail-value {
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;

    &.highlight {
      color: #fb923c;
      font-weight: 700;
    }
  }
}

.detail-section {
  margin-top: 12px;
}

.detail-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 6px;
}

.coords-scroll {
  max-height: 200px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 6px;
}

.coord-line {
  display: flex;
  gap: 12px;
  padding: 4px 6px;
  font-size: 12px;
  font-family: 'Courier New', monospace;

  .coord-idx {
    color: rgba(255, 255, 255, 0.6);
    min-width: 28px;
  }

  .coord-val {
    color: #ffffff;
  }
}
</style>