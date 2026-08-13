/**
 * CameraRig —— 电影摄影机 + 自定义轨道控制
 *
 * 交互（完整保留）：
 *  - 拖拽：旋转（azimuth / polar 球坐标）
 *  - 滚轮：缩放（radius）
 *  - 双击：平滑复位到默认机位
 *
 * 电影摄影机运动（叠加在交互之上）：
 *  - Camera Breathing：极慢呼吸（焦点距离微变）
 *  - Slow Dolly：缓慢推拉
 *  - Orbit：无人操作时极慢自动环绕
 *  - 微弱晃动：手持摄影机微抖
 *  - 自动构图：缓慢漂浮寻找构图
 *  - 缓慢推进：长周期推进
 *  - 轻微漂浮：宇宙漂浮感
 *
 * 实现：在 useFrame 中基于球坐标 (radius, theta, phi) 合成相机位置，
 * 交互修改目标值，电影运动修改偏置，二者叠加后 lerp 平滑。
 */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { introState } from './introState'

const DEFAULT = {
  radius: 12.0,
  theta: Math.PI * 0.5, // 方位角
  phi: Math.PI * 0.44, // 极角（略俯视森林）
}

export function CameraRig() {
  const { camera, gl } = useThree()

  const target = useRef({
    radius: DEFAULT.radius,
    theta: DEFAULT.theta,
    phi: DEFAULT.phi,
  })
  const current = useRef({
    radius: DEFAULT.radius,
    theta: DEFAULT.theta,
    phi: DEFAULT.phi,
  })
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const lastInteract = useRef(0)
  const resetReq = useRef(0)
  const shakeSeed = useRef(Math.random() * 1000)

  useEffect(() => {
    const dom = gl.domElement

    const onDown = (e: PointerEvent) => {
      dragging.current = true
      lastPointer.current = { x: e.clientX, y: e.clientY }
      lastInteract.current = performance.now()
    }
    const onUp = () => {
      dragging.current = false
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastPointer.current.x
      const dy = e.clientY - lastPointer.current.y
      lastPointer.current = { x: e.clientX, y: e.clientY }
      target.current.theta -= dx * 0.005
      target.current.phi = THREE.MathUtils.clamp(
        target.current.phi - dy * 0.005,
        0.12,
        Math.PI - 0.12,
      )
      lastInteract.current = performance.now()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(e.deltaY * 0.0012)
      target.current.radius = THREE.MathUtils.clamp(
        target.current.radius * factor,
        4.5,
        26,
      )
      lastInteract.current = performance.now()
    }
    const onDbl = () => {
      resetReq.current = performance.now()
    }

    dom.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointermove', onMove)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('dblclick', onDbl)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onMove)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('dblclick', onDbl)
    }
  }, [gl])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const now = performance.now()

    // 双击复位：在 ~1.2s 内插值回默认
    if (resetReq.current > 0) {
      const k = THREE.MathUtils.clamp((now - resetReq.current) / 1200, 0, 1)
      const e = 1 - Math.pow(1 - k, 3)
      target.current.radius += (DEFAULT.radius - target.current.radius) * e * 0.08
      target.current.theta += (DEFAULT.theta - target.current.theta) * e * 0.08
      target.current.phi += (DEFAULT.phi - target.current.phi) * e * 0.08
      if (k >= 1) resetReq.current = 0
    }

    // 鼠标/交互外部：极缓慢自动环绕（Orbit，几乎不可察觉的电影级环绕）
    const idle = now - lastInteract.current > 3000
    if (idle && !dragging.current) {
      target.current.theta += delta * 0.008
    }

    // 电影运动偏置（叠加在目标之上，不污染用户目标）
    // Camera Breathing：多层正弦叠加的极慢呼吸（焦点距离微变）
    const breathe =
      Math.sin(t * 0.21) * 0.28 +
      Math.sin(t * 0.47 + 1.3) * 0.1
    // Slow Dolly：长周期推拉（极慢，无规律的接近感）
    const dolly =
      Math.sin(t * 0.045) * 0.5 +
      Math.sin(t * 0.11 + 2.1) * 0.18
    // 自动构图/漂浮：theta/phi 缓慢游走（多层，非单调周期）
    const autoTheta =
      Math.sin(t * 0.028) * 0.1 +
      Math.sin(t * 0.061 + 1.7) * 0.04
    const autoPhi =
      Math.cos(t * 0.036) * 0.05 +
      Math.sin(t * 0.073 + 0.9) * 0.02

    const tRadius = target.current.radius + breathe + dolly
    const tTheta = target.current.theta + autoTheta
    const tPhi = THREE.MathUtils.clamp(target.current.phi + autoPhi, 0.12, Math.PI - 0.12)

    // 平滑跟随（更慢，减少"游戏感"的即时响应）
    const k = 1 - Math.pow(0.0022, delta)
    current.current.radius += (tRadius - current.current.radius) * k
    current.current.theta += (tTheta - current.current.theta) * k
    current.current.phi += (tPhi - current.current.phi) * k

    const { radius, theta, phi } = current.current
    const sinPhi = Math.sin(phi)
    const px = radius * sinPhi * Math.cos(theta)
    const py = radius * Math.cos(phi)
    const pz = radius * sinPhi * Math.sin(theta)

    // 微弱晃动（手持摄影机微抖，极小幅，多层叠加）
    const sh = shakeSeed.current
    const shakeX =
      Math.sin(t * 1.3 + sh) * 0.008 +
      Math.sin(t * 2.7 + sh) * 0.004 +
      Math.sin(t * 0.7 + sh * 2.0) * 0.005
    const shakeY =
      Math.cos(t * 1.1 + sh * 1.7) * 0.007 +
      Math.sin(t * 3.1 + sh) * 0.003 +
      Math.cos(t * 0.9 + sh) * 0.004

    camera.position.set(px + shakeX, py + shakeY, pz)

    // 轻微漂浮：注视点缓慢偏移（自动构图，追随核心）
    const lookX = Math.sin(t * 0.06) * 0.2 + Math.sin(t * 0.13 + 0.8) * 0.06
    const lookY = Math.cos(t * 0.08) * 0.14 + Math.sin(t * 0.17 + 1.9) * 0.04
    camera.lookAt(lookX, lookY, 0)

    // 同步给 introState（供银河核球过曝、PostFX 等读取）
    introState.cameraZ = radius
  })

  return null
}
