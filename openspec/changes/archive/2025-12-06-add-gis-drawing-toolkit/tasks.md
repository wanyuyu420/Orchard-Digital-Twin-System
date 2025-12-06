# Tasks: Add GIS Drawing Toolkit

> **Updated 2025-12-03**: Adopting Hybrid Architecture (Option A)
> **Strategy**: Extract algorithms from cesium-drawer + cesium_dev_kit, build custom framework
> **License**: All sources MIT licensed, will maintain proper attribution
>
> **⚠️ IMPORTANT**: This change **supersedes** `implement-gis-measure-tools`
> - Existing MeasureLayer.vue (634 lines) will be replaced by GISLayer.vue
> - Measurement tools reimplemented as MeasureTool class (extends DrawTool)
> - No need to complete remaining tasks in implement-gis-measure-tools

---

## Phase 0: Research & Architecture Setup (Week 1)

### Open Source Integration

- [x] **T0.1** Extract cesium-drawer core code
  - Clone https://github.com/hongfaqiu/cesium-drawer
  - Copy `src/utils/plugins/CesiumDrawer.ts` to `src/cesium/gis/vendor/cesium-drawer/`
  - Add MIT license header with attribution
  - Document source commit hash
  - 验证：Code compiles, no dependencies missing

- [x] **T0.2** Extract cesium_dev_kit volume calculation algorithm
  - Clone https://github.com/dengxiaoning/cesium_dev_kit
  - Extract volume calculation logic to `src/cesium/gis/utils/volume.ts`
  - Add MIT license header with attribution
  - Create unit tests for extracted algorithm
  - 验证：Volume calculation test passes

- [x] **T0.3** Research @cesium-extends/drawer
  - Install via npm OR copy source code
  - Analyze point/line/circle drawing implementation
  - Document API and integration approach
  - 验证：Can import and instantiate drawer

### Core Architecture

- [x] **T0.4** Create directory structure
  ```bash
  mkdir -p src/cesium/gis/{core,graphics,tools,utils,vendor}
  mkdir -p src/cesium/gis/vendor/{cesium-drawer,cesium-extends}
  ```
  - 验证：Directory structure matches design.md

- [x] **T0.5** Implement BaseTool abstract class
  - File: `src/cesium/gis/core/BaseTool.ts`
  - Methods: activate(), deactivate(), setupEventHandlers(), destroy()
  - Inspired by OpenLayers Interaction pattern
  - 验证：Can extend BaseTool and create instances

- [x] **T0.6** Implement BaseGraphic abstract class
  - File: `src/cesium/gis/core/BaseGraphic.ts`
  - Methods: create(), remove(), show(), hide(), startEdit(), stopEdit(), toGeoJSON()
  - Properties: id, name, type, style, entities[]
  - 验证：Can extend BaseGraphic and implement concrete classes

### Type System (3D-Ready)

- [x] **T0.7** Create 3D coordinate types `src/types/geometry.ts`
  - Coordinate3D interface (longitude, latitude, height, heightReference)
  - HeightReference enum (CLAMP_TO_GROUND, RELATIVE_TO_GROUND, ABSOLUTE)
  - Coordinate2D interface (backward compatibility)
  - Type guard: is3D(coord): coord is Coordinate3D
  - 验证：TypeScript strict mode passes

- [x] **T0.8** Create unified GIS types
  - File: `src/types/draw.ts` - DrawToolType, DrawingState
  - File: `src/types/feature.ts` - Feature interfaces, FeatureCollection
  - Measurement3D type (distance3D, distanceHorizontal, distanceVertical, slope, volume)
  - 验证：类型编译通过

### Unified Store

- [x] **T0.9** Create unified GISStore `src/stores/gis.ts`
  - State: activeTool, toolMode, features (Map), selectedIds (Set), history[]
  - Actions: setTool, addFeature, updateFeature, deleteFeature, selectFeature
  - Actions: undo, redo, exportGeoJSON, importGeoJSON
  - 验证：Store 初始化正确，Pinia devtools 可见

