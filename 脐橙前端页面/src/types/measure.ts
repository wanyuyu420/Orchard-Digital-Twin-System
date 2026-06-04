export type MeasureToolType = 'distance' | 'area' | null

export interface Coordinate {
  longitude: number
  latitude: number
  height?: number
}

export interface DistanceMeasurement {
  id: string
  type: 'distance'
  startPoint: Coordinate
  endPoint: Coordinate
  distance: number // meters
  createdAt: Date
}

export interface AreaMeasurement {
  id: string
  type: 'area'
  vertices: Coordinate[]
  area: number // square meters
  createdAt: Date
}

export type Measurement = DistanceMeasurement | AreaMeasurement

export interface DrawingState {
  isDrawing: boolean
  toolType: MeasureToolType
  // For distance tool
  startPoint?: Coordinate
  // For area tool
  vertices: Coordinate[]
}
