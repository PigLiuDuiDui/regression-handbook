/**
 * 鹿角轮廓生成器
 *
 * 用多条 CatmullRom 曲线定义单侧鹿角骨架（主干 + 五个分支），
 * 采样后沿 Y 轴镜像得到完整对称鹿角 —— 只保留极简线条，
 * 不出现完整鹿的形体。
 *
 * 所有骨架点位于 z=0 平面（后续在 shader 中做厚度抖动）。
 * 渲染时每个银河粒子从骨架点中随机取样作为聚集目标，
 * 因此粒子密度决定轮廓的清晰度（粒子越多，线条越锐利）。
 */
import * as THREE from 'three'

/** 单侧鹿角骨架：二维控制点（x 向右为外侧，y 向上，原点为颅顶中心） */
type Vec2 = [number, number]

const LEFT_ANTLER_BRANCHES: Vec2[][] = [
  // 主干：颅顶 → 顶部，微弯如月
  [
    [0.02, -0.05],
    [0.14, 0.35],
    [0.2, 0.8],
    [0.17, 1.3],
    [0.08, 1.75],
  ],
  // 眉叉：向前下方伸展
  [
    [0.06, 0.3],
    [-0.08, 0.52],
    [-0.3, 0.58],
  ],
  // 第二叉：斜向上
  [
    [0.19, 0.72],
    [0.02, 1.02],
    [-0.24, 1.12],
  ],
  // 第三叉：上弯，向外侧挑出
  [
    [0.19, 1.1],
    [0.42, 1.42],
    [0.68, 1.5],
  ],
  // 顶叉前尖
  [
    [0.08, 1.75],
    [-0.02, 2.08],
    [-0.12, 2.3],
  ],
  // 顶叉后尖
  [
    [0.08, 1.75],
    [0.26, 2.12],
    [0.34, 2.38],
  ],
]

/** 每条分支的采样点数（分支越长密度越均匀） */
const SAMPLES_PER_BRANCH = 48

/** 轮廓抖动幅度：让线条保留"星尘"质感而非死板直线 */
const JITTER = 0.015

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

/**
 * 构建鹿角骨架点集
 * @param thickness z 轴厚度（世界单位），让轮廓具有轻微立体感
 * @returns 骨架点（xyz 交错），顺序：左支（主干→分支）→ 右支（镜像）
 */
export function buildAntlerSkeleton(thickness = 0.14): Float32Array {
  const left: THREE.Vector3[] = []

  for (const branch of LEFT_ANTLER_BRANCHES) {
    const curve = new THREE.CatmullRomCurve3(
      branch.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    )
    for (let i = 0; i < SAMPLES_PER_BRANCH; i++) {
      left.push(curve.getPoint(i / (SAMPLES_PER_BRANCH - 1)))
    }
  }

  const total = left.length * 2
  const positions = new Float32Array(total * 3)
  let idx = 0

  // 左支
  for (const p of left) {
    positions[idx++] = p.x + rand(-JITTER, JITTER)
    positions[idx++] = p.y + rand(-JITTER, JITTER)
    positions[idx++] = rand(-thickness, thickness)
  }
  // 右支（镜像）
  for (const p of left) {
    positions[idx++] = -p.x + rand(-JITTER, JITTER)
    positions[idx++] = p.y + rand(-JITTER, JITTER)
    positions[idx++] = rand(-thickness, thickness)
  }

  return positions
}
