import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Simulation from '@/views/Simulation.vue'
import Meteorology from '@/views/Meteorology.vue'
import DataGovernance from '@/views/DataGovernance.vue'
import DeviceManager from '@/views/DeviceManager.vue'
import AiEngineering from '@/views/AiEngineering.vue'
import GISTestPage from '@/views/GISTestPage.vue'
import TilesetTestPage from '@/views/TilesetTestPage.vue'
import { useAppStore } from '@/stores/app'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: Dashboard },
  { path: '/simulation', name: 'simulation', component: Simulation },
  { path: '/meteo', name: 'meteo', component: Meteorology },
  { path: '/data', name: 'data', component: DataGovernance },
  { path: '/device', name: 'device', component: DeviceManager },
  { path: '/ai', name: 'ai', component: AiEngineering },
  { path: '/gis-test', name: 'gis-test', component: GISTestPage },
  { path: '/tileset-test', name: 'tileset-test', component: TilesetTestPage },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const appStore = useAppStore()
  // Sync route to store
  if (to.name && typeof to.name === 'string') {
    appStore.setModule(to.name)
  }
})

export default router
