# Design: Add GIS Drawing Toolkit

## Context

This change introduces a comprehensive GIS drawing and editing toolkit for the Water Conservancy Digital Twin Platform. The implementation requires careful technical decisions about architecture, third-party library integration, and 3D capability planning.

### Background

- **Current State**: Basic measurement tools exist (distance, area) but lack drawing, editing, and 3D analysis capabilities
- **Business Need**: Water conservancy projects require marking locations, drawing flood zones, calculating reservoir volumes, and analyzing terrain profiles
- **Technical Constraint**: Must integrate with existing Vue 3 + TypeScript + Cesium architecture while maintaining the "HUD Immersive Cockpit" visual style

### Stakeholders

- **End Users**: Engineers who need to annotate maps, plan flood zones, and measure volumes
- **Development Team**: Requires maintainable, extensible architecture
- **Project Architect**: Needs long-term 3D capability roadmap

---

## Goals / Non-Goals

### Goals

1. **Unified Architecture**: Integrate measurement and drawing tools under a single, extensible framework
2. **2D Foundation First**: Deliver complete 2D drawing/editing capabilities in Phase 1
3. **3D-Ready Design**: Ensure architecture supports future 3D features (volume calculation, flood simulation, terrain profiles)
4. **Code Reusability**: Maximize use of proven open-source algorithms while maintaining control
5. **Performance**: Handle 100+ features smoothly (>30fps)

### Non-Goals

1. **Full 3D Implementation Now**: 3D analysis tools (volume, flood simulation) are planned for Phase 2+, not immediate delivery
2. **Shapefile Direct Import**: Will use GeoJSON as intermediate format
3. **Offline Mode**: Browser-based only, no local storage initially
4. **Multi-user Collaboration**: Single-user editing only

---

## Technology Research & Selection

### Open Source Ecosystem Survey

We conducted comprehensive research on Cesium GIS toolkits (see investigation results):

#### Key Findings

| Library | Strengths | Weaknesses | License | Verdict |
|---------|-----------|------------|---------|---------|
| **cesium-drawer** (hongfaqiu) | ⭐⭐⭐⭐⭐<br>- Excellent TypeScript code quality<br>- Rich polygon editing API<br>- Live demo available | - Not published to npm<br>- Polygon-only | MIT | ✅ **Core reference for 2D editing** |
| **cesium_dev_kit** (dengxiaoning) | ⭐⭐⭐⭐⭐<br>- Complete 3D analysis suite<br>- Volume calculation<br>- Flood simulation | - Chinese docs<br>- Different API style from Cesium | MIT | ✅ **Use for 3D algorithms** |
| **@cesium-extends/drawer** | ⭐⭐⭐⭐<br>- npm package<br>- Supports point/line/circle | - Limited docs | MIT | ✅ **Supplement for basic shapes** |
| **@vcmap/draw** | ⭐⭐⭐⭐<br>- 3D volume extrusion<br>- Strong editor | - Coupled with VirtualCityMAP | MIT | ⚠️ **Reference only** |
| **Cesium ion SDK** | ⭐⭐⭐<br>- Official solution<br>- GPU-accelerated | - **Commercial license required**<br>- Cannot customize UI | Commercial | ❌ **Not suitable** |
| **public/cesium-draw** (existing) | ⭐⭐⭐<br>- Vue 3 compatible<br>- Already in project | - 2D only<br>- Limited features | Unknown | ⚠️ **Will be replaced** |

#### Water Conservancy 3D Requirements Matching

| Requirement | Priority | Best Solution | Status |
|-------------|----------|---------------|--------|
| **Reservoir Volume Calculation** | P0 | cesium_dev_kit | Phase 2 |
| **Flood Simulation** | P0 | cesium_dev_kit | Phase 2 |
| **Terrain Profile Analysis** | P1 | cesium_dev_kit | Phase 2 |
| **3D Pipeline Modeling** | P1 | @vcmap/draw (reference) | Phase 3 |
| **3D Distance Measurement** | P0 | Custom implementation | Phase 2 |
| **2D Drawing & Editing** | P0 | cesium-drawer | Phase 1 |

---

## Decisions

### Decision 1: Adopt Hybrid Architecture (Option A) ✅

**Problem**: Should we build from scratch, use existing libraries as-is, or create a hybrid approach?

**Options Considered**:

- **Option A (Hybrid)**: Extract algorithms from open-source libraries, build custom architecture
- **Option B (Full Dependency)**: Use @cesium-extends/drawer + cesium_dev_kit as-is
- **Option C (Pure Custom)**: Implement everything from scratch

