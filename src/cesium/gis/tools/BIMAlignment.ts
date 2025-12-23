/**
 * BIMAlignment - BIM/OSGB 模型对齐工具
 *
 * 【注意】
 * 本工具主要用于数据的“后处理”校正，旨在解决原始数据存在的坐标不准、
 * 未正确贴地或高程基准不一致等问题（Data Defects Mitigation）。
 * 如果数据本身已在生产阶段精确地理参考，则不需要使用此工具的 autoGround 功能。
 *
 * 主要功能：
 * 1. 定位校正：将模型移动到指定经纬度。
 * 2. 旋转校正：处理 Y-up (BIM) vs Z-up (Cesium) 坐标系差异。
 * 3. 智能贴地：自动探测地形高度并对齐，修复悬浮或遮挡问题。
 *
 * @example
 * BIMAlignment.applyToTileset(tileset, { ... })
 * await BIMAlignment.autoGroundSmart(tileset, viewer, 12)
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
   * 智能多点贴地：采样5个点（中心+四角），取最高点对齐，防止遮挡
   * @param tileset Cesium3DTileset
   * @param viewer Viewer
   * @param baseOffset 基础偏移（米），默认 0
   */
  static async autoGroundSmart(tileset: any, viewer: any, baseOffset: number = 0): Promise<void> {
    if (!tileset || !viewer) return

    // 1. 初始化/获取原始状态
    if (!tileset._originalModelMatrix) {
      tileset._originalModelMatrix = tileset.modelMatrix.clone()
      const pos = this.extractPosition(tileset)
      if (pos) {
        tileset._originalPosition = pos
      } else {
        console.warn('[BIMAlignment] Failed to capture original position for Smart Grounding')
        return
      }
      console.log('[BIMAlignment] Smart Grounding: Captured original state:', tileset._originalPosition)
    }

    const { longitude, latitude, height: originalHeight } = tileset._originalPosition

    try {
      let maxTerrainHeight = 0

      // 2. 只有开启地形时才进行多点采样
      if (viewer.terrainProvider && !(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)) {
        
        // 计算采样点偏移 (根据包围球半径)
        const radius = tileset.boundingSphere?.radius || 100 // 默认100米
        // 1度 ≈ 111000米 -> deltaDegrees = radius / 111000
        const delta = radius / 111000 * 0.8 // 0.8 是收缩系数，避免采样到边缘外
        
        const points = [
          Cesium.Cartographic.fromDegrees(longitude, latitude),           // Center
          Cesium.Cartographic.fromDegrees(longitude + delta, latitude + delta), // NE
          Cesium.Cartographic.fromDegrees(longitude + delta, latitude - delta), // SE
          Cesium.Cartographic.fromDegrees(longitude - delta, latitude - delta), // SW
          Cesium.Cartographic.fromDegrees(longitude - delta, latitude + delta)  // NW
        ]

        // 批量采样
        const updatedPoints = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, points)
        
        // 找最大高度
        const heights = updatedPoints.map((p: any) => p.height || 0)
        maxTerrainHeight = Math.max(...heights)
        
        console.log(`[BIMAlignment] Smart Sampling (5 points):`, heights, `=> Max: ${maxTerrainHeight.toFixed(2)}m`)

      } else {
        // 无地形，高度为0
        maxTerrainHeight = 0
      }

      // 3. 计算绝对偏移
      // 目标是让模型底座(originalHeight代表的点) 抬升到 maxTerrainHeight + baseOffset
      // 但这里要注意：originalHeight通常是指模型中心的高度，还是底座高度？
      // OSGB/BIM 原点通常在中心或底部。如果原点在中心，我们需要知道半高。
      // 但保守起见，我们假设 originalHeight 是我们要对齐的“基准面”当前的高度。
      
      // 如果 originalHeight 是中心，而地形高是地面，直接对齐会导致半截入土。
      // 假设用户给的 baseOffset 包含了“半高”或者模型本身原点就在底部。
      // 之前的 autoGroundConservative 逻辑是 `terrainHeight - originalHeight + offset`
      // 这里保持一致逻辑：
      const totalOffset = maxTerrainHeight - originalHeight + baseOffset

      console.log(`[BIMAlignment] Smart Result: MaxTerrain=${maxTerrainHeight.toFixed(2)}m, Orig=${originalHeight.toFixed(2)}m, Offset=${totalOffset.toFixed(2)}m`)

      // 4. 应用
      this.applyAbsoluteOffset(tileset, totalOffset)

    } catch (e) {
      console.error('[BIMAlignment] Smart Grounding failed:', e)
    }
  }

  /**
   * 保守贴地（无状态模式）：基于原始状态计算偏移，防止累积误差
   * @param tileset Cesium3DTileset 实例
   * @param viewer Cesium Viewer 实例
   * @param heightOffset 额外的高度偏移（米），默认 0
   */
  static async autoGroundConservative(tileset: any, viewer: any, heightOffset: number = 0): Promise<void> {
    if (!tileset || !viewer) return

    // 1. 初始化原始状态（仅在第一次执行时记录）
    // 我们将当前的矩阵视为“原始矩阵”，后续所有变换都以此为基准
    if (!tileset._originalModelMatrix) {
      tileset._originalModelMatrix = tileset.modelMatrix.clone()
      
      // 提取并保存原始位置信息
      const pos = this.extractPosition(tileset)
      if (pos) {
        tileset._originalPosition = pos
      } else {
        console.warn('[BIMAlignment] Failed to capture original position, grounding may be inaccurate')
        return
      }
      console.log('[BIMAlignment] Captured original state:', tileset._originalPosition)
    }

    // 从原始状态获取经纬度和原始高度
    const { longitude, latitude, height: originalHeight } = tileset._originalPosition
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude)

    try {
      let terrainHeight = 0

      // 2. 根据地形状态获取目标地面高度
      if (viewer.terrainProvider && !(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)) {
        // 有地形：采样地形高度
        const updatedCartographics = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
          cartographic,
        ])
        terrainHeight = updatedCartographics[0].height || 0
      } else {
        // 无地形：地面高度为 0
        terrainHeight = 0
      }

      // 3. 计算绝对高度偏移量 (目标高度 - 原始高度 + 用户微调)
      // 注意：这里计算的是相对于“原始位置”的偏移，而不是相对于“当前位置”
      const totalOffset = terrainHeight - originalHeight + heightOffset

      console.log(`[BIMAlignment] Grounding: original=${originalHeight.toFixed(2)}m, target=${terrainHeight.toFixed(2)}m, offset=${totalOffset.toFixed(2)}m`)

      // 4. 应用偏移：重置为原始矩阵 -> 应用平移
      this.applyAbsoluteOffset(tileset, totalOffset)

    } catch (e) {
      console.error('[BIMAlignment] AutoGround failed:', e)
    }
  }

  /**
   * 基于原始矩阵应用垂直偏移
   * @param tileset 
   * @param offset 垂直偏移量
   */
  static applyAbsoluteOffset(tileset: any, offset: number): void {
    if (!tileset._originalModelMatrix) return

    try {
      // 1. 从原始矩阵开始
      const baseMatrix = tileset._originalModelMatrix.clone()

      // 2. 获取中心点世界坐标 (用于计算偏移矢量)
      let center = new Cesium.Cartesian3()
      Cesium.Matrix4.getTranslation(baseMatrix, center)

      // FIX: 如果是单位矩阵，中心为(0,0,0)，会导致 Cartographic 转换失败
      // 此时使用我们之前提取的 _originalPosition 作为参考点
      if (Cesium.Cartesian3.equals(center, Cesium.Cartesian3.ZERO)) {
        if (tileset._originalPosition) {
          const { longitude, latitude, height } = tileset._originalPosition
          center = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
        } else {
          console.warn('[BIMAlignment] Cannot apply absolute offset: invalid center')
          return
        }
      }

      // 计算中心点的 Cartographic
      const cart = Cesium.Cartographic.fromCartesian(center)
      
      // 严谨的空值检查
      if (!cart) {
        console.error('[BIMAlignment] Failed to convert center to Cartographic:', center)
        return
      }
      
      // 目标高度的世界坐标
      // 使用 clone + 修改的方式，避免构造函数参数问题
      const newCart = cart.clone()
      newCart.height += offset
      
      const newCenter = Cesium.Cartographic.toCartesian(newCart)

      // 计算世界坐标系的平移向量 (New - Old)
      const translation = Cesium.Cartesian3.subtract(newCenter, center, new Cesium.Cartesian3())

      // 3. 构造平移矩阵
      const translationMatrix = Cesium.Matrix4.fromTranslation(translation)

      // 4. 应用：New = Translation * Original
      const newMatrix = Cesium.Matrix4.multiply(translationMatrix, baseMatrix, new Cesium.Matrix4())
      
      tileset.modelMatrix = newMatrix
      console.log(`[BIMAlignment] Applied offset successfully. New height: ${newCart.height.toFixed(2)}m`)
      
    } catch (e) {
      console.error('[BIMAlignment] Error inside applyAbsoluteOffset:', e)
    }
  }

  /**
   * 从 Matrix4 提取经纬度高程
   */
  static extractPositionFromMatrix(matrix: any): { longitude: number; latitude: number; height: number } | null {
    if (!matrix || Cesium.Matrix4.equals(matrix, Cesium.Matrix4.IDENTITY)) return null
    
    const position = new Cesium.Cartesian3()
    Cesium.Matrix4.getTranslation(matrix, position)
    
    if (Cesium.Cartesian3.equals(position, Cesium.Cartesian3.ZERO)) return null
    
    const cartographic = Cesium.Cartographic.fromCartesian(position)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }
  }

  /**
   * 尝试从 Tileset 提取完整的对齐参数
   */
  static extractParamsFromTileset(tileset: any): AlignmentParams {
    const pos = this.extractPositionFromMatrix(tileset.modelMatrix) || this.extractPosition(tileset) || { longitude: 0, latitude: 0, height: 0 }
    
    // 旋转通常很难从矩阵完美还原（特别是包含 Y-up 校正时）
    // 这里如果提取不到，或者 tileset 是初始状态，则使用默认旋转
    return {
      longitude: pos.longitude,
      latitude: pos.latitude,
      height: pos.height,
      rotationX: -90, // 默认 BIM/OSGB 旋转
      rotationY: 0,
      rotationZ: 0,
      scale: 1
    }
  }

  /**
   * 从 tileset 的 boundingSphere 提取当前位置
   * @param tileset Cesium3DTileset 实例
   * @returns 经纬度高程
   */
  static extractPosition(tileset: any): { longitude: number; latitude: number; height: number } | null {
    let center = tileset.boundingSphere?.center

    // Fallback 1: 根瓦片包围球
    if ((!center || Cesium.Cartesian3.equals(center, Cesium.Cartesian3.ZERO)) && tileset.root?.boundingVolume?.boundingSphere?.center) {
      center = tileset.root.boundingVolume.boundingSphere.center
    }

    // Fallback 2: 根瓦片变换矩阵位置 (tileset.root.transform)
    if (!center || Cesium.Cartesian3.equals(center, Cesium.Cartesian3.ZERO)) {
      if (tileset.root?.transform) {
        center = new Cesium.Cartesian3()
        Cesium.Matrix4.getTranslation(tileset.root.transform, center)
      }
    }

    if (!center || Cesium.Cartesian3.equals(center, Cesium.Cartesian3.ZERO)) {
      console.warn('[BIMAlignment] Failed to extract valid bounding sphere center or transform position')
      return null
    }

    const cartographic = Cesium.Cartographic.fromCartesian(center)
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }
  }

  /**
   * 应用垂直偏移到 tileset（保留原始变换）
   * @param tileset Cesium3DTileset 实例
   * @param deltaHeight 垂直偏移量（米）
   */
  static applyVerticalOffset(tileset: any, deltaHeight: number): void {
    if (!tileset) return

    console.log(`[BIMAlignment] Applying offset: delta=${deltaHeight.toFixed(2)}m`)

    // 安全检查：如果偏移量异常大（超过 20000米），可能是计算错误，放弃应用
    if (Math.abs(deltaHeight) > 20000) {
      console.error(`[BIMAlignment] Safety check triggered: deltaHeight ${deltaHeight}m is too large! Grounding aborted.`)
      return
    }

    // 获取当前 modelMatrix
    const currentMatrix = tileset.modelMatrix || Cesium.Matrix4.IDENTITY.clone()

    // 提取当前位置
    const currentPosition = new Cesium.Cartesian3()
    Cesium.Matrix4.getTranslation(currentMatrix, currentPosition)

    // 如果是单位矩阵，从 boundingSphere 获取位置
    if (Cesium.Cartesian3.equals(currentPosition, Cesium.Cartesian3.ZERO)) {
      if (tileset._originalPosition) {
        const { longitude, latitude, height } = tileset._originalPosition
        const cart = Cesium.Cartographic.fromDegrees(longitude, latitude, height)
        Cesium.Cartographic.toCartesian(cart, undefined, currentPosition)
      } else if (tileset.boundingSphere?.center) {
        Cesium.Cartesian3.clone(tileset.boundingSphere.center, currentPosition)
      } else {
        console.warn('[BIMAlignment] Cannot apply offset: no position found')
        return
      }
    }

    // 转为地理坐标
    const cartographic = Cesium.Cartographic.fromCartesian(currentPosition)
    
    // 添加高度偏移
    cartographic.height += deltaHeight

    // 计算新位置
    const newPosition = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height
    )

    // 计算位移向量
    const translation = Cesium.Cartesian3.subtract(newPosition, currentPosition, new Cesium.Cartesian3())

    // 创建平移矩阵
    const translationMatrix = Cesium.Matrix4.fromTranslation(translation)

    // 应用到现有矩阵：newMatrix = translationMatrix * currentMatrix
    const newMatrix = Cesium.Matrix4.multiply(translationMatrix, currentMatrix, new Cesium.Matrix4())
    tileset.modelMatrix = newMatrix

    console.log(`[BIMAlignment] Success: Applied vertical offset: ${deltaHeight.toFixed(2)}m`)
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