- [x] **T0.10** Reimplement measurement tools in new architecture
  - Create MeasureTool class (extends BaseTool, not DrawTool)
  - Distance measurement = Line + distance label
  - Area measurement = Polygon + area label
  - Migrate logic from existing MeasureLayer.vue (634 lines)
  - 验证：Distance and area measurement work as before

- [x] **T0.11** Create backward-compatible MeasurePanel
  - Update MeasurePanel.vue to use useGISStore instead of useMeasureStore
  - Filter features to show only measurements (type: 'distance' | 'area')
  - Keep existing UI unchanged
  - 验证：MeasurePanel displays without errors, shows measurements

---

## Phase 1: 2D Graphics Implementation (Week 2-3)

> **⚠️ IMPORTANT - Task Execution Order**:
> 1. **T1.7 (DrawTool) MUST be implemented FIRST** - provides shared drawing logic
> 2. Then implement Graphics in order: Point → Line → Polygon → Circle → Rectangle
> 3. MeasureTool is independent and already complete (Phase 0)
>
> **⚠️ Implementation Guidelines**:
> - Implement ONE task at a time, do NOT batch multiple tasks
> - Follow existing UI/UX patterns from TopRibbon.vue and MeasurePanel.vue
> - Keep components simple and focused
> - Test each task before moving to the next

### Drawing Tool Foundation

- [x] **T1.7** Implement DrawTool class **← START HERE**
  - File: `src/cesium/gis/tools/DrawTool.ts`
  - Extend BaseTool
  - Support all geometry types (point, line, polygon, circle, rectangle)
  - Handle mouse events (click, move, double-click, right-click)
  - Emit completion events to GISStore
  - Reference MeasureTool.ts for event handling patterns
  - 验证：Can switch between different drawing modes
  - Status: Basic framework complete, preview logic to be implemented with Graphic classes

### Polygon Drawing (Using cesium-drawer)

- [x] **T1.1** Implement PolygonGraphic class
  - File: `src/cesium/gis/graphics/PolygonGraphic.ts`
  - Extend BaseGraphic
  - Implement independent Polyline for outline (cesium outlineWidth limitation) ✅
  - Area calculation using Shoelace formula (geodesic)
  - Support vertex operations: update, insert, delete
  - Area label with auto formatting
  - Edit mode: vertex markers
  - GeoJSON export as closed polygon
  - 验证：Can draw polygon with left click, right click cancel, double click complete
  - Status: Complete (425 lines), basic tests pass (3/23)

- [ ] **T1.2** Implement polygon vertex editing
  - Method: startEdit() - show editable vertices
  - Method: updateVertex(index, position) - drag vertex
  - Method: removeVertex(index) - Shift+Click delete
  - Method: insertVertex(index, position) - Click edge midpoint
  - **Use cesium-drawer's addOnePosition/changeOnePosition/removeOnePosition logic**
  - 验证：Vertex editing works smoothly

### Point & Line Drawing (Using @cesium-extends/drawer)

- [x] **T1.3** Implement PointGraphic class
  - File: `src/cesium/gis/graphics/PointGraphic.ts`
  - Extend BaseGraphic
  - Support custom icon (billboard) and simple point
  - Support text label
  - 验证：Single click adds point with label
  - Status: Basic implementation complete (238 lines), edit mode to be implemented

- [x] **T1.4** Implement LineGraphic class
  - File: `src/cesium/gis/graphics/LineGraphic.ts`
  - Extend BaseGraphic
  - Use Cesium.PolylineGraphics for rendering
  - Calculate length using geodesic distance
  - Support line styles: solid, dashed, dotted
  - Display length label at midpoint
  - 验证：Continuous clicks draw polyline
  - Status: Complete (392 lines), 14/14 tests pass

### Circle & Rectangle

- [x] **T1.5** Implement CircleGraphic class
  - File: `src/cesium/gis/graphics/CircleGraphic.ts`
  - Extend BaseGraphic
  - Use Cesium.EllipseGraphics
  - Dynamic radius on mouse move
  - Display radius and area labels
  - Support edit mode (center + edge markers)
  - GeoJSON export with polygon approximation
  - 验证：Two clicks create circle
  - Status: Complete (409 lines), basic tests pass, mock improvements needed

