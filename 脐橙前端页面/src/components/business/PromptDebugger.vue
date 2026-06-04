<template>
  <div class="prompt-container">
    <h3 class="panel-title">提示词工程 (Prompt Engineering)</h3>

    <!-- System Prompt Editor -->
    <div class="editor-section">
      <label class="section-label">System Prompt</label>
      <textarea class="prompt-editor" v-model="systemPrompt"></textarea>
    </div>

    <!-- Playground -->
    <div class="playground-section glass-sub">
      <div class="section-label">调试预览 (Playground)</div>

      <div class="chat-log">
        <div class="chat-message"><span class="msg-role">User:</span> 现在的防汛响应等级？</div>
        <div class="chat-message ai-response">
          <div class="ai-header">
            <span class="msg-role text-neon">AI:</span>
            <span class="citation-tag">[检索命中: 预案 P.12]</span>
          </div>
          <div class="msg-content">根据最新预案，当前处于防汛 IV 级应急响应状态。</div>
        </div>
      </div>

      <div class="input-row">
        <input type="text" placeholder="输入测试问题..." class="chat-input" />
        <button class="send-btn">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const systemPrompt = ref(
  'You are an expert in water conservancy. Use the retrieved context to answer user questions accurately. If unsure, say "Data insufficient".'
)
</script>

<style scoped lang="scss">
@use 'sass:color';

.prompt-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 15px;
  @include text-glow($neon-cyan);
}

.editor-section {
  margin-bottom: 15px;
}

.section-label {
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 5px;
}

.prompt-editor {
  width: 100%;
  height: 100px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  color: $text-main;
  padding: 10px;
  border-radius: 4px;
  font-family: $font-code;
  font-size: 12px;
  line-height: 1.5;
  resize: none;

  &:focus {
    border-color: $neon-cyan;
  }
}

.playground-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 15px;
  overflow: hidden;
}

.chat-log {
  flex: 1;
  overflow-y: auto;
  font-size: 13px;
  margin-bottom: 10px;
  @include custom-scrollbar;
}

.chat-message {
  margin-bottom: 15px;
}

.msg-role {
  color: $text-sub;
  margin-right: 8px;
}

.ai-response {
  border-left: 2px solid $neon-cyan;
  padding-left: 10px;
}

.ai-header {
  margin-bottom: 4px;
}

.citation-tag {
  font-size: 11px;
  color: $warn-yellow;
  margin-left: 5px;
}

.text-neon {
  color: $neon-cyan;
}

.input-row {
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  color: #fff;
  padding: 8px;
  border-radius: 4px;
  font-family: $font-ui;
}

.send-btn {
  background: $neon-cyan;
  color: #000;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;

  &:hover {
    background: color.adjust($neon-cyan, $lightness: 10%);
  }
}
</style>
