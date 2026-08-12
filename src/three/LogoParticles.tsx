/**
 * LogoParticles —— Logo 解体粒子
 *
 * 点击 ENTER 时，把 DOM 层的 Logo（HEESEUNG / 小鹿园）"翻译"成真实 3D 粒子：
 *   1. 离屏 Canvas 用与 DOM 完全一致的字体渲染 Logo
 *   2. 逐像素采样，不透明像素 → 世界坐标（z=0 平面，与 DOM 视觉对齐）
 *   3. uBurst 0 → 1（GSAP 驱动）：粒子从 Logo 位置向四周 + 朝向相机飞散，
 *      同时淡出 —— 全程无 Fade，纯粒子 Transition
 *
 * 粒子数由采样步长决定（≈2k~4k），几何体在组件挂载时一次性生成。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { introState } from './introState'

/* ------------------------------------------------------------------ */
/* Shader                                                              */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uBurst;      // 0 = 静止在 Logo, 1 = 完全飞散
  uniform float uOpacity;    // 整体透明度
  uniform float uPixelRatio;

  attribute float aSeed;

  varying float vAlpha;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vec3 pos = position;
    float seed = aSeed;

    // 飞散方向：径向向外 + 随机扰动 + 偏向相机（z+）
    float b = uBurst;
    vec3 dir = normalize(
      pos + vec3(
        (hash(seed * 3.1) - 0.5) * 1.6,
        (hash(seed * 7.7) - 0.5) * 1.6,
        hash(seed * 11.3) * 1.2 + 0.55
      )
    );
    pos += dir * 9.5 * b * (0.35 + hash(seed * 2.1) * 1.0);
    // 轻微上浮（尘埃感）
    pos.y += b * 0.5;
    // 微弱的自转尾迹
    float swirl = uTime * (0.6 + hash(seed) * 1.6) * b;
    pos.x += sin(swirl) * b * 0.15;
    pos.y += cos(swirl) * b * 0.15;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = 0.016 * (0.7 + hash(seed * 5.7) * 0.9) * uPixelRatio * (760.0 / -mv.z);
    gl_PointSize = clamp(size, 1.0, 56.0);

    // 飞散中淡出（b=1 时完全消失）
    vAlpha = (1.0 - b) * uOpacity;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float disc = smoothstep(0.5, 0.18, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.18;
    // 纯白微光（不出现第二种颜色，克制）
    vec3 col = vec3(1.0) * (disc + halo);
    gl_FragColor = vec4(col, (disc + halo * 0.4) * vAlpha);
  }
`

/* ------------------------------------------------------------------ */
/* 采样生成                                                            */
/* ------------------------------------------------------------------ */

/** 世界坐标中 Logo 的宽度（与 DOM 视觉比例对应） */
const LOGO_WORLD_WIDTH = 6.6
const SAMPLE_STEP = 4 // 采样步长（px）：越小粒子越多

function buildLogoParticles(): {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
} {
  // ---- 离屏 Canvas 渲染 Logo（与 DOM 相同字体） ----
  const W = 1024
  const H = 192
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'

  // 主标题：Cinzel 900
  ctx.font = '900 100px "Cinzel", serif'
  ctx.letterSpacing = '14px'
  ctx.fillText('HEESEUNG', W / 2, 72)

  // 副标题：思源宋体 / Noto Serif SC 900
  ctx.font = '900 32px "Noto Serif SC", serif'
  ctx.letterSpacing = '12px'
  ctx.fillText('小鹿园', W / 2, 140)

  // ---- 像素采样 → 世界坐标 ----
  const image = ctx.getImageData(0, 0, W, H)
  const logoWorldHeight = LOGO_WORLD_WIDTH * (H / W)
  const pts: number[] = []
  const seeds: number[] = []

  for (let py = 0; py < H; py += SAMPLE_STEP) {
    for (let px = 0; px < W; px += SAMPLE_STEP) {
      const alpha = image.data[(py * W + px) * 4 + 3]
      if (alpha > 128) {
        // 翻转 y（canvas 向下，世界向上），并让 Logo 内容中心对齐原点
        pts.push(
          (px / W - 0.5) * LOGO_WORLD_WIDTH,
          (0.5 - py / H) * logoWorldHeight + 0.05,
          0,
        )
        seeds.push(Math.random())
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seeds), 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
  })

  return { geometry, material }
}

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

export function LogoParticles() {
  const { geometry, material } = useMemo(() => {
    const built = buildLogoParticles()
    // 每帧渲染前同步解体状态 → uniform。
    // 注意：不用 useFrame+ref（StrictMode 双挂载下 ref 与渲染实例可能错位），
    // onBeforeRender 挂在 material 上，渲染它时必然执行。
    const mat = built.material
    let lastT = 0
    mat.onBeforeRender = (_r, _s, _c, _g, _m, group) => {
      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.1)
      lastT = now

      const u = mat.uniforms
      u.uTime.value += dt
      u.uBurst.value = introState.dissolve
      u.uOpacity.value = Math.min(1, introState.dissolve * 4) * (1 - introState.dissolve * 0.35)

      // ENTER 触发解体时自动显现（无需外部控制）
      if (group) group.visible = introState.dissolve > 0.001
    }
    return built
  }, [])

  return (
    <points geometry={geometry} material={material} visible={false} frustumCulled={false} />
  )
}