- [x] **T1.6** Implement RectangleGraphic class
  - File: `src/cesium/gis/graphics/RectangleGraphic.ts`
  - Extend BaseGraphic
  - Use Cesium.RectangleGraphics (performance optimized)
  - Two clicks: opposite corners
  - Display dimensions (width × height) and area labels
  - Geodesic dimension calculation
  - Edit mode: 4 corner markers
  - GeoJSON export as closed polygon
  - 验证：Two clicks create rectangle
  - Status: Complete (426 lines), basic tests pass (3/16)

### Drawing Tools

- [x] **T1.7** Implement DrawTool class
  - File: `src/cesium/gis/tools/DrawTool.ts`
  - Extend BaseTool
  - Support all geometry types (point, line, polygon, circle)
  - Handle mouse events (click, move, double-click, right-click)
  - Emit completion events to GISStore
  - 验证：Can switch between different drawing modes

## Phase 3: 线绘制工具

- [ ] **T3.1** 实现线绘制工具点击处理
  - 连续点击添加顶点
  - 右键或 ESC 完成绘制
  - 创建 LineFeature 对象
  - 验证：点击绘制折线

- [ ] **T3.2** 实现线预览（鼠标移动）
  - 动态线段从最后顶点到光标
  - 使用 CallbackProperty 更新
  - 验证：预览线跟随光标

- [ ] **T3.3** 计算并显示线长度
  - Cesium 大地测量计算总长度
  - 标签显示在线段中点
  - 自动单位切换（m/km）
  - 验证：长度计算正确

- [ ] **T3.4** 实现线型样式
  - 实线
  - 虚线（PolylineDashMaterialProperty）
  - 点线
  - 验证：线型样式正确渲染

## Phase 4: 圆形绘制工具

- [ ] **T4.1** 实现圆形绘制交互
  - 第一次点击设置圆心
  - 鼠标移动动态调整半径
  - 第二次点击完成
  - 验证：圆形绘制流畅

- [ ] **T4.2** 实现圆形预览
  - EllipseGraphics 动态半径
  - 使用 CallbackProperty
  - 验证：预览圆跟随光标

- [ ] **T4.3** 计算圆形属性
  - 半径计算（大地测量）
  - 面积计算（π * r²）
  - 标签显示半径和面积
  - 验证：计算正确

- [ ] **T4.4** 圆形样式配置
  - 填充颜色和透明度
  - 边框颜色和宽度
  - 验证：样式正确应用

## Phase 5: 矩形绘制工具

- [ ] **T5.1** 实现矩形绘制交互
  - 第一次点击设置起点
  - 拖动鼠标到对角点
  - 第二次点击完成
  - 验证：矩形绘制正常

- [ ] **T5.2** 实现矩形预览
  - RectangleGraphics 动态坐标范围
  - 使用 CallbackProperty
  - 验证：预览矩形跟随光标

- [ ] **T5.3** 计算矩形属性
  - 长度和宽度（大地测量）
  - 面积计算
  - 标签显示尺寸
  - 验证：计算正确

## Phase 6: 多边形绘制工具增强

- [ ] **T6.1** 复用现有多边形测量工具
  - 将 MeasureLayer 的面积测量逻辑提取
  - 集成到 DrawLayer
  - 添加样式配置支持
  - 验证：功能迁移无损

- [ ] **T6.2** 增强多边形样式
  - 填充图案支持（可选）
  - 边框样式配置
  - 验证：样式丰富

## Phase 7: Drawing Toolbar UI ✅

> **Completed 2025-12-05**: Integrated into LayerControl Tab 2 (not separate DrawToolbar)

- [x] **T7.1** Tool button components
  - Quick tool buttons in LayerControl Tab 2
  - Icons for point/line/circle/rectangle/polygon
  - Active state styling
  - Verify: UI displays correctly ✅

- [x] **T7.2** Integration into LayerControl
  - Changed from TopRibbon to LayerControl integration
  - Tab 1: Resource layers, Tab 2: GIS features
  - Verify: Toolbar layout reasonable ✅

- [x] **T7.3** Tool switching logic
  - `toggleDrawTool()` function in GISLayer.vue
  - Tool mutual exclusion implemented
  - Visual feedback on active tool
  - Verify: Tool switching smooth ✅

