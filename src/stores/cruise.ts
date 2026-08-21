/**
 * 巡园漫游（手动自由驾驶）核心状态与逐帧驾驶逻辑。
 *
 * 纯前端、纯手动：点击顶栏「巡园漫游」锁定相机输入，进入第一人称无人机驾驶。
 * 鼠标拖拽旋转视野，键盘 W 前进 / S 下降 / Space 上升 / A/D 转向，全程可贴地飞行
 * ——离地高度下限取「相机脚下实时地形高程 + MIN_AGL」，而不是固定基准，因此可以
 * 一路降落到地表上方 2m 的低空。
 *
 * 逐帧驾驶用 viewer.clock.onTick 驱动。Cesium 1.144 为 requestRenderMode=true，
 * 每帧必须手动 viewer.scene.requestRender() 才会重绘。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCesiumStore } from '@/stores/cesium'
import { useOrchardStore } from '@/stores/orchard'
import { useLayerStore } from '@/stores/layers'

declare const Cesium: any

/** 果园 DEM 平均地表高程(椭球高)：脚下地形采样失败时的高度兜底 */
const GROUND_ELEV = 190
/** 贴地飞行离地高度下限(m)：相机始终高于脚下地形至少这么高，防扎进地表 */
const MIN_AGL = 2
/** 手动驾驶速度(m/s)、转向角速度(rad/s)、垂直速度(m/s) */
const MANUAL_SPEED = 45
const MANUAL_TURN = 0.9
const MANUAL_VERT = 18
/** 鼠标拖拽旋转视野灵敏度(rad/px) */
const MOUSE_LOOK_SPEED = 0.0035
/** 俯仰角钳制（±89°，避免绕垂直轴翻转） */
const MIN_PITCH = -Math.PI / 2 + 0.05
const MAX_PITCH = Math.PI / 2 - 0.05

