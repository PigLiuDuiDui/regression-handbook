/**
 * 动画状态共享层
 *
 * 架构说明：
 *   GSAP Timeline（DOM 侧）只负责 tween 这个纯对象；
 *   WebGL 侧（Starfield / PostFX / Camera）在 useFrame 中读取并写入 uniform。
 *
 * 这样实现"全部动画由 GSAP Timeline 控制、无 setTimeout"，
 * 同时保持渲染层与编排层解耦 —— 每个参数都可被 timeline 精确控制/回放。
 */
import * as THREE from 'three'

export interface IntroAnimState {
  /** 粒子聚集进度：0 = 银河，1 = 鹿角轮廓 */
  antlerProgress: number
  /** 粒子显现：0 = 黑场不可见，1 = 全亮 */
  reveal: number
  /** 第一幕导星强度（唯一可见的星光） */
  loneStar: number
  /** 化成星光时的亮度脉冲（0 → 1 → 0） */
  flash: number
  /** 银河/星云浮现强度（第五幕） */
  nebula: number
  /** Finale 解体飞散强度（0 → 1） */
  dissolve: number
  /** 相机基础 z（呼吸动画在其上叠加） */
  cameraZ: number
  /** 相机 y 偏移（最终下落，进入主页） */
  cameraY: number
  /** 径向运动模糊强度（0 → 1） */
  motionBlur: number
  /** 中心镜头眩光强度（0 → 1） */
  flare: number
}

/** 全局唯一动画状态实例（单例，供 GSAP 与 WebGL 共享） */
export const introState: IntroAnimState = {
  antlerProgress: 0,
  reveal: 1,
  loneStar: 0,
  flash: 0,
  nebula: 1,
  dissolve: 0,
  cameraZ: 8,
  cameraY: 0,
  motionBlur: 0,
  flare: 0,
}

/** 鼠标/触摸状态（世界坐标，z=0 平面），由 UniverseScene 维护 */
export const pointerState = {
  /** 当前指针世界坐标（z=0 平面投影） */
  world: new THREE.Vector2(0, 0),
  /** 平滑后的坐标（useFrame 中 lerp） */
  smooth: new THREE.Vector2(0, 0),
  /** 指针是否处于激活状态 */
  active: false,
  /** 吸引强度（ENTER 出现后由 GSAP 打开） */
  attract: 0,
}
