/**
 * 开场动画全局配置
 *
 * 所有动画参数集中在此，便于整体调校节奏。
 * 时间轴单位为秒（GSAP Timeline 默认单位）。
 *
 * 六幕结构（总时长 ≈ 8s）：
 *   ACT I    黑场 · 一点星光（呼吸 / 胶片颗粒）
 *   ACT II   镜头推进 · 粒子形成银河（远/中/近景）
 *   ACT III  粒子聚集为鹿角轮廓（点 → 线 → 面 → 轮廓）→ 化成星光
 *   ACT IV   银白光束扫过 · Logo 显现
 *   ACT V    银河星云浮现 · Tagline 淡入
 *   ACT VI   ENTER 出现 · 等待入场
 *   FINALE   点击 ENTER：Logo 解体 → 粒子飞散 → 镜头急推 → 主页
 */

export const INTRO_CONFIG = {
  /** 总时长（秒），点击 ENTER 之前的完整过场 */
  duration: 8.0,

  /* ---------------- 第一幕：黑场星光 ---------------- */
  act1: {
    start: 0.0,
    end: 1.0,
    /** 唯一点亮的星光亮度 */
    starIntensity: 0.35,
    /** 镜头呼吸幅度（世界单位） */
    breatheAmplitude: 0.02,
    /** 呼吸频率（rad/s） */
    breatheFrequency: 1.6,
  },

  /* ---------------- 第二幕：银河生成 ---------------- */
  act2: {
    start: 1.0,
    end: 3.0,
    /** 相机起始 z */
    cameraStartZ: 8.0,
    /** 相机推进后的 z */
    cameraMidZ: 4.6,
    /** 粒子显现 0 → 1（出现的时间比例，相对本幕） */
    revealEase: 'power2.inOut',
  },

  /* ---------------- 第三幕：鹿角聚集 ---------------- */
  act3: {
    start: 3.0,
    end: 4.6,
    /** 聚集第一阶段：粒子收拢成点群（进度 0 → 0.38） */
    gatherPoint: 0.38,
    /** 聚集第二阶段：点群拉成线条（0.38 → 0.72） */
    gatherLine: 0.72,
    /** 第三阶段：轮廓精确成型（0.72 → 1.0） */
    gatherContour: 1.0,
    /** 轮廓完全成型后的保持时间（秒） */
    hold: 0.35,
    /** "化成星光"的时长（秒） */
    dissolve: 0.55,
    /** 化成星光时的闪光强度 */
    flashIntensity: 0.9,
  },

  /* ---------------- 第四幕：光束与 Logo ---------------- */
  act4: {
    start: 4.6,
    end: 6.0,
    /** 光束横扫时长（秒） */
    beamDuration: 0.85,
    /** Logo 随光束显现后的完整可见延迟 */
    logoFullDelay: 0.25,
    /** Logo 泛光（Bloom 阈值偏移，越小越亮） */
    bloomLift: 0.18,
  },

  /* ---------------- 第五幕：星空与 Tagline ---------------- */
  act5: {
    start: 6.0,
    end: 7.2,
    /** 相机继续慢推至 z */
    cameraFinalZ: 4.05,
    /** 星云 / 尘埃显现强度 */
    nebulaStrength: 0.5,
  },

  /* ---------------- 主页（Intro 结束后） ---------------- */
  home: {
    /** 主页相机 z：拉远到 14，让半径 7.5 的银河主体完整入画（fov 55°） */
    cameraZ: 14.0,
  },

  /* ---------------- 第六幕：ENTER ---------------- */
  act6: {
    start: 7.2,
    end: 8.0,
  },

  /* ---------------- Finale：入场过渡 ---------------- */
  finale: {
    /** 相机急推至 z */
    cameraBurstZ: 1.35,
    /** 急推时长（秒） */
    duration: 1.05,
    /** Logo 解体粒子的飞散半径 */
    burstRadius: 9.0,
    /** 径向运动模糊强度峰值 */
    motionBlurPeak: 0.55,
    /** 中心镜头眩光强度峰值 */
    flarePeak: 0.35,
  },

  /* ---------------- 粒子系统 ---------------- */
  particles: {
    /** 高质量档位粒子数 */
    countHigh: 22000,
    /** 中质量档位 */
    countMid: 11000,
    /** 低质量档位 */
    countLow: 5500,
    /** 粒子基础大小（世界单位） */
    baseSize: 0.022,
    /** 银河臂数 */
    galaxyArms: 3,
    /** 银河半径 */
    galaxyRadius: 7.5,
    /** 银河厚度 */
    galaxyThickness: 1.05,
    /** 银河旋转速度（rad/s） */
    galaxySpin: 0.016,
    /** 粒子自主漂移幅度 */
    driftAmplitude: 0.05,
    /** 星河色板：暖金白（亮星）/ 纯白 / 冷蓝白（暗星），shader 内按种子插值 */
    palette: {
      warm: '#FFE8C8',
      snow: '#FFFFFF',
      mist: '#B4C6DC',
    },
  },

  /* ---------------- 鼠标交互 ---------------- */
  mouse: {
    /** 相机随鼠标的最大偏移（NDC 比例） */
    cameraParallax: 0.35,
    /** 粒子被吸引的半径（世界单位） */
    attractRadius: 1.1,
    /** 粒子最大吸引位移（世界单位） */
    attractStrength: 0.14,
    /** 平滑系数 */
    smooth: 0.06,
  },

  /* ---------------- 跳过 ---------------- */
  skip: {
    /** SKIP 出现的时机（秒） */
    appearAt: 0.9,
    /** 跳过时的时间轴倍速 */
    timescale: 6,
  },
} as const

export type IntroConfig = typeof INTRO_CONFIG
