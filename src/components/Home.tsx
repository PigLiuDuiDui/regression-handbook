/**
 * Home —— 首页（月光森林主题）
 *
 * Hero 第一眼震撼：月光森林背景（WebGL Forest）+ 品牌主视觉。
 * 文案参考 README：
 *   HEESEUNG / 李羲承 / 小鹿园
 *   "The brightest deer in our forest"
 *   Explore
 */
import { useEffect, useRef } from 'react'
import { SITE } from '../lib/constants'

export function Home() {
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
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
      <section className="home-hero" ref={heroRef}>
        <p className="home-hero-kicker">OFFICIAL FAN SPACE</p>
        <h1 className="home-hero-title">{SITE.titleLatin}</h1>
        <p className="home-hero-han">{SITE.titleHan}</p>
        <p className="home-hero-sub">{SITE.titleSub}</p>
        <p className="home-hero-tagline">{SITE.tagline}</p>
        <a className="home-hero-explore" href="#forest" aria-label="探索森林">
          Explore
          <span className="home-hero-explore-line" aria-hidden="true" />
        </a>
      </section>

      {/* 森林章节 */}
      <section className="home-section" id="forest">
        <p className="home-section-index">01</p>
        <h2 className="home-section-title">THE FOREST</h2>
        <p className="home-section-body">
          HEESEUNG · 李羲承。ENHYPEN 的队长与主唱，
          2020 年 11 月 30 日随组合出道。
          像月光穿过森林，安静，却足以照亮一整片夜空。
        </p>
      </section>

      <section className="home-section home-section--quote">
        <p className="home-section-index">02</p>
        <blockquote className="home-quote">“The brightest deer in our forest.”</blockquote>
        <p className="home-section-body">
          这里是小鹿园 —— 为李羲承而生的静谧森林。
          不喧哗，不拥挤，只有温柔的月光。
        </p>
      </section>

      <section className="home-section home-section--grid">
        <p className="home-section-index">03</p>
        <h2 className="home-section-title">MEMORY</h2>
        <div className="home-grid">
          <div className="home-grid-item">
            <span className="home-grid-num">2020</span>
            <span className="home-grid-label">DEBUT</span>
          </div>
          <div className="home-grid-item">
            <span className="home-grid-num">—</span>
            <span className="home-grid-label">FOREST</span>
          </div>
          <div className="home-grid-item">
            <span className="home-grid-num">∞</span>
            <span className="home-grid-label">ETERNITY</span>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p className="home-footer-title">{SITE.titleHan}</p>
        <p className="home-footer-sub">FOR HEESEUNG · {new Date().getFullYear()}</p>
        <p className="home-footer-note">A quiet forest under the moonlight.</p>
      </footer>
    </main>
  )
}
