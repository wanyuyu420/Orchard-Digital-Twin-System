<template>
  <transition name="slide-right">
    <div v-if="orchardStore.showQueryPanel" class="query-panel glass-panel">
      <div class="panel-header">
        <div class="header-left">
          <button class="back-btn" @click="orchardStore.goBackQueryLevel">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="panel-title">查询条件 - {{ orchardStore.activeMenuLabel }}</span>
        </div>
        <button class="close-btn" @click="orchardStore.closeSearchPanels">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="panel-body">
        <!-- 查询类型选择 -->
        <div class="form-group">
          <label>查询类型</label>
          <el-select v-model="queryType" placeholder="选择查询类型" style="width: 100%">
            <el-option label="果树POI查询" value="poi" />
            <el-option label="健康状态查询" value="health" />
          </el-select>
        </div>

        <!-- POI 精确查询：输入树编号只查这一棵，留空则查全部 -->
        <div class="form-group" v-if="queryType === 'poi'">
          <label>果树POI / 树编号</label>
          <el-input
            v-model="poiId"
            placeholder="输入树编号查单棵，留空查询全部"
            clearable
          />
        </div>

        <!-- 健康状态筛选 -->
        <div class="form-group" v-if="queryType === 'health'">
          <label>健康状态</label>
          <el-checkbox-group v-model="healthFilter">
            <el-checkbox label="healthy">健康</el-checkbox>
            <el-checkbox label="warning">预警</el-checkbox>
            <el-checkbox label="critical">严重</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <!-- 底部操作 - 2点击查询 -->
      <div class="panel-footer">
        <el-button @click="orchardStore.closeSearchPanels">取消</el-button>
        <el-button type="primary" @click="executeQuery" :loading="querying">
          <i class="fa-solid fa-magnifying-glass"></i>
          查询
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useOrchardStore } from '@/stores/orchard'
import { ElMessage } from 'element-plus'
import type { TsomQueryParams } from '@/types/orchard'

const orchardStore = useOrchardStore()
const querying = ref(false)

const queryType = ref('poi')
const poiId = ref('')
const healthFilter = ref<string[]>(['healthy', 'warning', 'critical'])

async function executeQuery() {
  querying.value = true
  try {
    const params: TsomQueryParams = {
      healthStatuses: healthFilter.value.length > 0 ? healthFilter.value : undefined,
    }
    if (poiId.value.trim()) {
      params.treeId = poiId.value.trim()
    }

    // 菜单精细查询查底图范围内的树（bbox 限制到底图 DOM 范围，见 api/orchard.ts）
    await orchardStore.executeFilterQuery(params)
    // 查询成功后关闭查询面板，避免与结果面板重叠
    orchardStore.showQueryPanel = false
  } catch {
    ElMessage.error('查询失败，请重试')
  } finally {
    querying.value = false
  }
}
</script>

<style scoped lang="scss">
.query-panel {
  position: relative;
  width: 420px;
  max-height: calc(100vh - 120px);
  z-index: $z-layer-6;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .back-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover {
      color: $text-main;
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .close-btn {
    background: none;
    border: none;
    color: $text-sub;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;

    &:hover {
      color: $alert-red;
    }
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.form-group {
  margin-bottom: 18px;

  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: $text-dim;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.panel-footer {
  padding: 14px 18px;
  border-top: 1px solid $border-subtle;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s $ease-out;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
