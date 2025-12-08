# platform Spec Delta

## ADDED Requirements

### Requirement: Volume Calculation Tool
The system SHALL provide a 3D volume calculation tool for analyzing terrain volumes within user-defined areas.

#### Scenario: Draw volume analysis area
- **WHEN** the user activates the volume calculation tool
- **AND** draws a polygon on the terrain
- **THEN** the system samples terrain heights within the polygon
- **AND** calculates the volume between terrain and a reference plane
- **AND** displays cut volume (above reference) and fill volume (below reference)

#### Scenario: Adjust reference elevation
- **WHEN** a volume analysis area is defined
- **AND** the user changes the reference elevation
- **THEN** the system recalculates volumes
- **AND** updates the visualization showing cut (red) and fill (blue) areas

#### Scenario: Export volume results
- **WHEN** volume calculation is complete
- **THEN** the user can export results including total volume, cut/fill breakdown, and area

### Requirement: Flood Simulation Tool
The system SHALL provide a flood simulation tool for visualizing water level changes and inundation areas.

#### Scenario: Define flood analysis area
- **WHEN** the user activates the flood simulation tool
- **THEN** they can define an analysis area by drawing a polygon or selecting a region
- **AND** the system determines the terrain elevation range within the area

#### Scenario: Adjust water level
- **WHEN** a flood analysis area is defined
- **AND** the user adjusts the water level slider
- **THEN** a water surface is rendered at the specified elevation
- **AND** areas below water level are visually indicated as flooded
- **AND** the affected area (hectares) is calculated and displayed

#### Scenario: Animate flood rise
- **WHEN** flood simulation is active
- **AND** the user clicks the animate button
- **THEN** the water level gradually rises from minimum to maximum
- **AND** the animation can be paused, resumed, or reset
- **AND** current water level and timestamp are displayed during animation

### Requirement: Terrain Profile Tool
The system SHALL provide a terrain profile tool for analyzing elevation changes along a user-defined path.

#### Scenario: Draw profile line
- **WHEN** the user activates the terrain profile tool
- **AND** draws a line on the terrain
- **THEN** the system samples terrain heights along the line
- **AND** generates an elevation profile chart

#### Scenario: View profile chart
- **WHEN** a profile line is drawn
- **THEN** an elevation profile chart is displayed
- **AND** the X-axis shows distance along the path
- **AND** the Y-axis shows elevation
- **AND** hovering on the chart highlights the corresponding point on the map

#### Scenario: Export profile data
- **WHEN** a profile is generated
- **THEN** the user can export the profile as CSV (distance, elevation, coordinates)
- **AND** export the chart as an image

### Requirement: 3D Measurement Tool
The system SHALL provide a 3D measurement tool that considers terrain elevation.

#### Scenario: Measure 3D distance
- **WHEN** the user activates the 3D measurement tool
- **AND** clicks two points on the terrain
- **THEN** the system displays horizontal distance, vertical distance, and slope distance
- **AND** shows the elevation difference and slope angle

#### Scenario: Height mode selection
- **WHEN** the 3D measurement tool is active
- **THEN** the user can select height modes:
  - Terrain mode (Shift): points snap to terrain surface
  - Custom height mode (Ctrl): user enters a specific height
  - Relative mode (Alt): heights relative to first point
- **AND** measurements update based on selected mode

#### Scenario: Multi-point 3D measurement
- **WHEN** measuring in 3D mode
- **AND** the user clicks multiple points
- **THEN** the system shows segment-by-segment measurements
- **AND** displays total horizontal, vertical, and 3D path distances
