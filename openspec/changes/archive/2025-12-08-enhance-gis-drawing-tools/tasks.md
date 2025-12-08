# Tasks: enhance-gis-drawing-tools

## Phase 1: Line Drawing Enhancements (4 tasks)

- [x] **T1.1** Add real-time length display during line drawing
  - Show segment length as each point is added
  - Display total cumulative length
  - Update dynamically on mouse move
  - Verify: Length labels visible during drawing

- [x] **T1.2** Implement line type styles
  - Add solid, dashed, dotted options
  - Use PolylineDashMaterialProperty for dashed/dotted
  - Add style selector in drawing toolbar
  - Verify: Different line styles render correctly

- [x] **T1.3** Optimize line preview performance
  - Use CallbackProperty for preview line
  - Throttle updates to 60fps max
  - Reduce entity recreation
  - Verify: Smooth preview without stuttering

- [x] **T1.4** Add line style configuration UI
  - Color picker for line color
  - Width slider (1-10px)
  - Line type dropdown
  - Verify: Style changes apply immediately

## Phase 2: Circle Drawing Enhancements (3 tasks)

- [x] **T2.1** Add real-time radius/area display during circle drawing
  - Show radius as user drags
  - Display calculated area
  - Update label position dynamically
  - Verify: Measurements visible during drag

- [x] **T2.2** Optimize circle preview
  - Use CallbackProperty for radius
  - Single entity with dynamic properties
  - Verify: Smooth circle preview

- [x] **T2.3** Add circle style configuration
  - Fill color with opacity
  - Outline color and width
  - Style persists to completed circle
  - Verify: Styles apply correctly

## Phase 3: Rectangle Drawing Enhancements (3 tasks)

- [x] **T3.1** Add real-time dimensions display during rectangle drawing
  - Show width × height as user drags
  - Display calculated area
  - Verify: Dimensions visible during drag

- [x] **T3.2** Optimize rectangle preview
  - Use CallbackProperty for bounds
  - Smooth corner tracking
  - Verify: Preview follows cursor smoothly

- [x] **T3.3** Add rectangle style configuration
  - Fill and outline options
  - Corner radius option (optional)
  - Verify: Styles apply correctly

## Phase 4: Polygon Drawing Enhancements (3 tasks)

- [x] **T4.1** Add real-time area/perimeter display during polygon drawing
  - Show area after 3+ vertices
  - Display perimeter length
  - Update as vertices are added
  - Verify: Measurements visible during drawing

- [x] **T4.2** Add polygon style configuration
  - Fill color and opacity
  - Outline color and width
  - Fill pattern option (solid, hatched) - optional
  - Verify: Styles apply correctly

- [x] **T4.3** Improve polygon closing preview
  - Show closing line to first vertex
  - Highlight when near closing point
  - Verify: Clear visual feedback for closing

---

## Task Statistics

- **Phase 1 (Line)**: 4/4 tasks ✅
- **Phase 2 (Circle)**: 3/3 tasks ✅
- **Phase 3 (Rectangle)**: 3/3 tasks ✅
- **Phase 4 (Polygon)**: 3/3 tasks ✅
- **Total**: 13/13 tasks ✅

## Implementation Summary

### DrawTool.ts Enhancements
- Added `LineType` type: `'solid' | 'dashed' | 'dotted'`
- Added `createLineMaterial()` for line type support
- Added real-time length display with `calculateCompletedLineLength()` and `formatLength()`
- Added real-time area display with `calculatePolygonArea()`, `calculatePolygonPerimeter()`, `formatArea()`
- Added polygon centroid calculation for label positioning
- Added closing line preview with dashed style
- Enhanced circle preview with area display
- Enhanced rectangle preview with area display

### GIS Store (gis.ts)
- Added `drawStyle` state for shared style configuration
- Includes: strokeColor, strokeWidth, fillColor, fillOpacity, lineType, pointColor, pointSize

### LayerControl.vue
- Added style configuration panel UI
- Color pickers for stroke and fill colors
- Width slider (1-10px)
- Line type dropdown (solid/dashed/dotted)
- Opacity slider for fill

### GISLayer.vue
- Updated `activateTool()` to pass `drawStyle` to DrawTool

## Dependencies

- Requires completed GIS drawing toolkit (archived as 2025-12-06-add-gis-drawing-toolkit)
- Uses existing DrawTool.ts, *Graphic.ts classes
- No backend dependencies
