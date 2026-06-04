/**
 * Color utility functions for Cesium imagery layer filters
 */

// Convert hex color to RGB array [0-255]
export function colorRgb(inColor: string): number[] {
  const reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/
  let color = inColor.toLowerCase()
  if (reg.test(color)) {
    // Convert 3-digit to 6-digit hex
    if (color.length === 4) {
      let colorNew = '#'
      for (let i = 1; i < 4; i += 1) {
        colorNew += color.slice(i, i + 1).concat(color.slice(i, i + 1))
      }
      color = colorNew
    }
    // Parse RGB values
    const colorChange: number[] = []
    for (let i = 1; i < 7; i += 2) {
      colorChange.push(parseInt('0x' + color.slice(i, i + 2)))
    }
    return colorChange
  }
  return []
}

// Convert hex color to RGB string
export function colorRgbString(inColor: string): string {
  const arr = colorRgb(inColor)
  return 'rgb(' + arr[0] + ',' + arr[1] + ',' + arr[2] + ')'
}

// Convert hex color to normalized RGB [0.0-1.0]
export function colorRgb1(inColor: string): number[] {
  const colorChange = colorRgb(inColor)
  return colorChange.map((v) => parseFloat((v / 255.0).toFixed(2)))
}

// Convert RGB string to hex
export function colorRGB2Hex(color: string): string {
  const rgb = color.split(',')
  if (rgb.length <= 1) {
    return color
  }
  const r = parseInt(rgb[0].split('(')[1])
  const g = parseInt(rgb[1])
  const b = parseInt(rgb[2].split(')')[0])
  const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  return hex
}