**Decision**: **Option A - Hybrid Architecture**

**Rationale**:

1. **Speed**: Can deliver 2D features in 1 week (vs 2-3 weeks pure custom)
2. **Quality**: Reuse battle-tested algorithms from cesium-drawer (polygon editing) and cesium_dev_kit (volume calculation)
3. **Control**: Code lives in our project, fully customizable
4. **License Safety**: All source libraries are MIT licensed
5. **Maintainability**: Unified architecture easier to maintain than multiple dependencies with different APIs

**Implementation Strategy**:

```
Hybrid Architecture Layers:

Layer 1: Core Abstractions (Custom)
├── BaseTool (inspired by OpenLayers Interaction pattern)
├── BaseGraphic (inspired by cesium-draw Graphic.js)
└── ToolManager (state machine)

Layer 2: 2D Graphics (Extracted from Open Source)
├── PolygonGraphic ← cesium-drawer core algorithm
├── LineGraphic ← @cesium-extends/drawer
└── PointGraphic ← @cesium-extends/drawer

Layer 3: 3D Analysis (Extracted from Open Source)
├── VolumeCalculator ← cesium_dev_kit
├── FloodSimulator ← cesium_dev_kit + Cesium-Examples-2
└── ProfileAnalyzer ← cesium_dev_kit

Layer 4: UI Components (Custom)
├── DrawToolbar (matches project's HUD style)
├── FeatureListPanel
└── HeightModePanel (for 3D)
```

**Alternatives Considered**:

- **Option B**: Too many dependencies, inconsistent APIs, hard to customize
- **Option C**: Too slow, reinventing the wheel, high risk

---

### Decision 2: Unified Store for Measurement + Drawing ✅

**Problem**: Current `useMeasureStore` only handles measurements. Should we create separate `useDrawStore` or unify?

**Decision**: Create unified `useGISStore` that replaces `useMeasureStore`

**Rationale**:

1. **Conceptual Unity**: Measurement is a type of drawing (distance line = measurement annotation)
2. **Shared State**: Both need feature management, selection, history
3. **API Consistency**: Single source of truth for all GIS operations
4. **Future-Proof**: 3D features naturally fit into unified store

**Migration Path**:

```typescript
// Phase 0: Create useGISStore
export const useGISStore = defineStore('gis', () => {
  // Unified state
  const activeTool = ref<string | null>(null)  // 'measure-distance' | 'draw-polygon' | 'select'
  const features = ref<Map<string, BaseGraphic>>(new Map())
  const selectedIds = ref<Set<string>>(new Set())
  const history = ref<HistoryEntry[]>([])

  // ... actions
})

// Phase 0.5: Backward compatibility wrapper
export const useMeasureStore = () => {
  const gisStore = useGISStore()
  return {
    activeTool: computed(() => gisStore.activeTool?.startsWith('measure') ? gisStore.activeTool : null),
    measurements: computed(() => Array.from(gisStore.features.values()).filter(f => f.type.includes('measure'))),
    // ... map other APIs
  }
}

// Phase 1: Update UI components to use useGISStore
// Phase 2: Remove useMeasureStore wrapper
```

---

### Decision 3: Coordinate Type System for 3D Support ✅

**Problem**: Current `Coordinate` type has optional `height?`, which doesn't enforce 3D data.

**Decision**: Create strict type hierarchy with 3D as default

```typescript
// New type system
export interface Coordinate3D {
  longitude: number
  latitude: number
  height: number  // ✅ Required
  heightReference: HeightReference
}

export enum HeightReference {
  CLAMP_TO_GROUND = 'CLAMP_TO_GROUND',
  RELATIVE_TO_GROUND = 'RELATIVE_TO_GROUND',
  ABSOLUTE = 'ABSOLUTE'
}

// Backward compatibility
export interface Coordinate2D {
  longitude: number
  latitude: number
}

export type Coordinate = Coordinate3D | Coordinate2D

// Type guard
export function is3D(coord: Coordinate): coord is Coordinate3D {
  return 'height' in coord && typeof coord.height === 'number'
}
```

**Rationale**:

1. **Type Safety**: Forces developers to consider height explicitly
2. **Future-Proof**: 3D features work out-of-box
3. **Backward Compatible**: 2D tools still work with `Coordinate2D`
4. **Clarity**: `heightReference` makes elevation mode explicit

---

### Decision 4: CallbackProperty for Dynamic Updates ✅

**Problem**: How to implement real-time preview during drawing?

**Decision**: Use Cesium's `CallbackProperty` pattern (proven by existing MeasureLayer)

**Rationale**:

