/**
 * IntroDom —— 开场 DOM 层
 *
 * 纯展示组件：Logo / 光束 / Tagline / ENTER / SKIP / 闪光。
 * 所有动画（透明度、位移、mask 扫描）都由 Intro.tsx 的 GSAP Timeline 控制，
 * 本组件不包含任何动画逻辑。
 *
 * 层级（z-index 由低到高）：
 *   .intro            —— 全屏容器（WebGL 之上、主页之下）
 *   .intro-beam       —— 第四幕横向扫描光束（混合模式 screen）
 *   .intro-flare      —— Finale 中心闪光（Lens Flare，DOM 实现）
 *   .intro-logo-wrap  —— HEESEUNG + 小鹿园（mask 跟随光束显现）
 *   .intro-tagline    —— Every star finds its light.
 *   .intro-enter      —— ENTER（hover 变亮 + 细线）
 *   .intro-skip       —— SKIP（低调的小字）
 */
import { forwardRef } from 'react'
import { SITE } from '../../lib/constants'

interface IntroDomProps {
  onEnter: () => void
  onSkip: () => void
}

export const IntroDom = forwardRef<HTMLDivElement, IntroDomProps>(function IntroDom(
  { onEnter, onSkip },
  ref,
) {
  return (
    <div className="intro" ref={ref} aria-label="开场动画">
      {/* 第四幕：银白光束（横向扫描） */}
      <div className="intro-beam" aria-hidden="true" />

      {/* Finale：中心镜头眩光（极弱） */}
      <div className="intro-flare" aria-hidden="true" />

      {/* Logo 层：mask 跟随光束逐字点亮 */}
      <div className="intro-logo-wrap" aria-hidden="true">
        <h1 className="intro-logo intro-logo--latin">{SITE.titleLatin}</h1>
        <p className="intro-logo intro-logo--han">{SITE.titleHan}</p>
      </div>

      {/* Tagline */}
      <p className="intro-tagline">{SITE.tagline}</p>

      {/* ENTER：不是按钮，只是文字 + hover 细线 */}
      <div
        className="intro-enter"
        role="button"
        tabIndex={0}
        aria-label="Enter the site"
        onClick={onEnter}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEnter()
          }
        }}
      >
        <span className="intro-enter-text">ENTER</span>
        <span className="intro-enter-line" aria-hidden="true" />
      </div>

      {/* SKIP：低调出现，随时可跳 */}
      <button className="intro-skip" type="button" onClick={onSkip} aria-label="Skip intro">
        SKIP
      </button>
    </div>
  )
})
