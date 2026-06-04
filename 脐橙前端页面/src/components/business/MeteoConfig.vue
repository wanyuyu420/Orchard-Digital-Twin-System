<template>
  <GlassPanel title="反演参数" icon="fa-solid fa-calculator">
    <div class="formula-box">Z = a * R ^ b</div>

    <div class="form-group">
      <label class="form-label">参数 a (系数)</label>
      <div class="range-wrapper">
        <input type="range" min="10" max="500" step="10" v-model.number="a" class="form-range" />
        <span class="value-display font-mono text-neon">{{ a }}</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">参数 b (指数)</label>
      <div class="range-wrapper">
        <input type="range" min="1.0" max="3.0" step="0.1" v-model.number="b" class="form-range" />
        <span class="value-display font-mono text-neon">{{ b }}</span>
      </div>
    </div>

    <button class="btn-primary mt-4"><i class="fa-solid fa-rotate"></i> 更新全屏场</button>
  </GlassPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GlassPanel from '@/components/common/GlassPanel.vue'

const a = ref(200)
const b = ref(1.6)
</script>

<style scoped lang="scss">
.formula-box {
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 4px;
  font-family: $font-code;
  text-align: center;
  color: $neon-cyan;
  border: 1px dashed $border-subtle;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-label {
  font-size: 12px;
  color: $text-sub;
  margin-bottom: 5px;
  display: block;
}

.range-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-range {
  flex: 1;
  accent-color: $neon-cyan;
  height: 4px;
  cursor: pointer;
}

.value-display {
  width: 40px;
  text-align: right;
  font-size: 14px;
}

.text-neon {
  @include text-glow($neon-cyan);
}

.btn-primary {
  width: 100%;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.1), rgba(34, 211, 238, 0.2));
  border: 1px solid $neon-cyan;
  color: $neon-cyan;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-weight: 600;

  &:hover {
    background: $neon-cyan;
    color: #000;
    @include box-glow($neon-cyan);
  }
}

.mt-4 {
  margin-top: 20px;
}
</style>