export const useCruiseStore = defineStore('cruise', () => {
  const cesiumStore = useCesiumStore()
  const orchardStore = useOrchardStore()
  const layerStore = useLayerStore()

  const isCruising = ref(false)
  /** 当前相机高度(椭球高,m) 与 离地高度(m)，供控制条实时显示 */
  const altMsl = ref(0)
  const altAgl = ref(0)

  let origin: { lon: number; lat: number; height: number; heading: number; pitch: number } | null = null
  let removeTick: (() => void) | null = null
  let lastTickTime: any = null

  /** 手动驾驶按住键集合（物理键位 code，非响应式） */
  const heldKeys = new Set<string>()
  let keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  let keyUpHandler: ((e: KeyboardEvent) => void) | null = null
  let blurHandler: (() => void) | null = null
  // 鼠标拖拽旋转视野（挂到 viewer 画布上的 Pointer 事件）
  let pointerDownHandler: ((e: PointerEvent) => void) | null = null
  let pointerMoveHandler: ((e: PointerEvent) => void) | null = null
  let pointerUpHandler: ((e: PointerEvent) => void) | null = null
  let lookActive = false
  let lookLastX = 0
  let lookLastY = 0

  // ── 相机锁定（巡园期间禁止用户操作相机；enableInputs 为主开关） ──
  function lockCamera() {
    const viewer = cesiumStore.viewer
    if (!viewer) return
    viewer.scene.screenSpaceCameraController.enableInputs = false
    // 附带禁用右上角 Cesium 罗盘拖拽（其持独立 handler 会直接 setView 打断驾驶）
    viewer.container.classList.add('is-cruising')
  }
  function unlockCamera() {
    const viewer = cesiumStore.viewer
    if (!viewer) return
    viewer.scene.screenSpaceCameraController.enableInputs = true
    viewer.container.classList.remove('is-cruising')
  }

  /** 当前相机脚下的地表高程(椭球高)：优先取实时地形，失败回退 DEM 平均 */
  function groundHeightAt(carto: any): number {
    try {
      const g = cesiumStore.viewer?.scene.globe.getHeight(carto)
      if (typeof g === 'number' && isFinite(g)) return g
    } catch {}
    return GROUND_ELEV
  }

  /** 抓取当前相机状态为起点（退出时飞回） */
  function captureOrigin(): { lon: number; lat: number; height: number; heading: number; pitch: number } | null {
    const viewer = cesiumStore.viewer
    if (!viewer) return null
    try {
      const carto = viewer.camera.positionCartographic
      return {
        lon: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height,
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
      }
    } catch (e) {
      console.warn('[cruise] captureOrigin failed:', e)
      return null
    }
  }

  // ── 手动驾驶：键盘移动 ──
  function isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  function onManualKeyDown(e: KeyboardEvent) {
    if (isTyping(e)) return
    // 只拦截驾驶键，防止打字输入框里误触驾驶；Space 同时防止页面滚动
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
      e.preventDefault()
      heldKeys.add(e.code)
    }
  }
  function onManualKeyUp(e: KeyboardEvent) {
    heldKeys.delete(e.code)
  }
  function onManualBlur() {
    heldKeys.clear() // 窗口失焦时清空，避免"卡键"持续飞行
  }

  function addKeyListeners() {
    if (keyDownHandler) return
    keyDownHandler = onManualKeyDown
    keyUpHandler = onManualKeyUp
    blurHandler = onManualBlur
    window.addEventListener('keydown', keyDownHandler)
    window.addEventListener('keyup', keyUpHandler)
    window.addEventListener('blur', blurHandler)
  }
  function removeKeyListeners() {
    if (keyDownHandler) {
      window.removeEventListener('keydown', keyDownHandler)
      keyDownHandler = null
    }
    if (keyUpHandler) {
      window.removeEventListener('keyup', keyUpHandler)
      keyUpHandler = null
    }
    if (blurHandler) {
      window.removeEventListener('blur', blurHandler)
      blurHandler = null
    }
    heldKeys.clear()
  }

  /** 手动驾驶逐帧：按按住键推进相机（含鼠标已设定的视野朝向） */
  function applyManual(dt: number) {
    const viewer = cesiumStore.viewer
    if (!viewer) return
    const camera = viewer.camera

    // 无人机手柄式：W 前进、S 下降、Space 上升、A/D 转向（无后退，转向即可掉头）
    const fwd = heldKeys.has('KeyW') ? 1 : 0
    const turn = (heldKeys.has('KeyD') ? 1 : 0) - (heldKeys.has('KeyA') ? 1 : 0)
    const vert = (heldKeys.has('Space') ? 1 : 0) - (heldKeys.has('KeyS') ? 1 : 0)

    let heading = camera.heading
    let pitch = camera.pitch
    if (turn) heading += turn * MANUAL_TURN * dt

    let pos = Cesium.Cartesian3.clone(camera.position)
    if (fwd) {
      // 沿视线方向前进：鼠标抬低头（俯仰）后，W 就朝你看的方向飞，贴近真实机头
      const dir = camera.direction
      const delta = Cesium.Cartesian3.multiplyByScalar(dir, fwd * MANUAL_SPEED * dt, new Cesium.Cartesian3())
      pos = Cesium.Cartesian3.add(pos, delta, new Cesium.Cartesian3())
    }
    if (vert) {
      // 垂直升降沿本地竖直，不随俯仰偏折（径向≈椭球法线，园区尺度足够）
      const up = Cesium.Cartesian3.normalize(camera.position, new Cesium.Cartesian3())
      const delta = Cesium.Cartesian3.multiplyByScalar(up, vert * MANUAL_VERT * dt, new Cesium.Cartesian3())
      pos = Cesium.Cartesian3.add(pos, delta, new Cesium.Cartesian3())
    }

    const carto = Cesium.Cartographic.fromCartesian(pos)
    // 贴地钳制：下限 = 脚下地形高程 + MIN_AGL，而非固定基准；采样不到时回退 DEM 平均
    const groundH = groundHeightAt(carto)
    const height = Math.max(groundH + MIN_AGL, carto.height)
    camera.setView({
      destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height),
      orientation: { heading, pitch, roll: 0 },
    })
  }

  // ── 鼠标拖拽：原地旋转视野朝向（不移动位置） ──
  function onLookPointerDown(e: PointerEvent) {
    if (e.button !== 0) return // 仅左键拖拽
    const el = e.currentTarget as HTMLElement
    lookActive = true
    lookLastX = e.clientX
    lookLastY = e.clientY
    try {
      el.setPointerCapture(e.pointerId) // 拖出画布仍持续跟随
    } catch {}
    e.preventDefault()
  }
  function onLookPointerMove(e: PointerEvent) {
    if (!lookActive) return
    const viewer = cesiumStore.viewer
    if (!viewer) return
    const dx = e.clientX - lookLastX
    const dy = e.clientY - lookLastY
    lookLastX = e.clientX
    lookLastY = e.clientY
    if (dx === 0 && dy === 0) return
    // 右拖→右转(heading 增)，下拖→低头(pitch 减)；钳制俯仰防翻转
    const heading = viewer.camera.heading + dx * MOUSE_LOOK_SPEED
    const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, viewer.camera.pitch - dy * MOUSE_LOOK_SPEED))
    viewer.camera.setView({
      destination: viewer.camera.position,
      orientation: { heading, pitch, roll: 0 },
    })
    viewer.scene.requestRender()
    e.preventDefault()
  }
  function onLookPointerUp(e: PointerEvent) {
    if (!lookActive) return
    lookActive = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  function addLookListeners() {
    const canvas = cesiumStore.viewer?.scene.canvas as HTMLCanvasElement | undefined
    if (!canvas || pointerDownHandler) return
    pointerDownHandler = onLookPointerDown
    pointerMoveHandler = onLookPointerMove
    pointerUpHandler = onLookPointerUp
    canvas.addEventListener('pointerdown', pointerDownHandler)
    canvas.addEventListener('pointermove', pointerMoveHandler)
    canvas.addEventListener('pointerup', pointerUpHandler)
    canvas.addEventListener('pointercancel', pointerUpHandler)
  }
  function removeLookListeners() {
    const canvas = cesiumStore.viewer?.scene.canvas as HTMLCanvasElement | undefined
    if (canvas) {
      if (pointerDownHandler) canvas.removeEventListener('pointerdown', pointerDownHandler)
      if (pointerMoveHandler) canvas.removeEventListener('pointermove', pointerMoveHandler)
      if (pointerUpHandler) {
        canvas.removeEventListener('pointerup', pointerUpHandler)
        canvas.removeEventListener('pointercancel', pointerUpHandler)
      }
    }
    pointerDownHandler = null
    pointerMoveHandler = null
    pointerUpHandler = null
    lookActive = false
  }

  function tickHandler(_clock: any, time: any) {
    if (!isCruising.value) return
    const viewer = cesiumStore.viewer
    if (!viewer) return
    // 手动算帧差：requestRenderMode 下空闲期 clock 不 tick，
    // 用 clock.deltaTime 会把"距上次渲染"的整段时间算进来导致瞬移，故自己掐秒并钳制
    const now = time ?? viewer.clock.currentTime
    let dt = lastTickTime ? Cesium.JulianDate.secondsDifference(now, lastTickTime) : 0
    dt = Math.max(0, Math.min(0.1, dt)) // 后台切回防瞬移
    lastTickTime = Cesium.JulianDate.clone(now)

    applyManual(dt)
    // 实时更新高度显示（离地 = 相机高 - 脚下地形高）
    try {
      const carto = viewer.camera.positionCartographic
      altMsl.value = carto.height
      altAgl.value = Math.max(0, carto.height - groundHeightAt(carto))
    } catch {}
    viewer.scene.requestRender()
  }

  function finish() {
    if (!isCruising.value) return
    if (removeTick) {
      removeTick()
      removeTick = null
    }
    removeKeyListeners()
    removeLookListeners()
    unlockCamera()
    const viewer = cesiumStore.viewer
    if (viewer) viewer.clock.shouldAnimate = true
    isCruising.value = false
  }

  function start() {
    const viewer = cesiumStore.viewer
    if (!viewer) {
      ElMessage.warning('三维场景尚未就绪')
      return
    }
    if (isCruising.value) return
    if (cesiumStore.is2D) {
      ElMessage.warning('二维视图下无法巡园，请先切回三维视图')
      return
    }

    origin = captureOrigin()
    if (!origin) {
      ElMessage.warning('无法获取当前相机位置')
      return
    }

    // 收拢面板，露出完整三维场景
    orchardStore.closeAllPanels()
    orchardStore.showChartDialog = false
    layerStore.showManager = false

    isCruising.value = true
    heldKeys.clear()
    altMsl.value = 0
    altAgl.value = 0
    lastTickTime = Cesium.JulianDate.clone(viewer.clock.currentTime)

    lockCamera()
    // 释放焦点，避免 Space 误触"刚点过的按钮"
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    addKeyListeners()
    addLookListeners()
    viewer.clock.shouldAnimate = true
    removeTick = viewer.clock.onTick.addEventListener(tickHandler)
    viewer.scene.requestRender()
    ElMessage.success('巡园漫游已启动 · 鼠标拖拽看方向 · W 前进 · S 下降 · Space 上升 · A/D 转向')
  }

  function toggle() {
    if (isCruising.value) stop()
    else start()
  }

  /** 立即结束巡航（不飞回，用于组件卸载/页面销毁时的清理） */
  function exit() {
    if (!isCruising.value) return
    finish()
  }

  /** 退出巡航并飞回启动视角 */
  function stop() {
    if (!isCruising.value) return
    finish()
    const o = origin
    if (o && cesiumStore.viewer) {
      try {
        cesiumStore.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(o.lon, o.lat, o.height),
          orientation: { heading: o.heading, pitch: o.pitch, roll: 0 },
          duration: 1.2,
        })
      } catch (e) {
        console.warn('[cruise] fly back failed:', e)
      }
    }
    ElMessage.info('已退出巡园漫游')
  }

  return {
    isCruising,
    altMsl,
    altAgl,
    toggle,
    start,
    stop,
    exit,
  }
})
