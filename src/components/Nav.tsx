/**
 * Nav —— 顶部导航栏
 *
 * 固定在顶部的极简导航，左侧 Logo（HEESEUNG · 小鹿园），
 * 右侧页面链接。当前页高亮，hover 有月光金下划线。
 */
import { NAV_ITEMS, type PageId } from '../lib/nav'
import { SITE } from '../lib/constants'

interface NavProps {
  current: PageId
  onNavigate: (id: PageId) => void
}

export function Nav({ current, onNavigate }: NavProps) {
  return (
    <header className="nav">
      <button className="nav-brand" onClick={() => onNavigate('home')} aria-label="回到首页">
        <span className="nav-brand-latin">{SITE.titleLatin}</span>
        <span className="nav-brand-han">{SITE.titleHan}</span>
      </button>

      <nav className="nav-links" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-link${item.id === current ? ' nav-link--active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={item.id === current ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
