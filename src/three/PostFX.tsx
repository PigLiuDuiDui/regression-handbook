/**
 * PostFX —— 后期效果编排
 *
 * 渲染链（顺序即视觉叠加顺序）：
 *   Scene ── MotionSmearEffect（径向运动模糊，Finale 时 GSAP 驱动）
 *        ── FilmGrainEffect（胶片颗粒）
 *        ── Vignette（暗角）
 *        ── Screen
 *
 * 注意：Bloom（浮点缓冲）与 ChromaticAberration 曾导致部分 GPU/驱动输出黑屏，
 * 已暂时移除 —— 粒子可见性优先，确认稳定后再逐个恢复并回归验证。
 * 诊断开关：?nofx=1 禁用整个后处理链（场景直出）。
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Vignette } from '@react-three/postprocessing'
import { introState } from './introState'
import { FilmGrainEffect, MotionSmearEffect } from './effects'

/**
 * 诊断开关：?nofx=1 时禁用整个后处理链
 * （用于定位"黑屏"是来自后处理还是场景本身；也可作为极端低端设备的手动降级）
 */
function postFxDisabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('nofx') === '1'
  } catch {
    return false
  }
}

export function PostFX() {
  // 自定义效果实例（primitive 挂载）
  const customEffects = useMemo(
    () => ({
      grain: new FilmGrainEffect({ intensity: 0.05 }),
      smear: new MotionSmearEffect(),
    }),
    [],
  )

  // 每帧：径向运动模糊强度（Finale 急推时 GSAP 驱动）
  useFrame(() => {
    customEffects.smear.uniforms.get('uIntensity')!.value = introState.motionBlur
  })

  // 诊断开关：后处理禁用时场景直出（hooks 已全部执行，条件 return 安全）
  if (postFxDisabled()) {
    return null
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <primitive object={customEffects.smear} dispose={null} />
      <primitive object={customEffects.grain} dispose={null} />
      <Vignette offset={0.22} darkness={0.7} />
    </EffectComposer>
  )
}
