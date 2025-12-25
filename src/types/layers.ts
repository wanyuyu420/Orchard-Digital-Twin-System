/**
 * Layer Configuration TypeScript Schemas
 * 
 * This file documents the standardized configuration schemas for different layer types.
 * These interfaces define the structure of the `config` JSON field in the `gis_layers` table.
 */

// ============ Base Configuration ============

export interface BaseLayerConfig {
  /** Automatically fly to this layer when enabled */
  autoFlyTo?: boolean
}

// ============ Point Layer (api_point) ============

export interface PointLayerConfig extends BaseLayerConfig {
  /** Field mapping from API response to standard properties */
  mapping?: {
    lng: string   // Field name for longitude
    lat: string   // Field name for latitude
    id: string    // Field name for unique ID
    name: string  // Field name for display name
  }
  
  /** Field to use for point labels */
  labelField?: string
  
  /** Point rendering style */
  pointStyle?: {
    color?: string     // CSS color (e.g., "#00BFFF")
    pixelSize?: number // Point size in pixels
  }
  
  /** For paginated API responses, the key containing the data array */
  responseKey?: string
  
  /** Additional query parameters to send with the API request */
  requestParams?: Record<string, unknown>
  
  /** Real-time update configuration */
  realtime?: RealtimeConfig
}

// ============ 3D Tiles Layer (3dtiles) ============

/** Point cloud specific rendering configuration */
export interface PointCloudConfig {
  /** Point size in pixels (default: 3) */
  pointSize?: number
  
  /** Maximum attenuation distance */
  maximumAttenuation?: number
  
  /** Enable Eye Dome Lighting for depth perception */
  eyeDomeLighting?: boolean
  
  /** Override point color (CSS color name or hex) */
  color?: string
  
  /** Enable distance-based attenuation */
  attenuation?: boolean
  
  /** Maximum screen space error for LOD (higher = lower quality, better performance) */
  maximumScreenSpaceError?: number
}

export interface TilesetLayerConfig extends BaseLayerConfig {
  /** Height offset when terrain is disabled (ellipsoid mode) */
  ellipsoidOffset?: number
  
  /** Height offset when terrain is enabled */
  terrainOffset?: number
  
  /** Full model transformation for positioned tilesets (BIM) */
  alignment?: ModelAlignment

  /** BIM alignment when terrain is disabled (ellipsoid) */
  alignmentEllipsoid?: ModelAlignment

  /** BIM alignment when terrain is enabled */
  alignmentTerrain?: ModelAlignment
  
  /** Point cloud specific rendering settings */
  pointCloud?: PointCloudConfig
}

export interface ModelAlignment {
  longitude: number
  latitude: number
  height: number
  /** Local ENU offsets (meters) for fine-tuning */
  offsetEast?: number
  offsetNorth?: number
  offsetUp?: number
  rotationX: number // degrees
  rotationY: number // degrees
  rotationZ: number // degrees
  scale: number
}

// ============ Terrain Layer (terrain) ============

export interface TerrainLayerConfig extends BaseLayerConfig {
  /** Terrain provider type */
  provider?: 'cesium_world_terrain' | 'ellipsoid' | 'custom'
  
  /** Custom terrain URL (if provider is 'custom') */
  url?: string
}

// ============ Imagery Layer (imagery) ============

export interface ImageryLayerConfig extends BaseLayerConfig {
  /** Imagery provider type */
  provider?: 'bing' | 'osm' | 'arcgis' | 'custom'
  
  /** Custom imagery URL (if provider is 'custom') */
  url?: string
}

// ============ WMS Layer (wms) ============

export interface WMSLayerConfig extends BaseLayerConfig {
  /** WMS layer names */
  layers?: string[]
  
  /** WMS style names */
  styles?: string[]
  
  /** Tile format (e.g., 'image/png') */
  format?: string
  
  /** Tile width */
  tileWidth?: number
  
  /** Tile height */
  tileHeight?: number
}

// ============ GeoJSON Layer (geojson) ============

export interface GeoJSONLayerConfig extends BaseLayerConfig {
  /** Stroke color for line/polygon features */
  strokeColor?: string
  
  /** Stroke width */
  strokeWidth?: number
  
  /** Fill color for polygon features */
  fillColor?: string
  
  /** Fill opacity (0-1) */
  fillOpacity?: number
  
  /** Whether to clamp features to ground */
  clampToGround?: boolean
}

// ============ Real-time Configuration ============

export interface RealtimeConfig {
  /** Enable real-time updates */
  enabled: boolean
  
  /** Update mechanism */
  type?: 'websocket' | 'polling'
  
  /** WebSocket topic or polling endpoint */
  topic?: string
  
  /** Polling interval in milliseconds (if type is 'polling') */
  intervalMs?: number
  
  /** Field in message to match with feature ID */
  idField?: string
  
  /** Fields to update when message is received */
  updateFields?: string[]
}

// ============ Layer Type Enum ============

export type LayerType = 
  | 'api_point'   // Point data from REST API
  | '3dtiles'     // Cesium 3D Tiles
  | 'terrain'     // Terrain provider
  | 'imagery'     // Base imagery
  | 'wms'         // Web Map Service
  | 'geojson'     // GeoJSON vector data
  | 'gltf'        // 3D model (glTF)

// ============ Union Config Type ============

export type LayerConfig = 
  | PointLayerConfig
  | TilesetLayerConfig
  | TerrainLayerConfig
  | ImageryLayerConfig
  | WMSLayerConfig
  | GeoJSONLayerConfig
