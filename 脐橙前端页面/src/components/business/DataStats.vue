<template>
  <div class="stats-row">
    <div class="stat-card glass-sub">
      <div class="stat-label">拦截异常</div>
      <div class="stat-value font-mono text-alert">1,024</div>
    </div>
    <div class="stat-card glass-sub">
      <div class="stat-label">自动修复</div>
      <div class="stat-value font-mono text-warn">512</div>
    </div>
    <div class="stat-card glass-sub">
      <div class="stat-label">数据完整率</div>
      <div class="stat-value font-mono text-success">99.9%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No script needed for static mock
</script>

<style scoped lang="scss">
.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  padding: 20px;
  text-align: center;
  border-radius: 4px;
}

.glass-sub {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid $border-subtle;
}

.stat-label {
  color: $text-sub;
  font-size: 12px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.text-alert {
  color: $alert-red;
}
.text-warn {
  color: $warn-yellow;
}
.text-success {
  color: $success-green;
}
</style>
