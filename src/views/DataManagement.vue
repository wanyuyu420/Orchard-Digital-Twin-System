<template>
  <div class="data-management">
    <!-- 数据管理页面 - 模糊地图背景, 聚焦于数据面板 -->
    <div class="data-panels">
      <!-- 上传区域 -->
      <div class="upload-section glass-panel">
        <div class="section-header">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          数据上传
        </div>
        <div class="upload-dropzone">
          <el-upload
            drag
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            :show-file-list="false"
            accept="*"
          >
            <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
            <div class="upload-text">拖拽文件到此处或点击上传</div>
            <div class="upload-limit">仅支持 .tif / .tiff 无人机正射影像, 最大1GB</div>
          </el-upload>
        </div>
      </div>

      <!-- 文件管理列表 -->
      <div class="files-section glass-panel">
        <div class="section-header">
          <i class="fa-solid fa-folder-tree"></i>
          文件管理
          <span class="file-count">{{ orchardStore.uploadedFiles.length }}</span>
        </div>
        <el-table
          :data="orchardStore.uploadedFiles"
          style="width: 100%"
          size="small"
          row-class-name="file-row"
          @row-click="onFileClick"
        >
          <el-table-column label="文件名" prop="name" min-width="180">
            <template #default="{ row }">
              <div class="file-name-cell">
                <i class="fa-solid" :class="fileIcon(row)"></i>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="90">
            <template #default="{ row }">
              {{ formatSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上传时间" width="140">
            <template #default="{ row }">
              {{ formatDate(row.uploadedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click.stop="viewAnalysis(row)"
                :disabled="row.status !== 'completed'"
              >
                查看分析
              </el-button>
              <el-button
                link
                type="danger"
                size="small"
                @click.stop="deleteFile(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOrchardStore } from '@/stores/orchard'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadedFile } from '@/types/orchard'

const orchardStore = useOrchardStore()
const MAX_FILE_SIZE = 1024 * 1024 * 1024

function fileIcon(file: UploadedFile): string {
  if (file.type.includes('image') || file.type.includes('tif')) return 'fa-image'
  if (file.type.includes('zip') || file.type.includes('rar')) return 'fa-file-zipper'
  if (file.type.includes('json') || file.type.includes('geojson')) return 'fa-file-code'
  if (file.type.includes('csv') || file.type.includes('excel')) return 'fa-file-csv'
  if (file.type.includes('las') || file.type.includes('laz')) return 'fa-cube'
  return 'fa-file'
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB'
  return bytes + ' B'
}

function statusType(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'uploading': return 'info'
    case 'pending': return 'info'
    case 'processing': return 'warning'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'uploading': return '上传中'
    case 'pending': return '等待中'
    case 'processing': return '分析中'
    case 'completed': return '完成'
    case 'failed': return '失败'
    default: return status
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function beforeUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件 ${file.name} 超过1GB限制`)
    return false
  }
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.tif') && !lower.endsWith('.tiff')) {
    ElMessage.error('仅支持 .tif/.tiff 无人机正射影像文件')
    return false
  }
  return true
}

async function handleUpload(options: { file: File }) {
  try {
    await orchardStore.uploadSingleFile(options.file)
    ElMessage.success('上传成功')
  } catch {
    ElMessage.error('上传失败')
  }
}

function onFileClick(row: UploadedFile) {
  orchardStore.activeFileId = row.id
}

function viewAnalysis(row: UploadedFile) {
  orchardStore.activeFileId = row.id
  orchardStore.showAnalysisWindow = true
}

function deleteFile(row: UploadedFile) {
  ElMessageBox.confirm(`删除 "${row.name}"?`, '确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    orchardStore.deleteFile(row.id)
  })
}

// 后端无上传列表接口，上传列表为会话内本地数据，无需挂载时拉取
</script>

<style scoped lang="scss">
.data-management {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 24px;
}

.data-panels {
  width: 900px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

.upload-section,
.files-section {
  padding: 18px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 14px;

    .file-count {
      margin-left: auto;
      background: rgba(251, 146, 60, 0.2);
      color: #fb923c;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 12px;
    }
  }
}

.upload-dropzone {
  :deep(.el-upload) {
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    background: rgba(0, 0, 0, 0.4);
    border: 2px dashed rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    padding: 30px;

    &:hover {
      border-color: #fb923c;
      background: rgba(251, 146, 60, 0.1);
    }
  }
}

.upload-icon {
  font-size: 40px;
  color: #fb923c;
  margin-bottom: 10px;
}

.upload-text {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.upload-limit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 6px;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;

  i {
    color: $text-dim;
  }
}

:deep(.file-row) {
  cursor: pointer;
}

:deep(.el-table) {
  background: transparent;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(15, 23, 42, 0.5);
  --el-table-border-color: rgba(255, 255, 255, 0.06);
  --el-table-text-color: #f8fafc;
  --el-table-header-text-color: #94a3b8;
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.03);
}
</style>
