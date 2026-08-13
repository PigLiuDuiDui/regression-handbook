/**
 * 全局设计常量 —— 月光森林视觉语言
 *
 * 主题：HEESEUNG 小鹿园 · Deer Forest
 * 参考：Apple 官网高级设计 / Dior·Chanel 杂志视觉 / 月光森林
 *
 * 色彩（README 指定）：
 *  - 森林绿 #24352A
 *  - 奶油白 #F8F3E8
 *  - 小鹿棕 #9B7653
 *  - 月光金 #D8B36A
 *  - 雾蓝   #C8D5D8
 */

export const COLORS = {
  /** 深森林绿（主背景，非纯黑，带绿色层次） */
  FOREST: '#16231c',
  FOREST_DEEP: '#0e1712',
  /** 奶油白 */
  CREAM: '#f8f3e8',
  /** 小鹿棕 */
  DEER: '#9b7653',
  /** 月光金 */
  MOON: '#d8b36a',
  /** 雾蓝 */
  MIST: '#c8d5d8',
  /** 纯白（高光） */
  SNOW: '#ffffff',
  /** 柔和星尘白（文字次色） */
  STARDUST: '#c9d8c9',
} as const

export const THREE_COLORS = {
  FOREST: 0x16231c,
  FOREST_DEEP: 0x0e1712,
  CREAM: 0xf8f3e8,
  DEER: 0x9b7653,
  MOON: 0xd8b36a,
  MIST: 0xc8d5d8,
  SNOW: 0xffffff,
  STARDUST: 0xc9d8c9,
} as const

/** 主题元数据 */
export const SITE = {
  titleLatin: 'HEESEUNG',
  titleHan: '小鹿园',
  titleSub: 'Deer Forest',
  tagline: 'The brightest deer in our forest.',
  storageKey: 'deerpark.intro.seen.v1',
} as const

/* =========================================================================
 * 恒星光谱型（真实天文 Main Sequence 近似）
 *  - 颜色取自真实黑体/恒星光谱近似（线性空间，0..1）
 *  - temperatureK 仅用于参考与科学感提示
 *  - weight 为出现频率（O 极少，M 极多）—— 形成自然幂律分布
 * ========================================================================= */
export interface SpectralClass {
  /** 光谱型 O B A F G K M */
  type: string
  /** 线性 RGB 颜色（HDR 前的恒星本色） */
  color: [number, number, number]
  /** 近似有效温度 (K) */
  temperatureK: number
  /** 相对出现权重（用于采样分布） */
  weight: number
  /** 相对亮度（用于大小/辉光强度的基础） */
  luminosity: number
}

export const SPECTRAL_CLASSES: SpectralClass[] = [
  // O 型：极蓝白，罕见、极亮
  { type: 'O', color: [0.61, 0.71, 1.0], temperatureK: 30000, weight: 0.02, luminosity: 3.4 },
  // B 型：蓝白
  { type: 'B', color: [0.69, 0.78, 1.0], temperatureK: 18000, weight: 0.18, luminosity: 2.1 },
  // A 型：白
  { type: 'A', color: [0.86, 0.9, 1.0], temperatureK: 9000, weight: 0.6, luminosity: 1.5 },
  // F 型：黄白
  { type: 'F', color: [0.98, 0.96, 0.92], temperatureK: 6800, weight: 1.4, luminosity: 1.15 },
  // G 型：太阳黄（暖白）
  { type: 'G', color: [1.0, 0.95, 0.82], temperatureK: 5600, weight: 2.6, luminosity: 1.0 },
  // K 型：橙
  { type: 'K', color: [1.0, 0.84, 0.62], temperatureK: 4200, weight: 4.2, luminosity: 0.78 },
  // M 型：红橙，最常见、最暗
  { type: 'M', color: [1.0, 0.66, 0.46], temperatureK: 3200, weight: 8.0, luminosity: 0.55 },
]

/* =========================================================================
 * 星云调色板（真实宇宙发射/反射星云）
 *  - 蓝：反射星云（年轻热星散射）
 *  - 青：电离氧 OIII
 *  - 紫：混合电离区
 *  - 暖白：核心照亮区
 *  - 粉红 HII：电离氢 Hα（HII region）
 * ========================================================================= */
export const NEBULA_PALETTE = {
  blue: [0.34, 0.55, 1.0] as [number, number, number],
  cyan: [0.3, 0.86, 0.95] as [number, number, number],
  violet: [0.62, 0.42, 0.95] as [number, number, number],
  warmWhite: [1.0, 0.92, 0.82] as [number, number, number],
  hiiPink: [1.0, 0.42, 0.55] as [number, number, number],
  ember: [0.95, 0.45, 0.22] as [number, number, number],
}

/* =========================================================================
 * 电影后处理校色（Color Grading）目标
 *  - 月光森林：暗部森林绿、高光月光暖金、整体温柔治愈
 * ========================================================================= */
export const GRADE = {
  /** 曝光（EV 概念，乘性） */
  exposure: 1.05,
  /** 黑位提升（暗部非纯黑，森林绿色层次） */
  blackLevel: 0.02,
  /** 高光滚降（highlight roll-off，月光不脏） */
  highlightRollOff: 0.9,
  /** 色温偏移：暗部中性微暖（避免偏绿），亮部月光暖金 */
  shadowsTint: [0.01, 0.005, -0.005] as [number, number, number],
  highlightsTint: [0.04, 0.03, -0.01] as [number, number, number],
  /** 饱和度（温柔克制，避免过饱和泛绿） */
  saturation: 0.88,
}
