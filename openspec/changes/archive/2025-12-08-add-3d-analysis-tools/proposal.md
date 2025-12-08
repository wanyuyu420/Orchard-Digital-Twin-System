# Proposal: add-3d-analysis-tools

## Why

The Water Conservancy Digital Twin platform needs 3D analysis capabilities for:

1. **Volume Calculation** - Calculate reservoir capacity, excavation volume, flood storage
2. **Flood Simulation** - Visualize water level changes and inundation areas
3. **Terrain Analysis** - Profile lines, slope analysis, viewshed
4. **3D Measurement** - Measure distances considering terrain elevation

These tools are essential for water resource management, flood prevention planning, and engineering design.

## What Changes

### Volume Calculation Tool
- Draw polygon to define analysis area
- Calculate volume between terrain and reference plane
- Support cut/fill volume calculation
- Display results with visualization

### Flood Simulation Tool
- Input water level via slider
- Dynamic inundation visualization
- Show affected area calculation
- Animation of water level rise

### Terrain Profile Tool
- Draw line to define profile path
- Sample terrain heights along path
- Generate elevation profile chart (ECharts)
- Export profile data (CSV)

### 3D Measurement Tool
- Measure considering terrain (surface distance)
- Show horizontal, vertical, and slope distances
- Height mode options: terrain, custom, relative
- Keyboard modifiers: Shift (terrain), Ctrl (custom height)

## Scope

**In Scope:**
- 3D analysis tools with Cesium terrain integration
- Volume and flood calculations using cesium_dev_kit algorithms
- Profile visualization with ECharts
- 3D measurement with height modes

**Out of Scope:**
- 2D drawing tools (completed in previous change)
- Backend data persistence for analysis results
- Real-time sensor data integration

## Affected Specs
- `platform`: Add 3D analysis requirements
- `simulation`: May add flood simulation requirements

## Technical Approach

Leverage existing MIT-licensed libraries:
- **cesium_dev_kit**: Volume calculation, flood simulation algorithms
- **Cesium terrain sampling**: For profile and 3D measurements
- **ECharts**: For profile chart visualization
