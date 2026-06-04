<template>
  <div class="rag-container">
    <h3 class="panel-title">知识库管理 (RAG)</h3>

    <!-- Upload Zone -->
    <div class="upload-zone">
      <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
      <span class="upload-text">点击或拖拽上传 PDF/Word 预案</span>
    </div>

    <!-- File List -->
    <div class="file-list">
      <div v-for="file in files" :key="file.id" class="file-item glass-sub">
        <div class="file-info">
          <i :class="getFileIcon(file.type)" class="file-type-icon"></i>
          <span class="file-name">{{ file.name }}</span>
        </div>
        <span class="status-tag">已索引</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const files = ref([
  { id: 1, name: '2025汉江流域防洪预案.pdf', type: 'pdf' },
  { id: 2, name: '丹江口水库调度规程.docx', type: 'word' },
  { id: 3, name: '大坝安全监测技术规范.pdf', type: 'pdf' },
])

function getFileIcon(type: string) {
  if (type === 'pdf') return 'fa-regular fa-file-pdf text-alert'
  if (type === 'word') return 'fa-regular fa-file-word text-blue'
  return 'fa-regular fa-file'
}
</script>

<style scoped lang="scss">
.rag-container {
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

.upload-zone {
  border: 2px dashed $neon-cyan;
  height: 120px;
  border-radius: 8px;
  background: rgba(34, 211, 238, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $neon-cyan;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 20px;

  &:hover {
    background: rgba(34, 211, 238, 0.1);
  }
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.upload-text {
  font-size: 12px;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  @include custom-scrollbar;
}

.file-item {
  padding: 12px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  font-size: 13px;
}

.status-tag {
  font-size: 11px;
  background: rgba(34, 211, 238, 0.1);
  color: $neon-cyan;
  padding: 2px 6px;
  border-radius: 4px;
}

.text-alert {
  color: $alert-red;
}
.text-blue {
  color: $neon-blue;
}
</style>
