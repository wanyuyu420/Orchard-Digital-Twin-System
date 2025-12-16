<template>
  <div class="analysis-results-list">
    <!-- 工具栏 -->
    <div class="results-toolbar">
      <span class="count">{{ gisStore.analysisResults.length }} 条结果</span>
      <button
        v-if="gisStore.analysisResults.length > 0"
        @click="handleClearAll"
        class="clear-btn"
        title="清空所有结果"
      >
        <i class="fa-solid fa-trash"></i>
        清空
      </button>
    </div>

    <!-- 结果列表 -->
    <div class="results-container">
      <div
        v-for="result in gisStore.analysisResults"
        :key="result.id"
        :class="['result-item', { active: result.id === gisStore.selectedResultId }]"
        @click="handleSelect(result.id)"
      >
        <!-- 结果头部 -->
        <div class="result-header">
          <i :class="getToolIcon(result.type)" :style="{ color: getToolColor(result.type) }"></i>
          <span class="result-name">{{ result.name }}</span>
          <span class="result-time">{{ formatTime(result.timestamp) }}</span>
        </div>

        <!-- 结果详情（展开时显示） -->
        <div v-if="result.id === gisStore.selectedResultId" class="result-details">
          <VolumeResultContent v-if="result.type === 'volume'" :data="result.data" />
          <Measure3DResultContent v-else-if="result.type === 'measure3d'" :data="result.data" />
          <ProfileResultContent v-else-if="result.type === 'profile'" :data="result.data" />
          <FloodResultContent v-else-if="result.type === 'flood'" :data="result.data" />
        </div>

        <!-- 操作按钮 -->
        <div class="result-actions">
          <button @click.stop="handleLocate(result)" title="定位" class="locate-btn">
            <i class="fa-solid fa-location-crosshairs"></i>
          </button>
          <button @click.stop="handleRemove(result.id)" class="delete-btn" title="删除">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="gisStore.analysisResults.length === 0" class="empty-state">
        <i class="fa-solid fa-chart-line"></i>
        <p>暂无分析结果</p>
        <small>使用3D工具后结果将在此显示</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGISStore } from '@/stores/gis'
import type { AnalysisResult } from '@/stores/gis'
import VolumeResultContent from '../results/VolumeResultContent.vue'
import Measure3DResultContent from '../results/Measure3DResultContent.vue'
import ProfileResultContent from '../results/ProfileResultContent.vue'
import FloodResultContent from '../results/FloodResultContent.vue'
import * as Cesium from 'cesium'

const gisStore = useGISStore()

// 工具图标映射
function getToolIcon(type: string): string {
  const icons = {
    volume: 'fa-solid fa-cube',
    measure3d: 'fa-solid fa-ruler',
    profile: 'fa-solid fa-chart-area',
    flood: 'fa-solid fa-water',
  }
  return icons[type as keyof typeof icons] || 'fa-solid fa-chart-line'
}

// 工具颜色映射
function getToolColor(type: string): string {
  const colors = {
    volume: '#EF4444', // 红色
    measure3d: '#F59E0B', // 橙色
    profile: '#10B981', // 绿色
    flood: '#3B82F6', // 蓝色
  }
  return colors[type as keyof typeof colors] || '#22D3EE'
}

// 时间格式化
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 少于1分钟
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  // 少于1小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}分钟前`
  }
  // 少于24小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}小时前`
  }
  // 显示日期
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 选中/取消选中
function handleSelect(id: string): void {
  if (gisStore.selectedResultId === id) {
    gisStore.selectAnalysisResult(null) // 取消选中
  } else {
    gisStore.selectAnalysisResult(id) // 选中
  }
}

// 定位到结果
function handleLocate(result: AnalysisResult): void {
  const viewer = gisStore.viewer
  if (!viewer || !result.position) return

  viewer.camera.flyTo({
    destination: result.position,
    duration: 1.5,
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0,
    },
  })
}

// 删除结果
function handleRemove(id: string): void {
  gisStore.removeAnalysisResult(id)
}

// 清空所有结果
function handleClearAll(): void {
  if (confirm('确定要清空所有分析结果吗？')) {
    gisStore.clearAllAnalysisResults()
  }
}
</script>

<style scoped lang="scss">
.analysis-results-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;

  .results-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;

    .count {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      font-weight: 500;
    }

    .clear-btn {
      padding: 4px 8px;
      font-size: 12px;
      color: #ef4444;
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;

      &:hover {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.5);
      }

      i {
        font-size: 11px;
      }
    }
  }

  .results-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }
  }

  .result-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #22d3ee;
      box-shadow: 0 2px 8px rgba(34, 211, 238, 0.2);
    }

    &.active {
      border-color: #22d3ee;
      background: rgba(34, 211, 238, 0.05);
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        font-size: 16px;
        width: 20px;
        text-align: center;
      }

      .result-name {
        flex: 1;
        font-weight: 500;
        font-size: 14px;
      }

      .result-time {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .result-details {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .result-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;

      button {
        padding: 4px 8px;
        font-size: 12px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.9);
        transition: all 0.2s;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        &.locate-btn {
          color: #22d3ee;
          border-color: rgba(34, 211, 238, 0.3);

          &:hover {
            background: rgba(34, 211, 238, 0.1);
            border-color: rgba(34, 211, 238, 0.5);
          }
        }

        &.delete-btn {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);

          &:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.5);
          }
        }
      }
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    gap: 12px;

    i {
      font-size: 48px;
      opacity: 0.3;
    }

    p {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
    }

    small {
      font-size: 12px;
      opacity: 0.7;
    }
  }
}
</style>
