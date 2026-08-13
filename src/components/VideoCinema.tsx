/**
 * VideoCinema —— 私人电影院
 *
 * 黑色背景 + 电影海报卡片（封面 / 播放按钮 / 标题 / 日期）。
 */
import { useState } from 'react'
import { VIDEO_ITEMS } from '../lib/nav'

export function VideoCinema() {
  const [playing, setPlaying] = useState<string | null>(null)

  return (
    <main className="page page--cinema">
      <header className="page-header">
        <p className="page-kicker">PRIVATE CINEMA</p>
        <h1 className="page-title">VIDEO CINEMA</h1>
        <p className="page-sub">私人电影院</p>
      </header>

      <div className="cinema-grid">
        {VIDEO_ITEMS.map((v) => (
          <div className="cinema-card" key={v.id}>
            <div className="cinema-card-cover">
              <img src={v.cover} alt={v.title} loading="lazy" />
              <button
                className="cinema-play"
                onClick={() => setPlaying(playing === v.id ? null : v.id)}
                aria-label={`播放 ${v.title}`}
              >
                <span className="cinema-play-icon" aria-hidden="true">▶</span>
              </button>
            </div>
            <div className="cinema-card-meta">
              <span className="cinema-card-title">{v.title}</span>
              <span className="cinema-card-date">{v.date}</span>
            </div>
            {playing === v.id && (
              <div className="cinema-card-han">{v.titleHan}</div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
