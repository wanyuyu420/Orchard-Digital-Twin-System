# Tasks: add-3d-analysis-tools

## Phase 1: Volume Calculation Tool (5 tasks)

- [ ] **T1.1** Extract volume algorithm from cesium_dev_kit
  - Review cesium_dev_kit volume calculation code
  - Create VolumeCalculator utility class
  - Implement cut/fill volume calculation
  - Verify: Algorithm computes correct volumes

- [ ] **T1.2** Create VolumeTool class
  - Extend BaseTool for polygon drawing
  - Integrate VolumeCalculator
  - Handle terrain sampling
  - Verify: Can draw analysis polygon

- [ ] **T1.3** Implement volume visualization
  - Show analysis polygon on terrain
  - Visualize reference plane
  - Color-code cut (red) vs fill (blue) areas
  - Verify: Visualization renders correctly

- [ ] **T1.4** Create Volume Results Panel
  - Display total volume
  - Show cut/fill breakdown
  - Reference elevation input
  - Export results option
  - Verify: Panel displays accurate results

- [ ] **T1.5** Add Volume Tool to toolbar
  - Button in GIS toolbar
  - Tooltip with instructions
  - Integration with GIS store
  - Verify: Tool accessible from UI

## Phase 2: Flood Simulation Tool (5 tasks)

- [ ] **T2.1** Extract flood algorithm from cesium_dev_kit
  - Review flood simulation code
  - Create FloodSimulator utility class
  - Implement water surface generation
  - Verify: Algorithm generates water surface

- [ ] **T2.2** Create FloodTool class
  - Extend BaseTool
  - Define analysis area (polygon or extent)
  - Integrate FloodSimulator
  - Verify: Can define flood area

- [ ] **T2.3** Implement flood visualization
  - Water surface entity with transparency
  - Dynamic water level adjustment
  - Terrain clipping for underwater areas
  - Verify: Flood renders realistically

- [ ] **T2.4** Create Flood Control Panel
  - Water level slider
  - Min/max elevation display
  - Affected area calculation
  - Animation play/pause
  - Verify: Controls work correctly

- [ ] **T2.5** Add flood animation
  - Animate water level rise
  - Speed control
  - Show timestamp/level during animation
  - Verify: Animation plays smoothly

## Phase 3: Terrain Profile Tool (4 tasks)

- [ ] **T3.1** Create ProfileTool class
  - Line drawing for profile path
  - Terrain height sampling along path
  - Distance calculation between samples
  - Verify: Can draw profile line

- [ ] **T3.2** Implement terrain sampling
  - Use Cesium.sampleTerrainMostDetailed
  - Configurable sample density
  - Handle terrain loading async
  - Verify: Heights sampled correctly

- [ ] **T3.3** Create Profile Chart component
  - ECharts line chart
  - X-axis: distance, Y-axis: elevation
  - Hover to show coordinates
  - Zoom and pan support
  - Verify: Chart displays correctly

- [ ] **T3.4** Add profile export
  - Export as CSV (distance, elevation, lat, lon)
  - Export chart as image
  - Verify: Export works correctly

## Phase 4: 3D Measurement Tool (4 tasks)

- [ ] **T4.1** Create Measure3DTool class
  - Extend BaseTool
  - Support terrain-following measurement
  - Calculate horizontal, vertical, slope distances
  - Verify: Basic 3D measurement works

- [ ] **T4.2** Implement height modes
  - Terrain mode (Shift key): snap to terrain
  - Custom height mode (Ctrl key): user input height
  - Relative mode (Alt key): relative to first point
  - Verify: All modes work correctly

- [ ] **T4.3** Create HeightModePanel component
  - Mode selector buttons
  - Custom height input field
  - Show current mode indicator
  - Verify: UI controls work

- [ ] **T4.4** Add 3D measurement display
  - Show all distance types (horizontal, vertical, slope)
  - Display elevation difference
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
