/**
 * 设备性能档位检测
 *
 * 目标：低性能设备自动降低粒子数量与后期效果复杂度，保证 FPS ≥ 60。
 *
 * 三档策略：
 *  - high    ：完整效果（DOF / Motion Smear / Lens Flare 全开，粒子 22000）
 *  - medium  ：关闭 DOF，粒子减半
 *  - low     ：仅保留 Bloom + Vignette + Grain，粒子 5500，DPR 限制 1.25
 *
 * 判定来源（按优先级）：
 *  1. 硬件指标（CPU 核数 / 设备内存 / 移动端）
 *  2. 运行时 FPS 采样（首帧后 30 帧内低于阈值则降档）
 */

export type QualityTier = 'high' | 'medium' | 'low'

export interface DeviceCapability {
  tier: QualityTier
  /** 是否支持 WebGL2（不支持时回退到 CSS 星空） */
  webgl2: boolean
  /** 像素比上限（已 clamp） */
  dprCap: number
  /** 粒子数量（已按档位选定） */
  particleCount: number
  /** 是否启用景深 */
  dof: boolean
  /** 是否启用径向运动模糊 */
  motionBlur: boolean
  /** 是否启用镜头眩光 */
  lensFlare: boolean
}

const PARTICLE_TABLE: Record<QualityTier, number> = {
  high: 22000,
  medium: 11000,
  low: 5500,
}

const DPR_TABLE: Record<QualityTier, number> = {
  high: 1.5,
  medium: 1.25,
  low: 1.0,
}

/** 由硬件指标推断基础档位 */
function hardwareTier(): QualityTier {
  const nav = navigator as Navigator & {
    deviceMemory?: number
  }
  const cores = navigator.hardwareConcurrency ?? 8
  const memory = nav.deviceMemory ?? 8
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900)

  if (isMobile && (cores <= 4 || memory <= 4)) return 'low'
  if (cores <= 4 || memory <= 4) return 'medium'
  if (isMobile) return 'medium'
  return 'high'
}

/** 检测 WebGL2 支持 */
function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return Boolean(gl)
  } catch {
    return false
  }
}

/** 运行时 FPS 采样：30 帧内平均帧间隔超阈值则降档；1.5s 超时兜底（窗口遮挡等场景） */
export async function measureFpsProbe(
  initial: QualityTier,
  threshold = 16.7 * 1.35,
): Promise<QualityTier> {
  if (initial === 'low') return initial

  return new Promise((resolve) => {
    const samples: number[] = []
    let last = performance.now()
    let frames = 0
    let settled = false

    const finish = (tier: QualityTier) => {
      if (settled) return
      settled = true
      resolve(tier)
    }

    // 兜底：rAF 被挂起（窗口最小化 / 后台标签页）时直接放行，避免永黑屏
    const timer = window.setTimeout(() => finish(initial), 1500)

    const step = (now: number) => {
      samples.push(now - last)
      last = now
      frames += 1
      if (frames >= 30) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length
        // 平均帧间隔超过阈值（≈50fps），降一档
        finish(avg > threshold ? (initial === 'high' ? 'medium' : 'low') : initial)
        window.clearTimeout(timer)
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

/** 汇总设备能力（异步精调：硬件档位 + FPS 采样） */
export async function resolveCapability(): Promise<DeviceCapability> {
  const base = initialCapability()
  const tier = await measureFpsProbe(base.tier)

  return {
    ...base,
    tier,
    dprCap: DPR_TABLE[tier],
    particleCount: PARTICLE_TABLE[tier],
    dof: tier === 'high',
    motionBlur: tier !== 'low',
    lensFlare: tier !== 'low',
  }
}

/**
 * 同步推断初始能力（不等待 FPS 采样），用于首帧立刻渲染场景。
 * 后续 resolveCapability() 的 FPS 采样可能降档，届时由 setCapability 平滑替换。
 */
export function initialCapability(): DeviceCapability {
  const tier = hardwareTier()
  return {
    tier,
    webgl2: detectWebGL2(),
    dprCap: DPR_TABLE[tier],
    particleCount: PARTICLE_TABLE[tier],
    dof: tier === 'high',
    motionBlur: tier !== 'low',
    lensFlare: tier !== 'low',
  }
}
