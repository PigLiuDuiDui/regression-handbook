/**
 * PostFX —— 电影后处理编排
 *
 * 渲染链（顺序即视觉叠加）：
 *   Scene
 *     ── Bloom（HDR 亮星/核球辉光，mipmapBlur 高质量）
 *     ── DepthOfField（浅景深，电影感；高/中档开启）
 *     ── MotionSmearEffect（径向运动模糊，Finale 急推时 GSAP 驱动）
 *     ── CinematicGradeEffect（ACES + Exposure + BlackLevel + HiRollOff
 *          + ColorGrade + ChromaticAberration + Vignette + LensDirt + LensFlare）
 *     ── FilmGrainEffect（胶片颗粒）
 *     ── Screen
 *
 * 全部 filmic，参考 Interstellar / NASA / BBC 宇宙纪录片。
 * ?nofx=1 可禁用整个链（诊断 / 极端低端设备）。
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Vignette,
} from '@react-three/postprocessing'
import { introState } from './introState'
import { CinematicGradeEffect, FilmGrainEffect, MotionSmearEffect } from './effects'
import type { DeviceCapability } from '../lib/quality'
import { GRADE } from '../lib/constants'

function postFxDisabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('nofx') === '1'
  } catch {
    return false
  }
}

interface PostFXProps {
  capability: DeviceCapability
}

export function PostFX({ capability }: PostFXProps) {
  const customEffects = useMemo(
    () => ({
      grade: new CinematicGradeEffect({
        exposure: GRADE.exposure,
        blackLevel: GRADE.blackLevel,
        hiRoll: GRADE.highlightRollOff,
        saturation: GRADE.saturation,
        shadowsTint: GRADE.shadowsTint,
        highlightsTint: GRADE.highlightsTint,
        ca: 0.0018,
        vignette: 0.22,
        dirt: 0.03,
        flare: 0.3,
      }),
      grain: new FilmGrainEffect({ intensity: 0.035, blendFunction: undefined }),
      smear: new MotionSmearEffect(),
    }),
    [],
  )

  useFrame(() => {
    customEffects.smear.uniforms.get('uIntensity')!.value = introState.motionBlur
    // 进入主页后适度提升镜头污渍/炫光电影质感
    customEffects.grade.uniforms.get('uFlare')!.value = 0.4 + introState.flare * 0.4
  })

  if (postFxDisabled()) return null

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.85}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.85}
      />
      {capability.dof ? (
        <DepthOfField focusDistance={0.012} focalLength={0.05} bokehScale={2.4} />
      ) : (
        <></>
      )}
      <primitive object={customEffects.smear} dispose={null} />
      <primitive object={customEffects.grade} dispose={null} />
      <primitive object={customEffects.grain} dispose={null} />
      <Vignette offset={0.35} darkness={0.25} />
    </EffectComposer>
  )
}
