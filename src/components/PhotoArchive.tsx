/**
 * PhotoArchive —— 相册（HEESEUNG 记忆博物馆）
 *
 * 功能：高清写真、年份筛选、灯箱放大。
 * 布局：年份 tab + masonry 图片网格，hover 光影效果。
 */
import { useMemo, useState } from 'react'
import { PHOTO_ITEMS, PHOTO_YEARS } from '../lib/nav'

export function PhotoArchive() {
  const [year, setYear] = useState<string>('all')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const items = useMemo(
    () => (year === 'all' ? PHOTO_ITEMS : PHOTO_ITEMS.filter((p) => p.year === year)),
    [year],
  )

  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">MEMORY MUSEUM</p>
        <h1 className="page-title">PHOTO ARCHIVE</h1>
        <p className="page-sub">HEESEUNG 记忆博物馆</p>
      </header>

      {/* 年份筛选 */}
      <div className="year-filter" role="tablist" aria-label="年份筛选">
        <button
          className={`year-filter-btn${year === 'all' ? ' year-filter-btn--active' : ''}`}
          onClick={() => setYear('all')}
        >
          ALL
        </button>
        {PHOTO_YEARS.map((y) => (
          <button
            key={y}
            className={`year-filter-btn${year === y ? ' year-filter-btn--active' : ''}`}
            onClick={() => setYear(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {/* 图片网格 */}
      <div className="photo-grid">
        {items.map((p, i) => (
          <button
            key={p.id}
            className="photo-card"
            onClick={() => setLightbox(i)}
            aria-label={`查看 ${p.title}`}
          >
            <img src={p.cover} alt={p.title} loading="lazy" />
            <div className="photo-card-meta">
              <span className="photo-card-year">{p.year}</span>
              <span className="photo-card-title">{p.title}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 灯箱 */}
      {lightbox !== null && items[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={items[lightbox].cover} alt={items[lightbox].title} />
            <p className="lightbox-title">
              {items[lightbox].title} · {items[lightbox].year}
            </p>
            <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="关闭">
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
