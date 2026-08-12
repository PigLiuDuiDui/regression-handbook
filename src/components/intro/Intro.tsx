/**
 * Intro —— 开场动画总编排（GSAP Timeline 驱动）
 *
 * 架构：
 *   - 所有动画（DOM 元素 + WebGL uniform）都在同一条 GSAP Timeline 上，
 *     没有 setTimeout，任何时刻都可以被跳过 / 暂停 / 倍速。
 *   - WebGL 侧通过 introState 纯对象通信：Timeline tween introState，
 *     Starfield / PostFX / CameraRig 在 useFrame 中读取。
 *   - 六幕时间线（见 config/intro.config.ts）：
 *       ACT I    黑场 · 导星独奏（呼吸 / 胶片颗粒）
 *       ACT II   镜头推进 · 银河生成（uReveal）
 *       ACT III  鹿角聚集（点→线→面→轮廓）→ 化成星光（uAntlerProgress + uFlash）
 *       ACT IV   光束扫描 · Logo 显现（mask 联动）
 *       ACT V    星云浮现 · Tagline 淡入
 *       ACT VI   ENTER 出现 · 粒子吸引开启
 *       FINALE   点击 ENTER：Logo 解体 → 粒子飞散 → 镜头急推 → 主页
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { IntroDom } from './IntroDom'
import { introState, pointerState } from '../../three/introState'
import { INTRO_CONFIG } from '../../config/intro.config'
import { loadCriticalFonts } from '../../lib/fonts'

interface IntroProps {
  /** 粒子过渡完成，允许进入主页 */
  onComplete: () => void
}

