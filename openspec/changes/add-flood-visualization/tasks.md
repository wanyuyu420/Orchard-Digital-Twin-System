# Tasks: Add Flood Visualization

## Phase 1: Database & Backend API ✅

- [x] **T1.1** Create `backend/app/models/flood.py` with FloodScenario and FloodFrame models
- [x] **T1.2** Create `backend/app/schemas/flood.py` for Pydantic schemas
- [x] **T1.3** Create `backend/app/api/v1/flood.py` with API endpoints
  - GET /flood/scenarios - list scenarios
  - GET /flood/scenarios/{id} - get scenario with frames
  - GET /flood/scenarios/{id}/frame?progress=X - interpolated frame
- [x] **T1.4** Alembic migration `3d5b20b9361d_add_flood_scenarios`
- [x] **T1.5** Create `backend/scripts/seed_flood_data.py` with 2 scenarios

## Phase 2: Frontend Cesium Integration ✅

- [x] **T2.1** Create `src/components/cesium/FloodLayer.vue`
  - Watch `simulationStore.state.progress`
  - Manage Cesium polygon entities lifecycle
- [x] **T2.2** Create API client for flood scenarios
- [x] **T2.3** Implement water surface rendering with color gradient
- [x] **T2.4** Connect to TimelineControl for animation

## Phase 3: Visual Polish

- [ ] **T3.1** Add water surface animation effect (opacity pulsing)
- [ ] **T3.2** Add flood boundary outline (neon cyan)

## Phase 4: Integration

- [ ] **T4.1** Mount FloodLayer in Simulation.vue (conditional on engine type)
- [ ] **T4.2** Sync with SimResult display

## Dependencies
- T2.* depends on T1.*
- T3.* depends on T2.*
- T4.* depends on T3.*
