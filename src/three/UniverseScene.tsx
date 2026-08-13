/**
 * UniverseScene —— Three.js 场景容器（月光森林）
 *
 * 职责：
 *  - 挂载 Canvas（WebGL2），统一管理 DPR（按性能档位 clamp）
 *  - 相机控制：CameraRig（电影摄影机 + 自定义轨道交互：拖拽旋转 / 滚轮缩放 / 双击复位）
 *  - 月光森林层级：
 *      Forest（月光光晕 / 萤火虫 / 飘叶 / 薄雾）
 *      LogoParticles（Finale 解体，保留）
 *  - 电影后处理：PostFX（ACES/Bloom/DOF/CA/Vignette/LensDirt/Flare/Grain/MBlur）
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig'
import { Forest } from './Forest'
import { PostFX } from './PostFX'
import { introState } from './introState'
import type { DeviceCapability } from '../lib/quality'

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

  // 后台标签页 / 隐藏 iframe 加载时，R3F 的 ResizeObserver 不触发，
  // Canvas 永不初始化。策略：立即检查 + 500ms 轮询 + visibilitychange 复查。
  useEffect(() => {
    const tryInit = (): boolean => {
      const canvas = rootRef.current?.querySelector('canvas')
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
        onCreated={({ gl }) => {
          gl.debug.onShaderError = (gl2, program, vs, fs) => {
            const vlog = gl2.getShaderInfoLog(vs) || ''
            const flog = gl2.getShaderInfoLog(fs) || ''
            const plog = gl2.getProgramInfoLog(program) || ''
            console.error('[SHADER ERROR]\n--- vertex ---\n', vlog, '\n--- fragment ---\n', flog, '\n--- program ---\n', plog)
          }
        }}
        dpr={capability.dprCap}
        camera={{ fov: 50, near: 0.1, far: 80, position: [0, 0, initialZ] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#0e1712']} />
          <CameraRig />
          <Forest />
          <PostFX capability={capability} />
        </Suspense>
      </Canvas>
    </div>
  )
}
