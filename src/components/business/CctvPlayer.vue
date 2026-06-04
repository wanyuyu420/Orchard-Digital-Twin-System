<template>
  <GlassPanel title="现场监控" icon="fa-solid fa-video" :actions="['expand']">
    <div class="cctv-grid">
      <div class="cctv-item">
        <div class="video-placeholder">
          <i class="fa-solid fa-play play-icon"></i>
        </div>
        <div class="cctv-info"><span class="status-dot">●</span> 溢洪道</div>
      </div>
      <div class="cctv-item">
        <div class="video-placeholder">
          <i class="fa-solid fa-play play-icon"></i>
        </div>
        <div class="cctv-info"><span class="status-dot">●</span> 坝顶</div>
      </div>
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import GlassPanel from '@/components/common/GlassPanel.vue'
</script>

<style scoped lang="scss">
.cctv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cctv-item {
  position: relative;
  border: 1px solid #333;
  background: #000;
}

.video-placeholder {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #333 0%, #000 100%);
  cursor: pointer;

  .play-icon {
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.2s;
  }

  &:hover .play-icon {
    color: $neon-cyan;
    transform: scale(1.2);
    text-shadow: 0 0 10px $neon-cyan;
  }
}

.cctv-info {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 4px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #fff;
}

.status-dot {
  color: $success-green;
  font-size: 8px;
}
</style>
