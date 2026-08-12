/**
 * UniverseScene —— Three.js 场景容器
 *
 * 职责：
 *  - 挂载 Canvas（WebGL2 优先），统一管理 DPR（按性能档位 clamp）
 *  - 相机控制：GSAP 驱动的 dolly（introState.cameraZ）+ 呼吸感 + 鼠标视差
 *  - 指针状态维护：屏幕坐标 → z=0 平面世界坐标（供粒子吸引）
 *  - 组合 Starfield（银河）与 LogoParticles（解体）
 *
 * 鼠标对星空的影响是"轻微"的：
 *  - 相机视差 ≤ 0.35 世界单位（平滑跟随）
 *  - 粒子吸引仅在指针附近小半径内，位移 ≤ 0.14
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Starfield } from './Starfield'
import { LogoParticles } from './LogoParticles'
import { PostFX } from './PostFX'
import { introState, pointerState } from './introState'
import { INTRO_CONFIG } from '../config/intro.config'
import type { DeviceCapability } from '../lib/quality'

/* ------------------------------------------------------------------ */
/* 相机 Rig：dolly + 呼吸 + 视差                                        */
/* ------------------------------------------------------------------ */

function CameraRig() {
  const { camera } = useThree()

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // 1) GSAP 驱动的 dolly 基础位置
    const baseZ = introState.cameraZ
    // 2) 呼吸感：第一幕最明显，随推进逐渐减弱
    const breathe =
      Math.sin(t * INTRO_CONFIG.act1.breatheFrequency) * INTRO_CONFIG.act1.breatheAmplitude

    // 3) 鼠标视差（轻微，平滑 lerp）+ finale 下落偏移（cameraY 作为目标的一部分，lerp 平滑，不累加）
    const targetX = pointerState.smooth.x * INTRO_CONFIG.mouse.cameraParallax
    const targetY =
      pointerState.smooth.y * INTRO_CONFIG.mouse.cameraParallax * 0.55 + introState.cameraY
    const k = 1 - Math.pow(1 - INTRO_CONFIG.mouse.smooth, delta * 60)
    camera.position.x += (targetX - camera.position.x) * k
    camera.position.y += (targetY - camera.position.y) * k

    camera.position.z = baseZ + breathe
    camera.lookAt(0, 0, 0)
  })

  return null
}

/* ------------------------------------------------------------------ */
/* 指针状态：NDC → 世界坐标（z=0 平面投影）                              */
/* ------------------------------------------------------------------ */

function PointerTracker() {
  const { camera, size } = useThree()
  const ray = useRef(new THREE.Raycaster())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  const ndc = useRef(new THREE.Vector2())

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      ndc.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      )
      ray.current.setFromCamera(ndc.current, camera)
      const hit = new THREE.Vector3()
      ray.current.ray.intersectPlane(plane.current, hit)
      pointerState.world.set(hit.x, hit.y)
      pointerState.active = true
    }
    const onPointerLeave = () => {
      pointerState.active = false
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [camera])

  // 视口尺寸变化时同步（keep: 尺寸用于无指针时的默认状态）
  void size
  return null
}

/* ------------------------------------------------------------------ */
/* 场景                                                                */
/* ------------------------------------------------------------------ */

interface UniverseSceneProps {
  capability: DeviceCapability
}

export function UniverseScene({ capability }: UniverseSceneProps) {
  const initialZ = introState.cameraZ
  const rootRef = useRef<HTMLDivElement>(null)
  const [mountKey, setMountKey] = useState(0)

  // 防御：后台标签页 / 隐藏 iframe 加载时，R3F 的 ResizeObserver 不触发，
  // Canvas 永不初始化（裸 canvas 保持出厂 300x150，渲染循环未启动 → 画面全黑）。
  // 策略：立即检查 + 500ms 轮询（≤5 次）+ visibilitychange 时复查；
  // 发现未初始化则派发 resize 事件（react-use-measure 监听 window resize 兜底）并重挂载。
  useEffect(() => {
    const tryInit = (): boolean => {
      const canvas = rootRef.current?.querySelector('canvas')
      // 未初始化的裸 canvas 是 300x150；被渲染器接管后是真实视口尺寸
      if (canvas && canvas.width > 320) return true
      window.dispatchEvent(new Event('resize'))
      setMountKey((k) => k + 1)
      return false
    }

    tryInit()
    let tries = 1
    const timer = window.setInterval(() => {
      tries += 1
      if (tries > 5 || tryInit()) window.clearInterval(timer)
    }, 500)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryInit()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className="universe" ref={rootRef} aria-hidden="true">
      <Canvas
        key={mountKey}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          alpha: false,
          stencil: false,
          depth: true,
        }}
        dpr={capability.dprCap}
        camera={{ fov: 55, near: 0.1, far: 60, position: [0, 0, initialZ] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <CameraRig />
          <PointerTracker />
          <Starfield count={capability.particleCount} />
          <LogoParticles />
          <PostFX />
        </Suspense>
      </Canvas>
    </div>
  )
}
