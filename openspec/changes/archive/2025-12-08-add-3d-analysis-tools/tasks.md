# Tasks: add-3d-analysis-tools

## Phase 1: Volume Calculation Tool (5 tasks) ✅

- [x] **T1.1** Extract volume algorithm from cesium_dev_kit
  - Review cesium_dev_kit volume calculation code
  - Create VolumeCalculator utility class
  - Implement cut/fill volume calculation
  - Verify: Algorithm computes correct volumes

- [x] **T1.2** Create VolumeTool class
  - Extend BaseTool for polygon drawing
  - Integrate VolumeCalculator
  - Handle terrain sampling
  - Verify: Can draw analysis polygon

- [x] **T1.3** Implement volume visualization
  - Show analysis polygon on terrain
  - Visualize reference plane
  - Color-code cut (red) vs fill (blue) areas
  - Verify: Visualization renders correctly

- [x] **T1.4** Create Volume Results Panel
  - Display total volume
  - Show cut/fill breakdown
  - Reference elevation input
  - Export results option
  - Verify: Panel displays accurate results

- [x] **T1.5** Add Volume Tool to toolbar
  - Button in GIS toolbar
  - Tooltip with instructions
  - Integration with GIS store
  - Verify: Tool accessible from UI

## Phase 2: Flood Simulation Tool (5 tasks) ✅

- [x] **T2.1** Create TilesetService for 3D Tiles loading
  - Created TilesetService utility class
  - Support local tileset.json and Ion assets
  - Style management and flyTo
  - Verify: Can load and display 3D Tiles

- [x] **T2.2** Create FloodTool class
  - Extend BaseTool for polygon drawing
  - Three modes: polygon, tileset, terrain
  - Water level control
  - Verify: Can draw flood analysis polygon

- [x] **T2.3** Implement flood visualization
  - Dynamic water surface with opacity
  - Water level raise/lower
  - Animation support (auto rise/fall)
  - Verify: Water surface renders correctly

- [x] **T2.4** Create mock test data
  - GeoJSON inundation polygons
  - Three severity levels (mild/large/extreme)
  - Located in public/mock/flood/
  - Verify: Test data loads correctly

- [x] **T2.5** Add FloodTool to toolbar
  - Enabled in LayerControl.vue
  - GISLayer.vue integration
  - Blue water icon
  - Verify: Tool accessible from UI

## Phase 3: Terrain Profile Tool (4 tasks) ✅

- [x] **T3.1** Create ProfileTool class
  - Line drawing for profile path (two-point mode)
  - Terrain height sampling along path
  - Distance calculation between samples
  - Verify: Can draw profile line

- [x] **T3.2** Implement terrain sampling
  - Use Cesium.sampleTerrainMostDetailed
  - Configurable sample density (default 20m)
  - Handle terrain loading async with progress callback
  - Verify: Heights sampled correctly

- [x] **T3.3** Create Profile Chart component
  - ECharts line chart with dark theme
  - X-axis: distance, Y-axis: elevation
  - Hover to show coordinates
  - Data zoom and pan support
  - Verify: Chart displays correctly

- [x] **T3.4** Add profile export
  - Export as CSV (distance, elevation, lat, lon)
  - Export chart as PNG image
  - Download functionality in ProfileTool
  - Verify: Export works correctly

## Phase 4: 3D Measurement Tool (4 tasks) ✅

- [x] **T4.1** Create Measure3DTool class
  - Extend BaseTool
  - Support terrain-following measurement
  - Calculate horizontal, vertical, slope distances
  - Verify: Basic 3D measurement works

- [x] **T4.2** Implement height modes
  - Terrain mode (Shift key): snap to terrain
  - Custom height mode (Ctrl key): user input height
  - Relative mode (Alt key): relative to first point
  - Verify: All modes work correctly

- [x] **T4.3** Height mode UI (in-tool)
  - Mode indicator in preview label
  - Keyboard shortcuts for mode switching
  - Shows current mode during measurement
  - Verify: UI controls work

- [x] **T4.4** Add 3D measurement display
  - Show all distance types (horizontal, vertical, slope)
  - Display elevation difference with arrow
  - Angle/slope percentage
  - Verify: All measurements displayed

---

## Task Statistics

- **Phase 1 (Volume)**: 5 tasks
- **Phase 2 (Flood)**: 5 tasks
- **Phase 3 (Profile)**: 4 tasks
- **Phase 4 (3D Measure)**: 4 tasks
- **Total**: 18 tasks

## Dependencies

- Requires completed GIS drawing toolkit
- Uses cesium_dev_kit algorithms (MIT license)
- Requires Cesium terrain provider
- ECharts for profile visualization

## Technical Notes

### cesium_dev_kit Integration
```
Algorithms to extract:
- measureTerrainVolume() - Volume calculation
- bindFloodAnalysis() - Flood simulation
- terrain sampling utilities
```

### Performance Considerations
- Terrain sampling is async - need loading indicators
- Large polygons may require chunked processing
- Flood animation should be throttled
