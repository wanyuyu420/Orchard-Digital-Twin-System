/**
 * BIMAlignment - BIM 模型对齐工具
 *
 * 用于将 BIM 3D Tiles 模型定位到指定经纬度、高程，
 * 并应用旋转校正（BIM 通常使用 Y-up，Cesium 使用 Z-up）。
 *
 * @example
 * BIMAlignment.applyToTileset(tileset, {
 *   longitude: 78.42,
 *   latitude: 39.78,
 *   height: 1125,
 *   rotationX: -90,
 * })
 */

declare const Cesium: any

export interface AlignmentParams {
  /** 目标经度（度） */
  longitude: number
  /** 目标纬度（度） */
  latitude: number
  /** 目标高程（米） */
  height: number
  /** 绕 X 轴旋转角度（度），默认 -90（Y-up 转 Z-up） */
  rotationX?: number
  /** 绕 Y 轴旋转角度（度） */
  rotationY?: number
  /** 绕 Z 轴旋转角度（度） */
  rotationZ?: number
  /** 缩放比例，默认 1 */
  scale?: number
}

export class BIMAlignment {
  /**
   * 创建模型变换矩阵
   * @param params 对齐参数
   * @returns Cesium.Matrix4
   */
  static createModelMatrix(params: AlignmentParams): any {
    const {
      longitude,
      latitude,
      height,
      rotationX = -90, // 默认 Y-up 转 Z-up
      rotationY = 0,
      rotationZ = 0,
      scale = 1,
    } = params

    // 1. 创建位置矩阵（ENU 坐标系）
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    const positionMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position)

    // 2. 创建旋转矩阵
    const rotationMatrixX = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(rotationX))
    const rotationMatrixY = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(rotationY))
    const rotationMatrixZ = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(rotationZ))

    // 组合旋转：Z * Y * X
    let combinedRotation = Cesium.Matrix3.multiply(
      rotationMatrixZ,
      rotationMatrixY,
      new Cesium.Matrix3()
    )
    combinedRotation = Cesium.Matrix3.multiply(
      combinedRotation,
      rotationMatrixX,
      new Cesium.Matrix3()
    )

    // 3. 创建缩放矩阵
    const scaleMatrix = Cesium.Matrix4.fromScale(
      new Cesium.Cartesian3(scale, scale, scale),
      new Cesium.Matrix4()
    )

    // 4. 创建旋转的 4x4 矩阵
    const rotationMatrix4 = Cesium.Matrix4.fromRotationTranslation(combinedRotation)

    // 5. 组合变换：position * rotation * scale
    let result = Cesium.Matrix4.multiply(positionMatrix, rotationMatrix4, new Cesium.Matrix4())
    result = Cesium.Matrix4.multiply(result, scaleMatrix, new Cesium.Matrix4())

    return result
  }

  /**
   * 将对齐参数应用到 tileset
   * @param tileset Cesium3DTileset 实例
   * @param params 对齐参数
   */
  static applyToTileset(tileset: any, params: AlignmentParams): void {
    if (!tileset) {
      console.error('[BIMAlignment] Tileset is required')
      return
    }

    const modelMatrix = this.createModelMatrix(params)
    tileset.modelMatrix = modelMatrix

    console.log('[BIMAlignment] Applied alignment:', {
      position: `${params.longitude.toFixed(6)}°E, ${params.latitude.toFixed(6)}°N`,
      height: `${params.height}m`,
      rotation: `X:${params.rotationX ?? -90}° Y:${params.rotationY ?? 0}° Z:${params.rotationZ ?? 0}°`,
      scale: params.scale ?? 1,
    })
  }

  /**
   * 从 tileset 的 boundingSphere 提取当前位置
   * @param tileset Cesium3DTileset 实例
   * @returns 经纬度高程
   */
  static extractPosition(tileset: any): { longitude: number; latitude: number; height: number } | null {
    if (!tileset?.boundingSphere?.center) {
      return null
    }

    const cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }
  }

  /**
   * 创建默认对齐参数（用于 UI 初始化）
   */
  static getDefaultParams(): AlignmentParams {
    return {
      longitude: 78.42108125522402,
      latitude: 39.7811204696115,
      height: 1125,
      rotationX: -90,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    }
  }
}

export default BIMAlignment