## Phase 8: Feature Selection ✅

> **Completed 2025-12-05**: Map-based selection with visual highlighting

- [x] **T8.1** Selection interaction
  - ScreenSpaceEventHandler in GISLayer.vue for LEFT_CLICK
  - Entity lookup via featureId property binding
  - Skip selection when drawing tool active
  - Verify: Click to select feature ✅

- [x] **T8.2** Visual highlighting
  - `setHighlight()` method in BaseGraphic
  - Original style saved before highlight (gold #FFD700, +2px stroke)
  - `applyStyle()` implemented in all Graphic subclasses
  - Watch on selectedFeatureIds syncs highlight from all sources
  - Verify: Highlight effect visible ✅

- [x] **T8.3** Multi-select support
  - DOM keyboard listeners track Ctrl/Meta key state
  - Ctrl+Click: Toggle selection (`toggleSelection()`)
  - Normal click: Single selection
  - Click empty space: Deselect all (unless Ctrl held)
  - Verify: Multi-select logic correct ✅

## Phase 9: Feature List Panel ✅

> **Completed 2025-12-05**: Integrated into LayerControl Tab 2

- [x] **T9.1** Feature list panel
  - Integrated into LayerControl Tab 2 (not separate component)
  - Features grouped by type
  - Scrollable area
  - Verify: Panel displays correctly ✅

- [x] **T9.2** Feature list items
  - Type icons (point/line/polygon/circle/rectangle)
  - Feature name display
  - Action buttons: show/hide, locate, delete
  - Verify: List item interaction works ✅

- [x] **T9.3** Search and filter
  - Search input in LayerControl
  - Real-time filtering by name
  - Verify: Search works correctly ✅

- [x] **T9.4** Batch operations
  - Export all features
  - Select all / Clear all
  - Verify: Batch operations work ✅

- [x] **T9.5** Mount to LayerControl
  - Dual-tab panel design
  - Tab switching between layers and GIS features
  - Verify: Panel integration complete ✅

## Phase 10: Feature Movement ✅

> **Completed 2025-12-05**: Drag-to-move for all feature types

- [x] **T10.1** Implement drag detection
  - LEFT_DOWN on selected feature starts drag
  - MOUSE_MOVE triggers movement
  - LEFT_UP completes move and updates store
  - Camera controls disabled during drag
  - Verify: Drag detection accurate ✅

- [x] **T10.2** Implement point feature movement
  - Added `move(offset)` method to PointGraphic
  - Uses `updatePosition()` internally
  - Verify: Point movement smooth ✅

- [x] **T10.3** Implement line/polygon feature movement
  - Added `move(offset)` method to all Graphic classes
  - LineGraphic: Updates all vertices via `updatePositions()`
  - PolygonGraphic: Updates all vertices via `updatePositions()`
  - CircleGraphic: Moves center, preserves radius
  - RectangleGraphic: Moves both corners
  - Verify: Complex feature movement works ✅

- [x] **T10.4** Update Store after movement
  - `updateFeatureGeometry()` syncs graphic positions to feature
  - Updates geometry coordinates based on feature type
  - Updates timestamp via `gisStore.updateFeature()`
  - Verify: Data persisted correctly ✅

## Phase 11: Vertex Editing

- [ ] **T11.1** Create EditLayer component
  - Double-click feature to enter edit mode
  - Show editable vertices (point entities)
  - Verify: Edit mode activates

- [ ] **T11.2** Implement vertex dragging
  - Mouse down on vertex
  - Drag to update vertex position
  - Use CallbackProperty for geometry updates
  - Verify: Vertex dragging smooth

- [ ] **T11.3** Implement vertex deletion
  - Shift+Click to delete vertex
  - Enforce minimum vertex count (line>=2, polygon>=3)
  - Verify: Deletion logic correct

- [ ] **T11.4** Implement vertex insertion
  - Click edge midpoint to insert vertex
  - Auto-calculate insertion position
  - Verify: Insertion works correctly

- [ ] **T11.5** Exit edit mode
  - ESC to exit
  - Click empty space to exit
  - Save changes to Store
  - Verify: Exit logic correct

## Phase 12: Style Configuration Panel

- [ ] **T12.1** Create StylePanel component
  - Panel container and layout
  - Collapse/expand functionality
  - Verify: Panel displays correctly

- [ ] **T12.2** Implement color picker
  - Fill color selection
  - Stroke color selection
  - Opacity slider
  - Verify: Color picker works

- [ ] **T12.3** Implement line width and style config
  - Line width slider (1-10px)
  - Line style dropdown (solid/dashed/dotted)
  - Verify: Config options work

- [ ] **T12.4** Implement point size config
  - Point size slider (5-20px)
  - Real-time preview
  - Verify: Point size adjustment works

- [ ] **T12.5** Implement real-time style application
  - Watch style changes
  - Update selected feature styles
  - Update Cesium entities
  - Verify: Styles apply in real-time

- [ ] **T12.6** Implement style presets
  - Preset style library (5-10 presets)
  - Save current style as preset
  - Quick apply preset
  - Verify: Presets work correctly

## Phase 13: Properties Panel

- [ ] **T13.1** Create PropertiesPanel component
  - Panel container and layout
  - Basic properties display (type, creation time, etc.)
  - Verify: Panel displays correctly

- [ ] **T13.2** Implement name and description editing
  - Name input field
  - Description text area
  - Real-time save
  - Verify: Editing works correctly

- [ ] **T13.3** Implement custom properties
  - Add custom fields
  - Field types (text, number, date)
  - Delete fields
  - Verify: Custom properties work

- [ ] **T13.4** Implement geometry properties display
  - Distance/length (line)
  - Area (polygon/circle)
  - Radius (circle)
  - Read-only display
  - Verify: Property calculations correct

## Phase 14: Data Import/Export

- [ ] **T14.1** Implement GeoJSON export
  - Convert Feature to GeoJSON format
  - Coordinate conversion (Cartesian3 → WGS84)
  - Save style info in properties
  - File download (file-saver)
  - Verify: Exported GeoJSON format correct

- [ ] **T14.2** Implement export options
  - Export all/selected only
  - Custom filename
  - Format validation
  - Verify: Export options work

- [ ] **T14.3** Implement GeoJSON import
  - File upload
  - JSON parsing
  - GeoJSON format validation
  - Verify: File reading works

- [ ] **T14.4** Implement GeoJSON parsing
  - Parse different geometry types
  - Coordinate conversion (WGS84 → Cartesian3)
  - Style restoration
  - Verify: Imported features display correctly

- [ ] **T14.5** Error handling
  - Format error messages
  - Unsupported coordinate system messages
  - Partial import failure handling
  - Verify: Error handling comprehensive

## Phase 15: Snapping

- [ ] **T15.1** Implement vertex snapping
  - Detect nearby vertices (screen space)
  - Snap tolerance config (5-20px)
  - Visual feedback (highlight target vertex)
  - Verify: Vertex snapping accurate

- [ ] **T15.2** Implement edge snapping
  - Calculate point-to-line projection
  - Snap to nearest edge
  - Visual feedback (highlight target edge)
  - Verify: Edge snapping accurate

- [ ] **T15.3** Snapping performance optimization
  - Spatial index (R-tree or Quadtree)
  - Limit snap range (viewport only)
  - Throttle processing
  - Verify: Snapping smooth, no lag

- [ ] **T15.4** Snapping toggle and config
  - Global toggle (gisStore.snapEnabled)
  - Tolerance config (gisStore.snapTolerance)
  - UI toggle button
  - Verify: Config takes effect

## Phase 16: Undo/Redo

- [ ] **T16.1** Implement history stack
  - Operation history array (max 50 steps)
  - Current pointer
  - Add operation records
  - Verify: History recording correct

- [ ] **T16.2** Implement undo
  - Ctrl+Z shortcut
  - Restore previous state
  - Update gisStore
  - Verify: Undo works correctly

- [ ] **T16.3** Implement redo
  - Ctrl+Y shortcut
  - Restore next state
  - Update gisStore
  - Verify: Redo works correctly

- [ ] **T16.4** History UI (optional)
  - Display operation history list
  - Jump to any history point
  - Verify: History UI works

## Phase 17: Integration & Optimization

- [ ] **T17.1** Integrate measurement tools
  - Integrate distance measurement as line drawing measurement mode
  - Integrate area measurement as polygon drawing measurement mode
  - Maintain backward compatibility
  - Verify: Measurement functionality intact

- [ ] **T17.2** Performance optimization
  - Entity pool management
  - Batch updates
  - Lazy load large feature sets
  - Verify: Smooth with 100 features

- [ ] **T17.3** Keyboard shortcuts system
  - ESC cancel current operation
  - Delete remove selected features
  - Ctrl+Z/Y undo/redo
  - Ctrl+A select all
  - Verify: Shortcuts work correctly

- [ ] **T17.4** Tooltips
  - Button hover tooltips
  - Shortcut hints
  - Operation guidance
  - Verify: Tooltips user-friendly

---

## Phase 5+: Future Enhancements (Deferred)

### 3D Analysis Tools (Phase 5-6, 2-3 weeks)

Planned for future implementation after 2D foundation is solid:

- [ ] **Volume Calculation Tool**
  - Integrate cesium_dev_kit volume algorithm
  - UI panel for volume results
  - Support reservoir capacity calculation

- [ ] **Flood Simulation Tool**
  - Integrate cesium_dev_kit flood simulation
  - Water level input slider
  - Dynamic inundation visualization

- [ ] **Terrain Profile Tool**
  - Sample terrain heights along line
  - Generate profile chart (ECharts)
  - Export profile data

- [ ] **3D Measurement Tool**
  - Measure 3D distance (horizontal + vertical + slope)
  - Height mode switcher (HeightModePanel component)
  - Keyboard shortcuts: Shift (terrain), Ctrl (custom height), Alt (relative)

See `design.md` for detailed 3D feature roadmap.

---

## Testing & Documentation

- [ ] **T-Test.1** 功能测试
  - 所有绘制工具功能正常
  - 选择、编辑、样式配置正常
  - 导入导出正常
  - 验证：无阻断性 bug

- [ ] **T-Test.2** 性能测试
  - 100个要素绘制和交互 (>30fps)
  - 内存占用测试
  - 长时间运行稳定性
  - 验证：性能达标

- [ ] **T-Test.3** 浏览器兼容性测试
  - Chrome 最新版
  - Firefox 最新版
  - Edge 最新版
  - 验证：主流浏览器兼容

- [ ] **T-Test.4** 构建验证
  - npm run build 通过
  - TypeScript 编译无错误
  - 产物大小合理（增量<200KB after gzip）
  - 验证：构建成功

- [ ] **T-Doc.1** License attribution
  - Create THIRD_PARTY_LICENSES.md
  - List cesium-drawer, cesium_dev_kit, @cesium-extends/drawer
  - Include MIT license text and copyright notices
  - 验证：Legal compliance confirmed

- [ ] **T-Doc.2** 更新 tasks.md
  - 所有任务标记为完成
  - 记录实际耗时
  - 验证：任务列表完整

---

## Task Statistics (Updated)

**Phase 0: Foundation** - 10 tasks (Open Source Integration + Core Architecture + Type System + Store)
**Phase 1: 2D Graphics** - 7 tasks (Polygon + Point/Line + Circle/Rectangle + DrawTool)
**Phase 2: Selection & Management** - 5 tasks (SelectTool + FeatureListPanel)
**Phase 3: Editing** - 5 tasks (MoveTool + ModifyTool)
**Phase 4: UI & Style** - 10 tasks (Toolbar + StylePanel + PropertiesPanel)
**Phase 5+: Future (3D)** - 4+ tasks (Volume + Flood + Profile + 3D Measure) - **Deferred**
**Testing & Docs** - 6 tasks

**Total Phase 0-4: ~43 tasks (2D features complete)**
**Total with 3D: ~47+ tasks**

> **Note**: Original 67-task plan restructured to prioritize 2D foundation (Phase 0-4) before 3D features (Phase 5+). This aligns with Hybrid Architecture decision to deliver incrementally.
