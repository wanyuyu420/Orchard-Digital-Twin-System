<template>
  <div class="terminal-container">
    <div class="terminal-header"><i class="fa-solid fa-terminal"></i> 协议日志终端</div>
    <div class="log-scroll" ref="scrollRef">
      <div v-for="log in logs" :key="log.id" class="log-line">
        <span class="log-time">[{{ log.timestamp }}]</span>
        <span class="log-content" :class="getTypeClass(log.type)">
          > [{{ log.type }}] {{ log.content }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useDeviceStore } from '@/stores/device'
import type { LogEntry } from '@/stores/device'

const store = useDeviceStore()
const { logs } = storeToRefs(store)
const scrollRef = ref<HTMLElement | null>(null)

// Auto-scroll to bottom
watch(
  logs,
  () => {
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight
      }
    })
  },
  { deep: true }
)

function getTypeClass(type: LogEntry['type']) {
  switch (type) {
    case 'RX':
      return 'text-neon'
    case 'TX':
      return 'text-blue'
    case 'DATA':
      return 'text-success'
    case 'ERR':
      return 'text-alert'
    case 'SYS':
      return 'text-sub'
    default:
      return ''
  }
}
</script>

<style scoped lang="scss">
.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #000;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid #333;
  font-size: 12px;
  font-weight: bold;
  @include text-glow($neon-cyan);
}

.log-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  font-family: $font-code;
  font-size: 12px;
  @include custom-scrollbar;
}

.log-line {
  margin-bottom: 4px;
  display: flex;
  gap: 10px;
}

.log-time {
  color: #555;
  white-space: nowrap;
}

.text-neon {
  color: $neon-cyan;
}
.text-blue {
  color: $neon-blue;
}
.text-success {
  color: $success-green;
}
.text-alert {
  color: $alert-red;
}
.text-sub {
  color: $text-sub;
}
</style>
