import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAppStore } from '@/stores/app'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/orchard-dashboard' },
  {
    path: '/orchard-dashboard',
    name: 'orchard-dashboard',
    component: () => import('@/views/OrchardDashboard.vue'),
  },
  {
    path: '/canopy-analysis',
    name: 'canopy-analysis',
    component: () => import('@/views/CanopyAnalysis.vue'),
  },
  {
    path: '/agri-decision',
    name: 'agri-decision',
    component: () => import('@/views/AgriDecision.vue'),
  },
  {
    path: '/data-management',
    name: 'data-management',
    component: () => import('@/views/DataManagement.vue'),
  },
  // 保留旧路由兼容
  {
    path: '/dashboard',
    redirect: '/orchard-dashboard',
  },
  {
    path: '/simulation',
    name: 'simulation',
    component: () => import('@/views/Simulation.vue'),
  },
  {
    path: '/meteo',
    name: 'meteo',
    component: () => import('@/views/Meteorology.vue'),
  },
  {
    path: '/data',
    name: 'data',
    component: () => import('@/views/DataGovernance.vue'),
  },
  {
    path: '/device',
    name: 'device',
    component: () => import('@/views/DeviceManager.vue'),
  },
  {
    path: '/ai',
    name: 'ai',
    component: () => import('@/views/AiEngineering.vue'),
  },
  {
    path: '/gis-test',
    name: 'gis-test',
    component: () => import('@/views/GISTestPage.vue'),
  },
  {
    path: '/tileset-test',
    name: 'tileset-test',
    component: () => import('@/views/TilesetTestPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const appStore = useAppStore()
  if (to.name && typeof to.name === 'string') {
    appStore.setModule(to.name)
  }
})

export default router