1. **Proven**: Already works well in `MeasureLayer:308-316` for distance preview
2. **Performance**: Cesium's internal optimization handles updates efficiently
3. **Simplicity**: No manual entity refresh needed
4. **Consistency**: Same pattern as cesium-drawer and @cesium-extends/drawer

**Example Implementation**:

```typescript
// Real-time polygon preview (from cesium-drawer pattern)
const previewPolygon = viewer.entities.add({
  polygon: {
    hierarchy: new Cesium.CallbackProperty(() => {
      if (vertices.length < 3) return new Cesium.PolygonHierarchy([])
      const positions = [...vertices, currentCursorPosition].map(v =>
        Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, v.height || 0)
      )
      return new Cesium.PolygonHierarchy(positions)
    }, false)
  }
})
```

---

### Decision 5: Independent Polyline for Polygon Outline ✅

**Problem**: Cesium's `polygon.outlineWidth` only supports values ≤1 (WebGL limitation)

**Decision**: Use separate `Polyline` entity for polygon outlines (learned from cesium-draw)

**Rationale**:

1. **Visual Quality**: Can use `outlineWidth: 3` for better visibility
2. **Proven Pattern**: cesium-draw `public/cesium-draw/src/core/Graphic.js:415-430` uses this approach
3. **Flexibility**: Independent styling for fill vs stroke

**Implementation**:

```typescript
class PolygonGraphic extends BaseGraphic {
  private polygonEntity: Entity
  private outlineEntity: Entity  // Separate polyline

  create(positions: Cartesian3[]) {
    // Create polygon (fill only)
    this.polygonEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: fillColor,
        outline: false  // Disable built-in outline
      }
    })

    // Create outline as polyline
    const closedPositions = [...positions, positions[0]]  // Close the loop
    this.outlineEntity = viewer.entities.add({
      polyline: {
        positions: closedPositions,
        width: 3,  // ✅ Can use width > 1
        material: strokeColor
      }
    })
  }
}
```

---

### Decision 6: Performance Optimization Strategy ✅

**Problem**: Dynamic preview rendering was causing stuttering (< 30fps) during mouse movement

**Investigation**: During Phase 1 implementation, we discovered that the initial approach of recreating entities on every mouse move event caused severe performance degradation.

**Decision**: Implement CallbackProperty-based dynamic updates with smart rebuild strategy

**Key Optimizations Implemented** (2025-12-04, Commit: 83eda0b):

1. **CallbackProperty Pattern**: Replace static entity properties with dynamic callbacks
   - Entities created once, updated via Cesium's internal optimization
   - Eliminates ~180 entity create/destroy operations per second

2. **Smart Preview Rebuild**: Only recreate preview entities when necessary
   - Mouse moves: 0 entity operations (handled by CallbackProperty)
   - Vertex additions: Rebuild preview as needed

3. **Throttle Tuning**: Increased from 16ms → 50ms (~20fps sufficient for preview)

**Performance Gains**:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Entity operations | ~180/sec | 0/sec | ∞ |
| FPS | 20-30fps | 60fps | 2-3x |
| GC Pressure | High | Low | Significant |

**Detailed Documentation**: See [`docs/GIS_PERFORMANCE_OPTIMIZATION.md`](../../../docs/GIS_PERFORMANCE_OPTIMIZATION.md) for:
- Technical deep-dive into the problem diagnosis
- Complete CallbackProperty implementation patterns for all graphic types
- Testing methodology and performance metrics

---

## Architecture

### Class Hierarchy

> **Architecture Decision**: MeasureTool extends BaseTool directly (not DrawTool)
> - **Rationale**: Separation of concerns - measurement and drawing are different workflows
> - **Benefit**: MeasureTool is independent, simpler, and already implemented/tested
> - **Trade-off**: Some code duplication between MeasureTool and DrawTool (acceptable)

```
BaseTool (abstract)
├── MeasureTool (extends BaseTool)         ← Phase 0 完成，测量专用
│   ├── Distance measurement
│   └── Area measurement
├── DrawTool (extends BaseTool)            ← Phase 1 实现，绘制专用
│   ├── handles mouse events
│   ├── creates temporary preview entities
│   ├── emits completion events
│   └── Used by Point/Line/Polygon/Circle/Rectangle
├── SelectTool
└── ModifyTool

BaseGraphic (abstract)
├── id, name, type, style
├── abstract create()
├── abstract startEdit()
├── abstract toGeoJSON()
└── show(), hide(), remove()

Concrete Graphics:
├── PointGraphic extends BaseGraphic
├── LineGraphic extends BaseGraphic
├── PolygonGraphic extends BaseGraphic
│   └── uses independent Polyline for outline
├── CircleGraphic extends BaseGraphic
└── RectangleGraphic extends BaseGraphic
```

