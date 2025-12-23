export interface ViewConfig {
  lon: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

export const defaultView: ViewConfig = {
  lon: 87.57,
  lat: 43.82,
  height: 80000,
  heading: 0,
  pitch: -60, // degrees
  roll: 0
}
