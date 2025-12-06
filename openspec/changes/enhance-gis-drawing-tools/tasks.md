# Tasks: enhance-gis-drawing-tools

## Phase 1: Line Drawing Enhancements (4 tasks)

- [ ] **T1.1** Add real-time length display during line drawing
  - Show segment length as each point is added
  - Display total cumulative length
  - Update dynamically on mouse move
  - Verify: Length labels visible during drawing

- [ ] **T1.2** Implement line type styles
  - Add solid, dashed, dotted options
  - Use PolylineDashMaterialProperty for dashed/dotted
  - Add style selector in drawing toolbar
  - Verify: Different line styles render correctly

- [ ] **T1.3** Optimize line preview performance
  - Use CallbackProperty for preview line
  - Throttle updates to 60fps max
  - Reduce entity recreation
  - Verify: Smooth preview without stuttering

- [ ] **T1.4** Add line style configuration UI
  - Color picker for line color
  - Width slider (1-10px)
  - Line type dropdown
  - Verify: Style changes apply immediately

## Phase 2: Circle Drawing Enhancements (3 tasks)

- [ ] **T2.1** Add real-time radius/area display during circle drawing
  - Show radius as user drags
  - Display calculated area
  - Update label position dynamically
  - Verify: Measurements visible during drag

- [ ] **T2.2** Optimize circle preview
  - Use CallbackProperty for radius
  - Single entity with dynamic properties
  - Verify: Smooth circle preview

- [ ] **T2.3** Add circle style configuration
  - Fill color with opacity
  - Outline color and width
  - Style persists to completed circle
  - Verify: Styles apply correctly

## Phase 3: Rectangle Drawing Enhancements (3 tasks)

- [ ] **T3.1** Add real-time dimensions display during rectangle drawing
  - Show width × height as user drags
  - Display calculated area
  - Verify: Dimensions visible during drag

- [ ] **T3.2** Optimize rectangle preview
  - Use CallbackProperty for bounds
  - Smooth corner tracking
  - Verify: Preview follows cursor smoothly

- [ ] **T3.3** Add rectangle style configuration
  - Fill and outline options
  - Corner radius option (optional)
  - Verify: Styles apply correctly

## Phase 4: Polygon Drawing Enhancements (3 tasks)

- [ ] **T4.1** Add real-time area/perimeter display during polygon drawing
  - Show area after 3+ vertices
  - Display perimeter length
  - Update as vertices are added
  - Verify: Measurements visible during drawing

- [ ] **T4.2** Add polygon style configuration
  - Fill color and opacity
  - Outline color and width
  - Fill pattern option (solid, hatched) - optional
  - Verify: Styles apply correctly

- [ ] **T4.3** Improve polygon closing preview
  - Show closing line to first vertex
  - Highlight when near closing point
  - Verify: Clear visual feedback for closing

---

## Task Statistics

- **Phase 1 (Line)**: 4 tasks
- **Phase 2 (Circle)**: 3 tasks
- **Phase 3 (Rectangle)**: 3 tasks
- **Phase 4 (Polygon)**: 3 tasks
- **Total**: 13 tasks

## Dependencies

- Requires completed GIS drawing toolkit (archived as 2025-12-06-add-gis-drawing-toolkit)
- Uses existing DrawTool.ts, *Graphic.ts classes
- No backend dependencies
