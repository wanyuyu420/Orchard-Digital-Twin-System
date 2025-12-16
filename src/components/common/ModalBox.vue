<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-box glass-panel">
      <div class="modal-header">
        <div class="modal-title">
          <i v-if="icon" :class="icon" class="modal-icon"></i>
          <span>{{ title }}</span>
        </div>
        <div class="modal-actions">
          <slot name="actions"></slot>
          <button class="close-btn" @click="close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <div class="modal-content">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  title: string
  icon?: string
}>()

const router = useRouter()

function close() {
  router.push({ name: 'dashboard' })
}
</script>

<style scoped lang="scss">
.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 20; /* Above layout */
}

.modal-box {
  width: 85%;
  height: 85%;
  display: flex;
  flex-direction: column;
  @include glass-panel;
  animation: modalZoom 0.3s $ease-out;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid $border-subtle;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 12px;
  @include text-glow($neon-cyan);
}

.modal-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.close-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: $alert-red;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $alert-red;
    color: #fff;
  }
}

.modal-content {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@keyframes modalZoom {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