export function Intro({ onComplete }: IntroProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mainTimeline = useRef<gsap.core.Timeline | null>(null)
  const finaleTimeline = useRef<gsap.core.Timeline | null>(null)
  const entered = useRef(false)
  const [ready, setReady] = useState(false)

  /* ---------------------------------------------------------------- */
  /* 主时间线：六幕                                                   */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let disposed = false

    // 先确保字体就绪（Logo 显现前必须完成）
    loadCriticalFonts().then(() => {
      if (disposed) return
      buildMainTimeline()
    })

    function buildMainTimeline() {
      const root = rootRef.current
      if (!root) return

      const cfg = INTRO_CONFIG
      const q = gsap.utils.selector(root)
      const logoWrap = q('.intro-logo-wrap')[0] as HTMLElement
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
      mainTimeline.current = tl

      /* ---- ACT I：黑场 · 导星独奏（0 ~ 1s） ---- */
      tl.to(introState, { loneStar: 1, duration: 0.7, ease: 'sine.out' }, cfg.act1.start)

      /* ---- ACT II：镜头推进 · 银河生成（1 ~ 3s） ---- */
      tl.to(introState, { cameraZ: cfg.act2.cameraMidZ, duration: 2.0, ease: 'power1.inOut' }, cfg.act2.start)
      tl.to(introState, { reveal: 1, duration: 1.7, ease: 'power1.in' }, cfg.act2.start + 0.25)
      tl.to(introState, { loneStar: 0, duration: 0.35, ease: 'sine.inOut' }, cfg.act2.start + 0.3)
      // SKIP 低调出现
      tl.to(q('.intro-skip'), { opacity: 1, duration: 0.5, ease: 'sine.out' }, cfg.skip.appearAt)

      /* ---- ACT III：鹿角聚集（3 ~ 4.6s）----
       * 点（缓）→ 线（加速）→ 轮廓（快而平滑）
       * 每个粒子还带有随机延迟（shader 内 smoothstep），
       * 两种节奏叠加产生"星尘逐渐凝固"的层次感。
       */
      tl.to(
        introState,
        { antlerProgress: cfg.act3.gatherPoint, duration: 0.8, ease: 'power1.in' },
        cfg.act3.start,
      )
      tl.to(
        introState,
        { antlerProgress: cfg.act3.gatherLine, duration: 0.55, ease: 'power2.in' },
        '-=0.12',
      )
      tl.to(
        introState,
        { antlerProgress: cfg.act3.gatherContour, duration: 0.42, ease: 'power3.inOut' },
        '-=0.08',
      )
      // 轮廓成型后短暂静默
      tl.to({}, { duration: cfg.act3.hold }, '>')

      // 化成星光：亮度脉冲 + 鹿角散回银河
      tl.to(introState, { flash: 1, duration: 0.16, ease: 'sine.in' }, '+=0.02')
      tl.to(introState, { flash: 0, duration: 0.45, ease: 'sine.out' }, '+=0.06')
      tl.to(introState, { antlerProgress: 0, duration: 0.6, ease: 'power2.inOut' }, '-=0.25')

      /* ---- ACT IV：光束扫描 · Logo 显现（4.6 ~ 6s） ---- */
      // 光束从画面左侧扫至右侧
      tl.fromTo(
        q('.intro-beam'),
        { xPercent: -55, opacity: 0 },
        {
          xPercent: 160,
          opacity: 1,
          duration: cfg.act4.beamDuration,
          ease: 'power1.inOut',
          // 光束位置 → CSS 变量 --beam，驱动 Logo 的 mask 扫描显现
          onUpdate: function () {
            // 防御：tween 被 kill / StrictMode 重建时 progress 可能为 NaN
            const p = Number.isFinite(this.progress) ? this.progress : 0
            logoWrap.style.setProperty('--beam', `${18 + p * 82}%`)
          },
        },
        cfg.act4.start + 0.05,
      )
      // Logo：先暗后亮 + 轻微缩放（随光束点亮）
      tl.fromTo(
        logoWrap,
        { opacity: 0, scale: 0.985 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'power1.out' },
        cfg.act4.start + 0.08,
      )
      tl.to(
        q('.intro-beam'),
        { opacity: 0, duration: 0.5, ease: 'sine.out' },
        cfg.act4.start + cfg.act4.beamDuration + 0.1,
      )

      /* ---- ACT V：星云浮现 · Tagline（6 ~ 7.2s） ---- */
      tl.to(introState, { cameraZ: cfg.act5.cameraFinalZ, duration: 1.2, ease: 'sine.inOut' }, cfg.act5.start)
      tl.to(introState, { nebula: 1, duration: 1.4, ease: 'sine.out' }, cfg.act5.start + 0.1)
      tl.fromTo(
        q('.intro-tagline'),
        { opacity: 0, y: 10 },
        { opacity: 0.85, y: 0, duration: 1.0, ease: 'power2.out' },
        cfg.act5.start + 0.35,
      )

      /* ---- ACT VI：ENTER（7.2 ~ 8s） ---- */
      tl.fromTo(
        q('.intro-enter'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
        cfg.act6.start + 0.2,
      )
      // 开启鼠标对粒子的吸引（ENETR 悬停预演）
      tl.to(pointerState, { attract: 1, duration: 0.6, ease: 'sine.out' }, cfg.act6.start + 0.4)

      // 时间线播完 → ENTER 可点击
      tl.eventCallback('onComplete', () => {
        if (!disposed) setReady(true)
      })
    }

    return () => {
      disposed = true
      mainTimeline.current?.kill()
      finaleTimeline.current?.kill()
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /* Finale：点击 ENTER —— 粒子过渡                                    */
  /* ---------------------------------------------------------------- */

  const enterMain = useCallback(() => {
    if (entered.current || !ready) return
    entered.current = true

    const root = rootRef.current
    if (!root) return
    const q = gsap.utils.selector(root)
    const cfg = INTRO_CONFIG.finale

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
    finaleTimeline.current = tl

    // Logo 瞬间让位于粒子（DOM 消失，LogoParticles 同帧显现）
    tl.to(q('.intro-logo-wrap'), { opacity: 0, duration: 0.05, ease: 'none' }, 0)

    // Logo 解体：数千粒子飞散（shader：uDissolve 0 → 1）
    tl.to(introState, { dissolve: 1, duration: 0.95, ease: 'power2.in' }, 0)

    // 镜头急推 + 径向运动模糊（模拟高速穿越星尘）
    tl.to(introState, { cameraZ: cfg.cameraBurstZ, duration: 1.0, ease: 'power3.in' }, 0)
    tl.to(introState, { motionBlur: cfg.motionBlurPeak, duration: 0.42, ease: 'power1.out' }, 0.02)
    tl.to(introState, { motionBlur: 0, duration: 0.65, ease: 'power1.in' }, 0.45)

    // 中心镜头眩光（极弱，DOM 闪光）
    tl.fromTo(
      q('.intro-flare'),
      { opacity: 0 },
      { opacity: cfg.flarePeak * 0.55, duration: 0.22, ease: 'sine.out' },
      0.04,
    )
    tl.to(q('.intro-flare'), { opacity: 0, duration: 0.55, ease: 'sine.in' }, 0.3)

    // 其余 DOM 层迅速退场（快，不拖沓）
    tl.to(
      [q('.intro-enter'), q('.intro-tagline'), q('.intro-skip')],
      { opacity: 0, duration: 0.22, ease: 'power1.in' },
      0,
    )

    // 相机轻微下移，过渡到主页视点
    tl.to(introState, { cameraY: -0.3, duration: 1.1, ease: 'power2.inOut' }, 0.15)

    // 防御：即使 React 卸载延迟，整个 intro 层先彻底隐藏（防止残留遮挡主页）
    tl.to(root, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.55)

    // 粒子过渡完成 → 挂载主页
    tl.call(onComplete, [], '+=0.12')
  }, [ready, onComplete])

  /* ---------------------------------------------------------------- */
  /* SKIP：倍速快进到六幕结束（所有动画仍然"跑完"，不跳变）              */
  /* ---------------------------------------------------------------- */

  const skipIntro = useCallback(() => {
    if (entered.current) return
    const tl = mainTimeline.current
    if (!tl) return
    // 倍速快进：六幕动画仍然完整跑完（只是快），不产生跳变
    tl.timeScale(INTRO_CONFIG.skip.timescale)
    // SKIP 自身迅速退场
    const skipEl = rootRef.current?.querySelector('.intro-skip')
    if (skipEl) gsap.to(skipEl, { opacity: 0, duration: 0.3, ease: 'sine.out' })
  }, [])

  return (
    <IntroDom ref={rootRef} onEnter={enterMain} onSkip={skipIntro} />
  )
}
