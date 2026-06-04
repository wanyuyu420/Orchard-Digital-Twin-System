/**
 * TilesetFlatten - 3D Tiles 模型压平工具
 *
 * 使用 Cesium CustomShader 在 GPU 端实现压平效果。
 * 支持多个压平区域，每个区域可独立设置高度。
 *
 * @example
 * const flatten = new TilesetFlatten(tileset, { flatHeight: -10 })
 * flatten.addRegion({ positions: [...], height: -5 })
 * flatten.removeRegionById('region-id')
 * flatten.destroy()
 */

declare const Cesium: any

export interface FlattenRegion {
  id: string
  positions: any[] // Cesium.Cartesian3[]
  height: number
}

export interface FlattenOptions {
  flatHeight?: number
}

interface LocalRegion {
  coordinates: [number, number][]
  height: number
}

export class TilesetFlatten {
  private tileset: any
  private flatHeight: number
  private center: any
  private matrix: any
  private localMatrix: any
  private regionList: FlattenRegion[] = []
  private localPositionsArr: LocalRegion[] = []

  constructor(tileset: any, options: FlattenOptions = {}) {
    if (!tileset) {
      throw new Error('[TilesetFlatten] Tileset is required')
    }

    this.tileset = tileset
    this.flatHeight = options.flatHeight ?? 0

    // 获取 tileset 中心点，建立局部坐标系
    this.center = tileset.boundingSphere.center.clone()
    this.matrix = Cesium.Transforms.eastNorthUpToFixedFrame(this.center.clone())
    this.localMatrix = Cesium.Matrix4.inverse(this.matrix, new Cesium.Matrix4())
  }

  /**
   * 添加压平区域
   * @param region 压平区域配置（不含 id，自动生成）
   * @returns 生成的区域 ID
   */
  addRegion(region: Omit<FlattenRegion, 'id'> & { id?: string }): string {
    const { positions, height } = region
    const id = region.id ?? this.generateId()
    const targetHeight = height ?? this.flatHeight

    const newRegion: FlattenRegion = {
      id,
      positions,
      height: targetHeight,
    }

    this.regionList.push(newRegion)
    this.rebuildShader()

    console.log(`[TilesetFlatten] Added region: ${id}, height: ${targetHeight}`)
    return id
  }

  /**
   * 根据 ID 删除压平区域
   */
  removeRegionById(id: string): boolean {
    const initialLength = this.regionList.length
    this.regionList = this.regionList.filter((r) => r.id !== id)

    if (this.regionList.length < initialLength) {
      this.rebuildShader()
      console.log(`[TilesetFlatten] Removed region: ${id}`)
      return true
    }
    return false
  }

  /**
   * 清除所有压平区域
   */
  clearAll(): void {
    this.regionList = []
    this.localPositionsArr = []
    this.tileset.customShader = undefined
    console.log('[TilesetFlatten] Cleared all regions')
  }

  /**
   * 设置全局默认压平高度
   */
  setFlatHeight(height: number): void {
    this.flatHeight = height
    // 更新所有区域高度
    this.regionList.forEach((region) => {
      region.height = height
    })
    this.rebuildShader()
  }

  /**
   * 获取所有压平区域
   */
  getRegions(): FlattenRegion[] {
    return [...this.regionList]
  }

  /**
   * 销毁压平实例
   */
  destroy(): void {
    this.clearAll()
    console.log('[TilesetFlatten] Destroyed')
  }

  /**
   * 重建着色器
   */
  private rebuildShader(): void {
    // 重新计算所有区域的局部坐标
    this.localPositionsArr = this.regionList.map((region) => ({
      coordinates: this.cartesiansToLocal(region.positions),
      height: region.height,
    }))

    if (this.localPositionsArr.length === 0) {
      this.tileset.customShader = undefined
      return
    }

    const polygonFunctions = this.generatePolygonFunctions()
    const checkCode = this.generateCheckCode()
    this.updateShader(polygonFunctions, checkCode)
  }

  /**
   * 生成多边形判断函数（GLSL）
   */
  private generatePolygonFunctions(): string {
    const lengths = [...new Set(this.localPositionsArr.map((p) => p.coordinates.length))]

    return lengths
      .map(
        (len) => `
      vec2 points_${len}[${len}];
      bool isPointInPolygon_${len}(vec2 point) {
        int nCross = 0;
        const int n = ${len};
        for (int i = 0; i < n; i++) {
          vec2 p1 = points_${len}[i];
          vec2 p2 = points_${len}[int(mod(float(i + 1), float(n)))];
          if (p1.y == p2.y) continue;
          if (point.y < min(p1.y, p2.y)) continue;
          if (point.y >= max(p1.y, p2.y)) continue;
          float x = p1.x + ((point.y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
          if (x > point.x) nCross++;
        }
        return mod(float(nCross), 2.0) == 1.0;
      }
    `
      )
      .join('\n')
  }

  /**
   * 生成区域检查代码（GLSL）
   */
  private generateCheckCode(): string {
    return this.localPositionsArr
      .map((region, i) => {
        const n = region.coordinates.length
        const pointsInit = region.coordinates
          .map((coord, j) => `points_${n}[${j}] = vec2(${coord[0]}, ${coord[1]});`)
          .join('\n')

        return `
        ${pointsInit}
        if (isPointInPolygon_${n}(position2D)) {
          vsOutput.positionMC.z = u_flatHeight_${i};
          return;
        }`
      })
      .join('\n')
  }

  /**
   * 更新 CustomShader
   */
  private updateShader(polygonFunctions: string, checkCode: string): void {
    // 构建 uniforms
    const uniforms: Record<string, any> = {
      u_tileset_localToWorldMatrix: {
        type: Cesium.UniformType.MAT4,
        value: this.matrix,
      },
      u_tileset_worldToLocalMatrix: {
        type: Cesium.UniformType.MAT4,
        value: this.localMatrix,
      },
    }

    // 为每个区域添加高度 uniform
    this.localPositionsArr.forEach((region, i) => {
      uniforms[`u_flatHeight_${i}`] = {
        type: Cesium.UniformType.FLOAT,
        value: region.height,
      }
    })

    const customShader = new Cesium.CustomShader({
      uniforms,
      vertexShaderText: `
        ${polygonFunctions}
        void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
          vec3 modelMC = vsInput.attributes.positionMC;
          vec4 model_local_position = vec4(modelMC, 1.0);
          vec4 tileset_local_position = u_tileset_worldToLocalMatrix * czm_model * model_local_position;
          vec2 position2D = vec2(tileset_local_position.x, tileset_local_position.y);
          
          ${checkCode}
        }
      `,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          // 保持原始材质
        }
      `,
    })

    this.tileset.customShader = customShader

    console.log('[TilesetFlatten] Shader updated:', {
      regions: this.localPositionsArr.length,
      heights: this.localPositionsArr.map((r, i) => `Region${i}: ${r.height}`),
    })
  }

  /**
   * 世界坐标转局部 2D 坐标
   */
  private cartesiansToLocal(positions: any[]): [number, number][] {
    return positions.map((position) => {
      const localP = Cesium.Matrix4.multiplyByPoint(
        this.localMatrix,
        position.clone(),
        new Cesium.Cartesian3()
      )
      return [localP.x, localP.y]
    })
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `flatten_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  }
}

export default TilesetFlatten
