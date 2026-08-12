/**
 * Home —— 主页（Intro 粒子过渡后进入）
 *
 * 背景 = 同一个 UniverseScene（银河持续缓慢运动，镜头保持推进感），
 * 内容层通过 Lenis 平滑滚动，Hero 随滚动轻微上浮淡出。
 *
 * 文案保持诗意与克制 —— 不堆砌信息，只留下呼吸感。
 */
import { useEffect, useRef } from 'react'
import { SITE } from '../lib/constants'

export function Home() {
  const heroRef = useRef<HTMLElement>(null)

  // Hero 随滚动轻微上浮 + 淡出（rAF 节流）
  useEffect(() => {
    // 防御：浏览器刷新会恢复滚动位置 → hero 可能已滚出视口 / 透明度归零，
    // 大字像被"覆盖"。挂载时强制回到顶部（intro 路径与直进主页路径均生效）
    window.scrollTo({ top: 0, behavior: 'instant' })

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const hero = heroRef.current
        if (!hero) return
        const y = window.scrollY
        hero.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.55)))
        hero.style.transform = `translateY(${y * 0.22}px)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main className="home">
      {/* ---------------- Hero ---------------- */}
      <section className="home-hero" ref={heroRef}>
        <p className="home-hero-kicker">OFFICIAL FAN SPACE</p>
        <h1 className="home-hero-title">{SITE.titleLatin}</h1>
        <p className="home-hero-han">{SITE.titleHan}</p>
        <p className="home-hero-tagline">{SITE.tagline}</p>
        <span className="home-hero-scroll" aria-hidden="true">
          SCROLL
        </span>
      </section>

      {/* ---------------- 章节：星光 ---------------- */}
      <section className="home-section">
        <p className="home-section-index">01</p>
        <h2 className="home-section-title">THE STAR</h2>
        <p className="home-section-body">
          HEESEUNG · 李羲承。ENHYPEN 的队长与主唱，
          2020 年 11 月 30 日随组合出道。歌声像月光落在湖面，
          安静，却足以照亮一整片夜空。
        </p>
      </section>

      {/* ---------------- 章节：宁静 ---------------- */}
      <section className="home-section home-section--quote">
        <p className="home-section-index">02</p>
        <blockquote className="home-quote">
          “Every star finds its light.”
        </blockquote>
        <p className="home-section-body">
          这里是小鹿园 —— 为李羲承而生的静谧之地。
          不喧哗，不拥挤，只有温柔的光。
        </p>
      </section>

      {/* ---------------- 章节：光年 ---------------- */}
      <section className="home-section home-section--grid">
        <p className="home-section-index">03</p>
        <h2 className="home-section-title">LIGHT YEARS</h2>
        <div className="home-grid">
          <div className="home-grid-item">
            <span className="home-grid-num">2020</span>
            <span className="home-grid-label">DEBUT</span>
          </div>
          <div className="home-grid-item">
            <span className="home-grid-num">—</span>
            <span className="home-grid-label">SERENITY</span>
          </div>
          <div className="home-grid-item">
            <span className="home-grid-num">∞</span>
            <span className="home-grid-label">ETERNITY</span>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="home-footer">
        <p className="home-footer-title">{SITE.titleHan}</p>
        <p className="home-footer-sub">
          FOR HEESEUNG · {new Date().getFullYear()}
        </p>
        <p className="home-footer-note">
          A quiet place under the stars.
        </p>
      </footer>
    </main>
  )
}
