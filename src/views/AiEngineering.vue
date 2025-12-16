<template>
  <ModalBox title="AI 知识库与工程中心" icon="fa-solid fa-brain">
    <div class="ai-layout">
      <!-- Left: RAG -->
      <div class="layout-col left-col">
        <RagKnowledgeBase />
      </div>

      <!-- Separator -->
      <div class="layout-sep"></div>

      <!-- Right: Prompt -->
      <div class="layout-col right-col">
        <PromptDebugger />
      </div>
    </div>
  </ModalBox>
</template>

<script setup lang="ts">
import ModalBox from '@/components/common/ModalBox.vue'
import RagKnowledgeBase from '@/components/business/RagKnowledgeBase.vue'
import PromptDebugger from '@/components/business/PromptDebugger.vue'
</script>

<style scoped lang="scss">
.ai-layout {
  display: flex;
  height: 100%;
  gap: 24px;
}

.layout-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevent flex overflow */
}

.layout-sep {
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
}
</style>
