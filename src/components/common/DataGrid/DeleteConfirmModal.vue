<template>
  <FormModal v-model="isOpen" title="确认删除" size="small">
    <div class="delete-confirm">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>确定要删除此记录吗？</p>
      <p class="warning">此操作不可撤销</p>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="cancel">取消</button>
      <button class="btn-delete" @click="confirm" :disabled="loading">
        <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i>
        <span>确认删除</span>
      </button>
    </template>
  </FormModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FormModal from './FormModal.vue'

const props = defineProps<{
  modelValue: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function cancel() {
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
}
</script>

<style scoped lang="scss">
@use 'sass:color';

.delete-confirm {
  text-align: center;
  padding: 20px 0;

  i {
    font-size: 48px;
    color: $alert-red;
    margin-bottom: 16px;
  }

  p {
    margin: 0 0 8px;
    font-size: 16px;
    color: $text-main;
  }

  .warning {
    font-size: 13px;
    color: $text-sub;
  }
}

.btn-cancel,
.btn-delete {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: $text-sub;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: $text-main;
  }
}

.btn-delete {
  background: $alert-red;
  border: 1px solid $alert-red;
  color: #fff;

  &:hover:not(:disabled) {
    background: color.adjust($alert-red, $lightness: -10%);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
