/**
 * Schedule —— 森林日历
 *
 * 展示回归 / 活动 / 演唱会 / 应援日期。
 * 时间轴布局，事件按日期排列。
 */
import { SCHEDULE_EVENTS, type ScheduleEvent } from '../lib/nav'

const TYPE_LABEL: Record<ScheduleEvent['type'], string> = {
  comeback: 'COMEBACK',
  event: 'EVENT',
  concert: 'CONCERT',
  support: 'SUPPORT',
}

export function Schedule() {
  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">FOREST CALENDAR</p>
        <h1 className="page-title">SCHEDULE</h1>
        <p className="page-sub">森林日历</p>
      </header>

      <div className="schedule-list">
        {SCHEDULE_EVENTS.map((e) => (
          <div className="schedule-item" key={e.date}>
            <div className="schedule-date">
              <span className="schedule-date-day">{e.date.slice(8, 10)}</span>
              <span className="schedule-date-month">{e.date.slice(0, 7)}</span>
            </div>
            <div className="schedule-body">
              <span className={`schedule-type schedule-type--${e.type}`}>
                {TYPE_LABEL[e.type]}
              </span>
              <h2 className="schedule-title">{e.titleHan}</h2>
              <p className="schedule-sub">{e.title}</p>
            </div>
            <div className="schedule-location">{e.location}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
