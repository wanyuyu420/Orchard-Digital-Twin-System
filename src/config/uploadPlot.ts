/**
 * 地2（上传地块）云端资源占位配置。
 *
 * 仿照地1 的 OrchardTilesetLayer + orchardPreview 数据源，全部来自云服务器。
 * 这些 URL 在完成「slpk → 3D Tiles 转换 + 部署」后填入真实路径即可生效。
 */

/** 本机数据服务基础地址（Tailscale IP，与地1 一致） */
export const UPLOAD_PLOT_DATA_BASE = 'http://100.69.181.81:8766'

/** 地2 3D Tiles 资源（云服务器 C:\data\3Dtiles，完整场景：地表起伏 + 树模型） */
export const UPLOAD_PLOT_TILESETS = {
  trees: `${UPLOAD_PLOT_DATA_BASE}/3Dtiles/tileset.json`,
}

/** 地2 DOM 无人机影像瓦片（云服务器 C:\data\dom2，URL 前缀 /dom2/{z}/{x}/{y}.png） */
export const UPLOAD_PLOT_DOM = {
  base: `${UPLOAD_PLOT_DATA_BASE}/dom2`,
  minLevel: 17,
  maxLevel: 23,
}

/** 高德卫星影像（园外大范围背景，与地1 一致） */
export const GAODE_IMAGERY_URL =
  'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