### Directory Structure

```
src/
├── cesium/gis/
│   ├── core/
│   │   ├── BaseTool.ts
│   │   ├── BaseGraphic.ts
│   │   ├── ToolManager.ts
│   │   └── StyleManager.ts
│   ├── graphics/
│   │   ├── PointGraphic.ts
│   │   ├── LineGraphic.ts
│   │   ├── PolygonGraphic.ts       ← uses cesium-drawer algorithm
│   │   ├── CircleGraphic.ts
│   │   └── RectangleGraphic.ts
│   ├── tools/
│   │   ├── DrawTool.ts
│   │   ├── SelectTool.ts
│   │   ├── ModifyTool.ts
│   │   ├── MeasureTool.ts
│   │   └── SnapHelper.ts
│   ├── utils/
│   │   ├── coordinate.ts            ← coordinate conversions
│   │   ├── geometry.ts              ← distance/area calculations
│   │   ├── volume.ts                ← 3D volume (from cesium_dev_kit)
│   │   └── spatial-index.ts         ← R-tree for snapping
│   └── vendor/                      ← extracted open-source code
│       ├── cesium-drawer/           ← polygon editing logic
│       │   ├── LICENSE (MIT)
│       │   └── PolygonDrawer.ts
│       └── cesium-extends/          ← basic shapes
│           ├── LICENSE (MIT)
│           └── BasicShapes.ts
├── stores/
│   └── gis.ts                       ← unified store (replaces measure.ts)
├── types/
│   ├── geometry.ts                  ← Coordinate3D, HeightReference
│   ├── draw.ts
│   └── feature.ts
└── components/
    ├── cesium/
    │   ├── GISLayer.vue             ← unified layer (replaces MeasureLayer)
    │   └── HeightModePanel.vue      ← 3D height mode switcher
    └── common/
        ├── DrawToolbar.vue
        ├── FeatureListPanel.vue
        ├── StylePanel.vue
        └── PropertiesPanel.vue
```

---

## Risks / Trade-offs

### Risk 1: Open Source License Compliance

**Risk**: Misusing MIT-licensed code without proper attribution

**Mitigation**:
- Create `vendor/` directory with clear LICENSE files
- Add copyright headers to extracted code:
  ```typescript
  /**
   * Polygon editing algorithm
   * Adapted from: cesium-drawer by hongfaqiu
   * License: MIT
   * Source: https://github.com/hongfaqiu/cesium-drawer
   */
  ```
- Maintain THIRD_PARTY_LICENSES.md listing all sources

**Trade-off**: More boilerplate, but legally safe

---

### Risk 2: Maintenance Burden of Extracted Code

**Risk**: If cesium-drawer fixes bugs, we need to manually sync

**Mitigation**:
- Document source commit hash in vendor code
- Set up quarterly review to check for upstream updates
- Only extract stable, well-tested code

**Trade-off**: Manual syncing effort vs full control

---

### Risk 3: 3D Performance with Large Datasets

**Risk**: 100+ 3D volumes might impact performance

**Mitigation**:
- Implement entity pooling
- Use Level-of-Detail (LOD) based on camera distance
- Add virtual scrolling for feature list (>100 items)
- Defer 3D volume rendering until Phase 2 performance testing

**Trade-off**: More complex rendering logic

---

### Risk 4: Breaking Changes to Existing Measurement Tools

**Risk**: Refactoring MeasureLayer might break existing functionality

**Mitigation**:
- **Phase 0.5**: Create backward-compatible wrapper (`useMeasureStore` → `useGISStore`)
- Write regression tests for distance/area measurement
- Gradual migration: keep MeasureLayer.vue working alongside new GISLayer.vue until full cutover

**Trade-off**: Temporary code duplication during migration

---

## Migration Plan

### Phase 0: Foundation (Week 1)

**Goal**: Establish core architecture without breaking existing features

**Tasks**:
1. Create `src/cesium/gis/` directory structure
2. Extract cesium-drawer code to `vendor/cesium-drawer/`
3. Implement `BaseTool` and `BaseGraphic` abstract classes
4. Create `useGISStore` with backward-compatible `useMeasureStore` wrapper
5. Write unit tests for coordinate type guards

**Success Criteria**:
- Existing MeasureLayer still works
- New architecture compiles without errors
- Type system passes strict mode

---

### Phase 1: 2D Drawing (Week 2)

**Goal**: Deliver point/line/polygon drawing with editing

