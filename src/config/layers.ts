import { AlignmentParams } from '@/cesium/gis/tools/BIMAlignment'

export interface LayerConfig {
  url: string
  visible: boolean
  // Optional alignment override
  alignment?: AlignmentParams
  // Optional grounding offsets
  ellipsoidOffset?: number // default 12
  terrainOffset?: number   // default 8
}

export const projectConfig = {
  // OSGB 3D Tiles (Oblique Photography)
  osgb: {
    url: 'http://localhost:8000/tiles/osgb/tileset.json',
    visible: true,
    // Grounding adjustments
    ellipsoidOffset: 12,
    terrainOffset: 8
  } as LayerConfig,

  // BIM 3D Tiles
  bim: {
    url: 'http://localhost:8000/tiles/bim/tileset.json',
    visible: true,
    // BIM Alignment Parameters
    alignment: {
      longitude: 78.42108125522402,
      latitude: 39.7811204696115,
      height: 1125,
      rotationX: -90,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    }
  } as LayerConfig
}
