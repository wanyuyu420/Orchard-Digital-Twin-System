/**
 * ECharts dark theme configuration matching the HUD cyberpunk style.
 * Colors aligned with project's neon-cyan and neon-blue palette.
 */
import type { EChartsOption } from 'echarts'

// Color palette
export const NEON_CYAN = '#00ffea'
export const NEON_BLUE = '#0088ff'
export const NEON_PURPLE = '#8b5cf6'
export const NEON_GREEN = '#22c55e'
export const NEON_YELLOW = '#facc15'
export const NEON_ORANGE = '#fb923c'
export const NEON_RED = '#ef4444'
export const DARK_BG = '#0a1628'
export const DARK_CARD = '#111827'
export const TEXT_PRIMARY = '#e5e7eb'
export const TEXT_SECONDARY = '#9ca3af'
export const GRID_LINE = 'rgba(255, 255, 255, 0.08)'

// Chart color series
export const CHART_COLORS = [
  NEON_CYAN,
  NEON_BLUE,
  NEON_PURPLE,
  NEON_GREEN,
  NEON_YELLOW,
  NEON_ORANGE,
]

// Base theme options
export const darkTheme: Partial<EChartsOption> = {
  backgroundColor: 'transparent',
  textStyle: {
    color: TEXT_PRIMARY,
  },
  title: {
    textStyle: {
      color: TEXT_PRIMARY,
      fontSize: 14,
      fontWeight: 500,
    },
  },
  legend: {
    textStyle: {
      color: TEXT_SECONDARY,
    },
  },
  tooltip: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderColor: NEON_CYAN,
    borderWidth: 1,
    textStyle: {
      color: TEXT_PRIMARY,
    },
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: GRID_LINE,
      },
    },
    axisLabel: {
      color: TEXT_SECONDARY,
    },
    splitLine: {
      lineStyle: {
        color: GRID_LINE,
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: GRID_LINE,
      },
    },
    axisLabel: {
      color: TEXT_SECONDARY,
    },
    splitLine: {
      lineStyle: {
        color: GRID_LINE,
      },
    },
  },
  grid: {
    borderColor: GRID_LINE,
  },
}

// Helper to merge theme with chart options
export function applyTheme(options: EChartsOption): EChartsOption {
  return {
    ...darkTheme,
    ...options,
  }
}

// Gradient for area charts
export function createGradient(color1: string, color2: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: color1 },
      { offset: 1, color: color2 },
    ],
  }
}

// Color utility for severity levels
export function getSeverityColor(value: number, thresholds: { low: number; high: number }): string {
  if (value < thresholds.low) return NEON_GREEN
  if (value < thresholds.high) return NEON_YELLOW
  return NEON_RED
}
