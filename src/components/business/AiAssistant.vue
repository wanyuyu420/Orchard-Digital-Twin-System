<template>
  <GlassPanel class="ai-panel">
    <template #default>
      <div class="panel-header-internal">
        <span class="title-text"><i class="fa-solid fa-robot"></i> 智能参谋</span>
      </div>

      <div class="chat-history">
        <div class="message system">
          <div class="msg-content">DeepSeek: 已监测到丹江口流域未来2小时有强降雨。</div>
        </div>
      </div>

      <div class="input-area">
        <input type="text" placeholder="呼叫 AI..." class="ai-input" />
        <button class="mic-btn active">
          <i class="fa-solid fa-microphone"></i>
        </button>
      </div>
    </template>
  </GlassPanel>
</template>

<script setup lang="ts">
import GlassPanel from '@/components/common/GlassPanel.vue'
</script>

<style scoped lang="scss">
.ai-panel {
  flex: 1; /* Fill remaining height */
  display: flex;
  flex-direction: column;
}

.panel-header-internal {
  font-weight: 600;
  margin-bottom: 10px;
  @include text-glow($neon-cyan);
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  font-size: 12px;
  margin-bottom: 10px;
  @include custom-scrollbar;
}

.message {
  margin-bottom: 10px;
  &.system {
    background: rgba(34, 211, 238, 0.05);
    border-left: 2px solid $neon-cyan;
    padding: 8px;
    color: $text-main;
  }
}

.input-area {
  display: flex;
  gap: 8px;
}

.ai-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  color: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  font-family: $font-ui;
  font-size: 12px;

  &:focus {
    border-color: $neon-cyan;
  }
}

.mic-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);

  &.active {
    background: $neon-cyan;
    color: #000;
    @include box-glow($neon-cyan);
  }
}
</style>
