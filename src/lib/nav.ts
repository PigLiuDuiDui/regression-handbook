/**
 * 导航与页面配置 —— HEESEUNG 小鹿园 · Deer Forest
 *
 * 六个主页面（README 信息架构）：
 *   HOME / ABOUT / PHOTO / VIDEO / SCHEDULE / SUPPORT / COMMUNITY
 */

export type PageId =
  | 'home'
  | 'about'
  | 'photo'
  | 'video'
  | 'schedule'
  | 'support'
  | 'community'

export interface NavItem {
  id: PageId
  /** 导航显示名（英文） */
  label: string
  /** 中文名 */
  labelHan: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', labelHan: '首页' },
  { id: 'about', label: 'ABOUT', labelHan: '关于' },
  { id: 'photo', label: 'PHOTO', labelHan: '相册' },
  { id: 'video', label: 'VIDEO', labelHan: '影院' },
  { id: 'schedule', label: 'SCHEDULE', labelHan: '日程' },
  { id: 'support', label: 'SUPPORT', labelHan: '应援' },
  { id: 'community', label: 'COMMUNITY', labelHan: '社区' },
]

/** 相册年份筛选 */
export const PHOTO_YEARS = ['2026', '2025', '2024'] as const

/** 日程数据（森林日历） */
export interface ScheduleEvent {
  date: string
  title: string
  titleHan: string
  type: 'comeback' | 'event' | 'concert' | 'support'
  location: string
}

export const SCHEDULE_EVENTS: ScheduleEvent[] = [
  { date: '2026-02-14', title: 'FAN MEETING', titleHan: '粉丝见面会', type: 'event', location: 'Seoul' },
  { date: '2026-04-20', title: 'COMEBACK', titleHan: '回归', type: 'comeback', location: 'Worldwide' },
  { date: '2026-06-08', title: 'BIRTHDAY', titleHan: '生日', type: 'support', location: 'Seoul' },
  { date: '2026-08-15', title: 'CONCERT', titleHan: '演唱会', type: 'concert', location: 'Tokyo' },
  { date: '2026-10-10', title: 'FAN SIGN', titleHan: '签售会', type: 'event', location: 'Seoul' },
  { date: '2026-12-24', title: 'YEAR END', titleHan: '年末舞台', type: 'concert', location: 'Seoul' },
]

/** 应援项目 */
export interface SupportProject {
  id: string
  title: string
  titleHan: string
  goal: string
  location: string
  progress: number
  deadline: string
}

export const SUPPORT_PROJECTS: SupportProject[] = [
  {
    id: 'birthday',
    title: 'BIRTHDAY PROJECT',
    titleHan: '生日应援',
    goal: 'LED Advertisement',
    location: 'Seoul',
    progress: 0.8,
    deadline: '2026-06-01',
  },
  {
    id: 'concert',
    title: 'CONCERT SUPPORT',
    titleHan: '演唱会应援',
    goal: 'Light Stick + Banner',
    location: 'Tokyo',
    progress: 0.55,
    deadline: '2026-08-01',
  },
  {
    id: 'anniversary',
    title: 'DEBUT ANNIVERSARY',
    titleHan: '出道纪念',
    goal: 'Subway Ad',
    location: 'Seoul',
    progress: 0.3,
    deadline: '2026-11-01',
  },
]

/** 影院视频 */
export interface VideoItem {
  id: string
  title: string
  titleHan: string
  date: string
  cover: string
}

export const VIDEO_ITEMS: VideoItem[] = [
  { id: 'v1', title: 'MOONLIGHT STAGE', titleHan: '月光舞台', date: '2026-04', cover: '/assets/cinema-bg.png' },
  { id: 'v2', title: 'FOREST INTERVIEW', titleHan: '森林访谈', date: '2026-02', cover: '/assets/forest-bg.png' },
  { id: 'v3', title: 'DEER DOCUMENTARY', titleHan: '小鹿纪录', date: '2025-12', cover: '/assets/hero-portrait.png' },
  { id: 'v4', title: 'BEHIND THE SCENE', titleHan: '幕后花絮', date: '2025-10', cover: '/assets/gallery-bg.png' },
]

/** 相册图片 */
export interface PhotoItem {
  id: string
  year: string
  title: string
  cover: string
}

export const PHOTO_ITEMS: PhotoItem[] = [
  { id: 'p1', year: '2026', title: 'Forest Dawn', cover: '/assets/hero-portrait.png' },
  { id: 'p2', year: '2026', title: 'Moonlight', cover: '/assets/forest-bg.png' },
  { id: 'p3', year: '2026', title: 'Stillness', cover: '/assets/deer-silhouette.png' },
  { id: 'p4', year: '2025', title: 'Stage Light', cover: '/assets/cinema-bg.png' },
  { id: 'p5', year: '2025', title: 'Quiet Moment', cover: '/assets/gallery-bg.png' },
  { id: 'p6', year: '2024', title: 'Beginning', cover: '/assets/forest-bg.png' },
  { id: 'p7', year: '2024', title: 'First Light', cover: '/assets/hero-portrait.png' },
]

/** 社区动态 */
export interface CommunityPost {
  id: string
  author: string
  content: string
  likes: number
  time: string
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  { id: 'c1', author: 'deer_01', content: '月光洒在森林里，像他唱歌时的样子。', likes: 128, time: '2h' },
  { id: 'c2', author: 'moonchild', content: 'Today is a HEESEUNG day 🌙', likes: 96, time: '5h' },
  { id: 'c3', author: 'forest_walker', content: '永远做照亮我们森林的那束光。', likes: 204, time: '1d' },
  { id: 'c4', author: 'starlight', content: 'Every star finds its light.', likes: 67, time: '2d' },
]
