/**
 * About —— 关于 HEESEUNG
 */
import { SITE } from '../lib/constants'

export function About() {
  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">ABOUT</p>
        <h1 className="page-title">ABOUT HEESEUNG</h1>
        <p className="page-sub">李羲承 · 小鹿园</p>
      </header>

      <div className="about-layout">
        <div className="about-portrait">
          <img src="/assets/hero-portrait.png" alt="HEESEUNG" />
        </div>
        <div className="about-body">
          <h2 className="about-name">{SITE.titleLatin}</h2>
          <p className="about-han">李羲承</p>
          <p className="about-text">
            ENHYPEN 的队长与主唱。2020 年 11 月 30 日随组合出道。
            他的歌声像月光落在湖面，安静，却足以照亮一整片森林。
          </p>
          <div className="about-stats">
            <div className="about-stat">
              <span className="about-stat-num">2020</span>
              <span className="about-stat-label">DEBUT</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-num">LEADER</span>
              <span className="about-stat-label">POSITION</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-num">VOCAL</span>
              <span className="about-stat-label">ROLE</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
