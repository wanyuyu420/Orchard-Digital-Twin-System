// GIS 绘制工具类型定义

import type * as Cesium from 'cesium'

/**
 * 绘制工具类型
 * 与 BaseTool 的 ToolType 保持一致
 *
 * 向后兼容：同时支持新格式（draw-*）和旧格式（无前缀）
 */
export type DrawToolType =
  | 'draw-point' // 点标注（新格式）
  | 'draw-line' // 线绘制（新格式）
  | 'draw-polygon' // 多边形（新格式）
  | 'draw-circle' // 圆形（新格式）
  | 'draw-rectangle' // 矩形（新格式）
  | 'point' // 点标注（旧格式 - 向后兼容）
  | 'line' // 线绘制（旧格式 - 向后兼容）
  | 'polygon' // 多边形（旧格式 - 向后兼容）
  | 'circle' // 圆形（旧格式 - 向后兼容）
  | 'rectangle' // 矩形（旧格式 - 向后兼容）
  | null // 无激活工具

/**
 * 3D 分析工具类型
 */
export type AnalysisToolType =
  | 'volume' // 方量分析
  | 'profile' // 剖面分析
  | 'measure3d' // 3D测量

/**
 * 所有 GIS 工具类型（绘制 + 分析，不包含 null）
 */
export type GISToolType = Exclude<DrawToolType, null> | AnalysisToolType

/**
 * 线型类型
 */
export type LineType = 'solid' | 'dashed' | 'dotted'

/**
 * 要素类型（包含测量工具类型）
 */
export type FeatureType =
  | 'point'
  | 'line'
  | 'polygon'
  | 'circle'
  | 'rectangle'
  | 'distance' // 距离测量（兼容现有）
  | 'area' // 面积测量（兼容现有）

/**
 * 绘制模式
 */
export type DrawMode =
  | 'none' // 未激活
  | 'drawing' // 绘制中
  | 'editing' // 编辑中
  | 'selecting' // 选择中

/**
 * 绘制状态
 * 用于 Store 管理
 */
export interface DrawingState {
  /** 当前激活的工具 */
  activeTool: DrawToolType

  /** 当前绘制模式 */
  mode: DrawMode

  /** 是否正在绘制 */
  isDrawing: boolean

  /** 是否正在编辑 */
  isEditing: boolean

  /** 当前要素ID */
  currentFeatureId: string | null

  /** 是否启用捕捉 */
  snapEnabled: boolean

  /** 捕捉容差（像素）*/
  snapTolerance: number

  /** 是否显示提示 */
  showTips: boolean

  /** 提示文本 */
  tipText: string

  /** 是否连续绘制模式 */
  continuousMode: boolean
}

/**
 * 要素样式
 */
export interface FeatureStyle {
  fillColor: string // rgba(255, 255, 255, 0.5) 或 #FFFFFF
  strokeColor: string // rgba(255, 204, 51, 1) 或 #FFCC33
  strokeWidth: number // 1-10
  pointSize: number // 5-20
  opacity: number // 0-1
  lineType?: LineType // 线型（可选）
  pointColor?: string // 点颜色（可选）
  fillOpacity?: number // 填充透明度（可选）
  iconType?: string // 图标类型（可选）
  centerIcon?: string // 多边形中心图标（可选）
}

/**
 * 默认样式
 */
export const DEFAULT_STYLE: FeatureStyle = {
  fillColor: 'rgba(255, 204, 51, 0.3)',
  strokeColor: '#ffcc33',
  strokeWidth: 3,
  pointSize: 10,
  opacity: 1,
  lineType: 'solid',
}

/**
 * 样式预设
 */
export interface StylePreset {
  id: string
  name: string
  style: FeatureStyle
  icon?: string
}

/**
 * 预设样式库（行业主题）
 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'default',
    name: '默认',
    style: DEFAULT_STYLE,
  },
  {
    id: 'warning',
    name: '警告区域',
    style: {
      fillColor: 'rgba(255, 152, 0, 0.3)',
      strokeColor: '#ff9800',
      strokeWidth: 3,
      pointSize: 10,
      opacity: 1,
    },
  },
  {
    id: 'danger',
    name: '危险区域',
    style: {
      fillColor: 'rgba(244, 67, 54, 0.3)',
      strokeColor: '#f44336',
      strokeWidth: 3,
      pointSize: 10,
      opacity: 1,
    },
  },
  {
    id: 'safe',
    name: '安全区域',
    style: {
      fillColor: 'rgba(76, 175, 80, 0.3)',
      strokeColor: '#4caf50',
      strokeWidth: 3,
      pointSize: 10,
      opacity: 1,
    },
  },
]

/**
 * 绘制配置选项
 */
export interface DrawOptions {
  /** 工具类型 */
  type: DrawToolType

  /** 样式配置 */
  style?: FeatureStyle

  /** 是否启用捕捉 */
  snapEnabled?: boolean

  /** 是否连续绘制 */
  continuous?: boolean

  /** 完成回调 */
  onComplete?: (feature: any) => void

  /** 取消回调 */
  onCancel?: () => void
}

/**
 * 顶点编辑操作类型
 */
export type VertexEditAction =
  | 'add' // 添加顶点
  | 'move' // 移动顶点
  | 'remove' // 删除顶点
  | 'insert' // 插入顶点（在边的中点）

/**
 * 顶点编辑事件
 */
export interface VertexEditEvent {
  /** 操作类型 */
  action: VertexEditAction

  /** 顶点索引 */
  index: number

  /** 新位置（用于 move/add/insert）*/
  position?: Cesium.Cartesian3

  /** 要素ID */
  featureId: string
}

/**
 * 捕捉目标类型
 */
export type SnapTargetType =
  | 'vertex' // 顶点
  | 'edge' // 边
  | 'midpoint' // 中点
  | 'center' // 中心点

/**
 * 捕捉结果
 */
export interface SnapResult {
  /** 是否成功捕捉 */
  snapped: boolean

  /** 捕捉到的位置 */
  position?: Cesium.Cartesian3

  /** 捕捉目标类型 */
  targetType?: SnapTargetType

  /** 捕捉到的要素ID */
  featureId?: string

  /** 捕捉到的顶点索引（如果是顶点）*/
  vertexIndex?: number
}
