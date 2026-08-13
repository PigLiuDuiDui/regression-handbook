/**
* App —— 应用根组件
*
* 开场动画已移除：始终直接呈现主页，星空以"银河模式"初始化。
*
* 渲染结构（z 从下到上）：
*   1. UniverseScene（WebGL 星空）
*   2. Nav + Home / 各子页面（主页内容层，Lenis 平滑滚动）
*/
import { useCallback, useEffect, useRef, useState } from 'react'
import { UniverseScene } from './three/UniverseScene'
import { Home } from './components/Home'
import { About } from './components/About'
import { PhotoArchive } from './components/PhotoArchive'
import { VideoCinema } from './components/VideoCinema'
import { Schedule } from './components/Schedule'
import { SupportProject } from './components/SupportProject'
import { Community } from './components/Community'
import { Nav } from './components/Nav'
import { StarfieldFallback } from './components/StarfieldFallback'
import { useDeviceCapability } from './hooks/useDeviceCapability'
import { useLenis } from './hooks/useLenis'
import { introState } from './three/introState'
import { INTRO_CONFIG } from './config/intro.config'
import type { PageId } from './lib/nav'
import type { DeviceCapability } from './lib/quality'

/** 解析 hash 路由（#/photo → photo），无匹配时回退 home */
function parseHash(): PageId {
  try {
    const h = window.location.hash.replace(/^#\/?/, '')
    const valid: PageId[] = ['home', 'about', 'photo', 'video', 'schedule', 'support', 'community']
    return (valid.includes(h as PageId) ? h : 'home') as PageId
  } catch {
    return 'home'
  }
}

/** 主页初始态：让星空以“银河模式”开始，避免显示空荡的过渡帧。 */
function initHomeIntroState() {
  introState.reveal = 1
  introState.nebula = 1
  introState.antlerProgress = 0
  introState.cameraZ = INTRO_CONFIG.home.cameraZ
  introState.bulgeBoost = 1
}

export default function App() {
  const capability = useDeviceCapability()
  // 开场动画已移除：永远以主页态初始化，不再播放 Intro。
  const [page, setPage] = useState<PageId>(() => parseHash())

  // 主页可滚动（phase 固定为 home，故 useLenis 总是在启用态）
  useLenis(false)

  /* ---------------- hash 路由监听 ---------------- */
  useEffect(() => {
    const onHash = () => setPage(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  /* ---------------- 页面导航 ---------------- */
  const navigate = useCallback((id: PageId) => {
    window.location.hash = `/${id}`
    setPage(id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  /* ---------------- 已移除开场动画：直接在挂载时初始化星空为银河模式 ---------------- */
  useEffect(() => {
    initHomeIntroState()
  }, [])

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

      {/* 主页内容层（开场动画已移除：始终挂载） */}
      <Nav current={page} onNavigate={navigate} />
      {renderPage(page)}

      {/* 诊断面板：仅 ?diag=1 时显示（平时完全不可见） */}
      <Diag capability={capability} />
    </div>
  )
}

/** 按当前页面渲染对应内容 */
function renderPage(page: PageId) {
  switch (page) {
    case 'about':
      return <About />
    case 'photo':
      return <PhotoArchive />
    case 'video':
      return <VideoCinema />
    case 'schedule':
      return <Schedule />
    case 'support':
      return <SupportProject />
    case 'community':
      return <Community />
    case 'home':
    default:
      return <Home />
  }
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
