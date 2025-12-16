<template>
  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th>时间戳</th>
          <th>测站ID</th>
          <th>原始值</th>
          <th>清洗规则</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="i in 10" :key="i">
          <td class="font-mono">12:00:0{{ i - 1 }}</td>
          <td>ST_88{{ i }}2</td>
          <td class="font-mono text-alert">9999.0</td>
          <td>
            <span class="rule-tag">极值检测</span>
          </td>
          <td class="text-warn">已修复 (插值)</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// Mock data
</script>

<style scoped lang="scss">
.table-container {
  flex: 1;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 10px;
  @include custom-scrollbar;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    text-align: left;
    padding: 10px;
    color: $text-sub;
    border-bottom: 1px solid $border-subtle;
  }

  td {
    padding: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}

.text-alert {
  color: $alert-red;
}
.text-warn {
  color: $warn-yellow;
}

.rule-tag {
  background: rgba(239, 68, 68, 0.1);
  color: $alert-red;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
</style>
