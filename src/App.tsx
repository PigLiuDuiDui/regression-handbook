/**
 * App —— 应用根组件
 *
 * 状态机：
 *   phase = 'intro' | 'home'
 *
 * 首次访问（无 localStorage 记录）→ 播放 Intro；
 * 刷新（已有记录）→ 直接进入主页，星空以"银河模式"初始化。
 *
 * 渲染结构（z 从下到上）：
 *   1. UniverseScene（WebGL 星空 —— Intro 与主页共享，实现无缝粒子过渡）
 *   2. Home（主页内容层，Lenis 平滑滚动）
 *   3. Intro（开场 DOM 层，仅首次播放时挂载）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { UniverseScene } from './three/UniverseScene'
import { Intro } from './components/intro/Intro'
import { Home } from './components/Home'
import { StarfieldFallback } from './components/StarfieldFallback'
import { useDeviceCapability } from './hooks/useDeviceCapability'
import { useLenis } from './hooks/useLenis'
import { introState } from './three/introState'
import { INTRO_CONFIG } from './config/intro.config'
import { SITE } from './lib/constants'
import type { DeviceCapability } from './lib/quality'

type Phase = 'intro' | 'home'

/** 读取 localStorage（异常时按未播放处理） */
function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SITE.storageKey) === '1'
  } catch {
    return false
  }
}

function markIntroSeen() {
  try {
    localStorage.setItem(SITE.storageKey, '1')
  } catch {
    // 隐私模式等场景下静默失败
  }
}

export default function App() {
  const capability = useDeviceCapability()
  // 用户偏好减少动态效果时直接跳过开场动画
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(() =>
    hasSeenIntro() || reduceMotion ? 'home' : 'intro',
  )

  // intro 播放期间锁定滚动；主页可滚动
  useLenis(phase === 'intro')

  /* ---------------- Intro 完成 → 主页 ---------------- */
  const handleIntroComplete = useCallback(() => {
    markIntroSeen()

    // 星空状态复位到"银河模式"：
    // 解体粒子平滑归位、相机从穿越深处拉回全景（GSAP 过渡，非瞬移）
    gsap.to(introState, {
      dissolve: 0,
      cameraZ: INTRO_CONFIG.home.cameraZ,
      cameraY: 0,
      duration: 1.6,
      ease: 'power2.inOut',
      onStart: () => {
        introState.motionBlur = 0
      },
    })

    setPhase('home')
    // 滚动归零，从 Hero 开始
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  /* ---------------- 已看过 Intro 的用户：直接以主页态初始化星空 ---------------- */
  useEffect(() => {
    if (phase === 'home') {
      introState.reveal = 1
      introState.nebula = 1
      introState.antlerProgress = 0
      introState.cameraZ = INTRO_CONFIG.home.cameraZ
    }
  }, [phase])

  return (
    <div className="app">
      {/* WebGL 星空（WebGL2 不可用时降级为 CSS 星空） */}
      {capability.webgl2 ? (
        <UniverseScene capability={capability} />
      ) : (
        <StarfieldFallback />
      )}

      {/* 电影质感层：胶片颗粒 + 暗角（始终存在） */}
      <div className="grain-overlay" aria-hidden="true" />
      <div className="vignette-overlay" aria-hidden="true" />

      {/* 主页内容层（粒子过渡完成后显现） */}
      {phase === 'home' && <Home />}

      {/* 开场动画层（仅首次访问） */}
      {phase === 'intro' && <Intro onComplete={handleIntroComplete} />}

      {/* 诊断面板：仅 ?diag=1 时显示（平时完全不可见） */}
      <Diag capability={capability} />
    </div>
  )
}

/**
 * 诊断面板（?diag=1 时显示）：实时输出粒子渲染链的关键状态，
 * 用于定位"粒子不显示"问题时快速判断 uniform 同步 / canvas 尺寸是否正常。
 */
function Diag({ capability }: { capability: DeviceCapability }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = ref.current
      if (el) {
        const canvas = document.querySelector('canvas')
        el.textContent = [
          `tier:${capability.tier} count:${capability.particleCount}`,
          `reveal:${introState.reveal.toFixed(2)} nebula:${introState.nebula.toFixed(2)}`,
          `antler:${introState.antlerProgress.toFixed(2)} camZ:${introState.cameraZ.toFixed(2)}`,
          `canvas:${canvas ? `${canvas.width}x${canvas.height}` : 'none'}`,
        ].join('  | ')
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [capability])

  // 仅在 ?diag=1 时挂载（平时零成本）
  const [enabled] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('diag') === '1'
    } catch {
      return false
    }
  })
  if (!enabled) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 9999,
        color: '#9fd8a8',
        font: '11px/1.5 ui-monospace, monospace',
        background: 'rgba(0,0,0,.75)',
        padding: '4px 8px',
        borderRadius: 4,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    />
  )
}