**Tasks**:
1. Implement `PolygonGraphic` using cesium-drawer algorithm
2. Implement `PointGraphic` and `LineGraphic`
3. Create `DrawTool` class
4. Build `DrawToolbar` component
5. Integrate into TopRibbon

**Success Criteria**:
- Users can draw polygons with vertex editing
- Features appear in FeatureListPanel
- Style is customizable

---

### Phase 2: 3D Preparation (Week 3)

**Goal**: Enable 3D coordinate input without full 3D analysis

**Tasks**:
1. Create `HeightModePanel` component
2. Implement height input modes (Shift+Click = terrain, Ctrl+Click = custom)
3. Add `Coordinate3D` support to all graphics
4. Extract volume calculation algorithm from cesium_dev_kit (code only, not integrated)

**Success Criteria**:
- Users can specify heights when drawing
- Coordinates stored with elevation
- Volume calculation code extracted and unit-tested

---

### Phase 3+: Full 3D Analysis (Week 4-6, Future)

**Goal**: Implement water conservancy 3D tools

**Tasks**:
1. Integrate volume calculation UI
2. Implement flood simulation
3. Add terrain profile analysis
4. Build 3D measurement tools

**Success Criteria**:
- Reservoir volume calculation works
- Flood simulation displays correctly
- Profile charts generated from terrain

---

## Open Questions

### Q1: Should we preserve existing public/cesium-draw code?

**Current State**: `public/cesium-draw/` directory contains a Vue-based drawing tool (4.1.0)

**Options**:
- **A**: Delete it after migration (cleaner, but lose reference)
- **B**: Keep it for reference (duplicate code smell)
- **C**: Move to `docs/legacy/` (compromise)

**Recommendation**: **Option C** - Useful as reference during migration

**Answer**: Will decide in Phase 0 after analyzing its actual usage

---

### Q2: What precision for coordinate storage?

**Question**: How many decimal places for longitude/latitude?

**Context**:
- 6 decimals = ~0.11m precision
- 7 decimals = ~0.01m precision
- cesium-drawer uses configurable `accuracy` parameter

**Recommendation**: Default to **6 decimals**, make configurable

**Answer**: Will add `coordinatePrecision` to project config

---

### Q3: How to handle large GeoJSON imports (>1000 features)?

**Question**: Should we implement progressive loading?

**Options**:
- **A**: Load all at once (simple, but might freeze UI)
- **B**: Batch loading with progress bar
- **C**: Virtual scrolling + lazy entity creation

**Recommendation**: Start with **Option A**, optimize later if needed

**Answer**: Will monitor performance in Phase 1 testing

---

### Q4: Integration with backend persistence?

**Question**: Should features be saved to database?

**Current Scope**: Client-side only (localStorage)

**Future**: Likely need backend API for multi-user scenarios

**Answer**: Out of scope for initial implementation. Will create separate proposal when needed.

---

## References

### Open Source Projects
- [cesium-drawer](https://github.com/hongfaqiu/cesium-drawer) - Polygon editing algorithm
- [cesium_dev_kit](https://github.com/dengxiaoning/cesium_dev_kit) - 3D analysis algorithms
- [@cesium-extends/drawer](https://www.npmjs.com/package/@cesium-extends/drawer) - Basic shapes
- [Cesium-Examples-2](https://github.com/szch/Cesium-Examples-2) - Learning resource

### Technical Documentation
- [Cesium CallbackProperty](https://cesium.com/learn/cesiumjs/ref-doc/CallbackProperty.html)
- [OpenLayers Interaction Pattern](https://openlayers.org/en/latest/apidoc/module-ol_interaction_Interaction.html)

### Project Documents
- `openspec/changes/implement-gis-measure-tools/` - Existing measurement implementation
- `GIS_OPERATIONS_GUIDE.md` - 2D OpenLayers reference
- `docs/GIS_FEATURE_MIGRATION_PLAN.md` - 2D→3D migration strategies
- `docs/GIS_PERFORMANCE_OPTIMIZATION.md` - Dynamic preview performance optimization guide

---

## Appendix: License Attribution

### MIT Licensed Dependencies

```
MIT License - cesium-drawer
Copyright (c) hongfaqiu
Source: https://github.com/hongfaqiu/cesium-drawer

MIT License - cesium_dev_kit
Copyright (c) dengxiaoning
Source: https://github.com/dengxiaoning/cesium_dev_kit

MIT License - @cesium-extends/drawer
Source: https://www.npmjs.com/package/@cesium-extends/drawer
```

All extracted code will maintain original copyright notices as required by MIT license terms.
