/**
 * SupportProject —— 粉丝应援中心
 *
 * 展示应援项目（生日 / 演唱会 / 纪念），进度条 + 目标 + 地点。
 * 玻璃拟态卡片，暖色调。
 */
import { SUPPORT_PROJECTS } from '../lib/nav'

export function SupportProject() {
  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">FAN SUPPORT CENTER</p>
        <h1 className="page-title">SUPPORT PROJECT</h1>
        <p className="page-sub">粉丝应援中心</p>
      </header>

      <div className="support-grid">
        {SUPPORT_PROJECTS.map((p) => (
          <div className="support-card" key={p.id}>
            <div className="support-card-head">
              <h2 className="support-title">{p.title}</h2>
              <p className="support-han">{p.titleHan}</p>
            </div>
            <div className="support-goal">
              <span className="support-goal-label">GOAL</span>
              <span className="support-goal-value">{p.goal}</span>
            </div>
            <div className="support-progress">
              <div className="support-progress-bar" style={{ width: `${p.progress * 100}%` }} />
            </div>
            <div className="support-progress-label">
              <span>{Math.round(p.progress * 100)}%</span>
              <span>DUE {p.deadline}</span>
            </div>
            <div className="support-location">
              <span className="support-location-label">LOCATION</span>
              <span>{p.location}</span>
            </div>
            <button className="support-join" type="button">
              参与应援
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}
