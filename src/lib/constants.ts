/**
 * 全局设计常量
 *
 * 整个项目的视觉语言被严格限制在三种颜色内：
 *  - VOID    #050608  纯黑（宇宙底色）
 *  - SNOW    #FFFFFF  纯白（最亮星光 / Logo 高光）
 *  - MIST    #BFC8D6  银灰蓝（主体粒子 / 次级文字）
 *
 * 任何地方都不允许出现这三种颜色之外的"有色光"。
 * 后期效果的色调偏移也被约束在这组色板中。
 */

export const COLORS = {
  VOID: '#050608',
  SNOW: '#ffffff',
  MIST: '#bfc8d6',
} as const

/** 三种颜色的 Three.js 表示（0xRRGGBB） */
export const THREE_COLORS = {
  VOID: 0x050608,
  SNOW: 0xffffff,
  MIST: 0xbfc8d6,
} as const

/** 主题元数据 */
export const SITE = {
  /** 主标题 —— 英文全大写，Cinzel 字体 */
  titleLatin: 'HEESEUNG',
  /** 副标题 —— 中文，思源宋体 Heavy */
  titleHan: '小鹿园',
  /** 开场标语 */
  tagline: 'Every star finds its light.',
  /** localStorage 键：标记开场动画已播放 */
  storageKey: 'deerpark.intro.seen.v1',
} as const
