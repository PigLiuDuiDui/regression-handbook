/**
 * Galaxy —— 程序化真实星系（核心 WebGL 层）
 *
 * 天文结构（全部程序生成）：
 *  - Bulge（核球）：中心高斯隆起 + 独立 HDR 软核平面，过曝烧白
 *  - Galactic Bar（棒）：贯穿核球的椭长结构
 *  - Spiral Arms（旋臂）：对数螺旋 + 多层噪声扰动（非规则密度波）
 *  - Halo（银晕）：稀疏球壳恒星
 *  - HII Region（电离氢区）：旋臂上的粉色发射节点
 *  - Star Cluster（年轻星团）：旋臂密度波中的团块
 *
 * 动力学：
 *  - 差速旋转（中心快、外围慢）：角速度 ∝ r^-0.5（Kepler 近似）
 *  - 真实恒星光谱 O B A F G K M，大小幂律（绝大多数 < 1px）
 *  - 亮度随机闪烁、真实距离感
 *
 * 核球过曝：不靠逐粒子堆叠（会闪烁不自然），而是一个随半径高斯衰减的
 * 软核 HDR 贡献叠加在亮星上，让中心"烧白"并向 HDR Bloom 溢出。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { introState, pointerState } from './introState'
import { INTRO_CONFIG } from '../config/intro.config'
import { SPECTRAL_CLASSES } from '../lib/constants'
import { GLSL_NOISE } from './glsl/noise.glsl.ts'

/* ------------------------------------------------------------------ */
/* 几何生成（CPU：一次性布局散射点）                                   */
/* ------------------------------------------------------------------ */

const TWO_PI = Math.PI * 2
/** 星系整体尺度（世界单位） */
const GALAXY_RADIUS = 7.2
/** 旋臂数量 */
const ARM_COUNT = 2
/** 对数螺旋紧致度 */
const ARM_TIGHTNESS = 2.35
/** 旋臂初始角偏移 */
const ARM_OFFSET = Math.PI * 0.5

/** 可复现伪随机 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 近似高斯随机（4 次和，CLT），范围约 [-1,1] */
function gauss(rng: () => number): number {
  return (rng() + rng() + rng() + rng()) / 2 - 1
}

/** 按光谱权重采样一个光谱类索引 */
const SPEC_CDF: number[] = (() => {
  const total = SPECTRAL_CLASSES.reduce((s, c) => s + c.weight, 0)
  let acc = 0
  return SPECTRAL_CLASSES.map((c) => (acc += c.weight / total))
})()
function sampleSpectral(rng: () => number): number {
  const r = rng()
  for (let i = 0; i < SPEC_CDF.length; i++) if (r <= SPEC_CDF[i]) return i
  return SPEC_CDF.length - 1
}

interface GalaxyBuffers {
  positions: Float32Array
  aSpectrum: Float32Array
  aRank: Float32Array
  aRegion: Float32Array
  aRadius: Float32Array
  aAngle: Float32Array
  aSeed: Float32Array
  aZ: Float32Array
  aBase: Float32Array
}

function buildGalaxy(count: number): GalaxyBuffers {
  const rng = mulberry32(20260813)

  const positions = new Float32Array(count * 3)
  const aSpectrum = new Float32Array(count)
  const aRank = new Float32Array(count)
  const aRegion = new Float32Array(count)
  const aRadius = new Float32Array(count)
  const aAngle = new Float32Array(count)
  const aSeed = new Float32Array(count)
  const aZ = new Float32Array(count)
  const aBase = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const seed = rng()
    aSeed[i] = seed

    const roll = rng()
    let region: number
    if (roll < 0.1) region = 0        // bulge
    else if (roll < 0.19) region = 1  // bar
    else if (roll < 0.7) region = 2   // arm
    else if (roll < 0.87) region = 3  // halo
    else if (roll < 0.93) region = 4  // hii
    else region = 5                   // cluster
    aRegion[i] = region

    let radius = 0
    let angle = 0
    let z = 0

    if (region === 0) {
      // Bulge：三轴椭球（扁球），中心致密高斯
      radius = Math.abs(gauss(rng)) * GALAXY_RADIUS * 0.17
      radius *= 1.0 + Math.abs(gauss(rng)) * 0.5 // 中心更密
      angle = rng() * TWO_PI
      z = gauss(rng) * GALAXY_RADIUS * 0.06 * (1.0 - radius / (GALAXY_RADIUS * 0.2))
    } else if (region === 1) {
      // Bar：沿 x 轴的椭长结构（真实棒旋星系）
      const t = (rng() - 0.5) * 2
      radius = Math.abs(t) * GALAXY_RADIUS * 0.4
      angle = t >= 0 ? 0 : Math.PI
      z = gauss(rng) * GALAXY_RADIUS * 0.035
    } else if (region === 2 || region === 4 || region === 5) {
      // 旋臂（arm / hii / cluster 都挂在旋臂上）
      const arm = Math.floor(rng() * ARM_COUNT)
      const armBase = arm * (TWO_PI / ARM_COUNT) + ARM_OFFSET
      // 半径：旋臂从内圈延伸到外圈，中心更密（密度波）
      radius = Math.pow(rng(), 0.58) * GALAXY_RADIUS
      // 对数螺旋角
      const spiral = radius * ARM_TIGHTNESS * 0.18
      // 旋臂角向厚度：内圈窄、外圈略宽
      const armWidth = 0.1 + radius * 0.05
      const jitter = gauss(rng) * armWidth
      // 大尺度蜿蜒扰动（多层，让旋臂非规则密度波）
      const wave =
        Math.sin(radius * 1.6 + arm * 2.1) * 0.14 +
        Math.sin(radius * 3.4 + arm * 1.3 + seed * 6.28) * 0.05
      angle = armBase + spiral + jitter + wave
      z = gauss(rng) * (0.05 + radius * 0.03)
      if (region === 4) {
        // HII：旋臂上的局部团块，更靠臂、更亮
        angle += gauss(rng) * 0.04
        radius *= 0.9 + rng() * 0.2
        z *= 0.6
      }
      if (region === 5) {
        // Cluster：旋臂上的年轻星团，密集小范围
        const cl = rng() * TWO_PI
        const cr = 0.03 + rng() * 0.1
        angle += Math.cos(cl) * cr
        radius += Math.sin(cl) * cr
        z *= 0.4
      }
    } else {
      // Halo：球壳，稀疏（真实银晕，老恒星）
      radius = Math.pow(rng(), 0.5) * GALAXY_RADIUS * 1.15
      const phi = Math.acos(2 * rng() - 1)
      const theta = rng() * TWO_PI
      const r = radius
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.55
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.6
      aRadius[i] = radius
      aAngle[i] = theta
      aZ[i] = positions[i * 3 + 1]
      aBase[i * 3] = positions[i * 3]
      aBase[i * 3 + 1] = positions[i * 3 + 1]
      aBase[i * 3 + 2] = positions[i * 3 + 2]
      const sp = rng() < 0.7 ? (rng() < 0.6 ? 5 : 6) : sampleSpectral(rng)
      aSpectrum[i] = sp
      aRank[i] = Math.pow(rng(), 2.4)
      continue
    }

    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = z
    positions[i * 3 + 2] = Math.sin(angle) * radius
    aRadius[i] = radius
    aAngle[i] = angle
    aZ[i] = z

    // 光谱：旋臂/核区偏热（蓝白），外周偏冷（红）
    let sp = sampleSpectral(rng)
    const tNorm = radius / GALAXY_RADIUS
    const blueBias = (1 - tNorm) * (region === 4 || region === 5 ? 1 : 0.6)
    if (rng() < blueBias * 0.5) sp = Math.min(3, sp)
    aSpectrum[i] = sp

    // 幂律星等：绝大多数暗（<1px），极少数超亮
    let rank = Math.pow(rng(), 3.2)
    if (region === 0 || region === 1) rank = Math.max(rank, Math.pow(rng(), 1.5) * 0.92)
    if (region === 4) rank = Math.max(rank, 0.5 + rng() * 0.45)
    aRank[i] = rank
  }

  return {
    positions,
    aSpectrum,
    aRank,
    aRegion,
    aRadius,
    aAngle,
    aSeed,
    aZ,
    aBase,
  }
}

/* ------------------------------------------------------------------ */
/* 着色器                                                              */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = /* glsl */ `
  precision highp float;

  #define GAL_RADIUS 7.2

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uReveal;
  uniform float uDissolve;
  uniform float uRotation;
  uniform float uExposureBoost;
  uniform vec2  uMouse;
  uniform float uAttract;
  uniform float uAttractRadius;
  uniform float uAttractStrength;

  attribute float aSpectrum;
  attribute float aRank;
  attribute float aRegion;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSeed;
  attribute float aZ;
  attribute vec3 aBase;

  varying float vRank;
  varying float vSpectrum;
  varying float vRegion;
  varying float vSeed;
  varying float vAlpha;
  varying float vCoreGlow;

  ${GLSL_NOISE}

  void main() {
    float seed = aSeed;
    float radius = aRadius;

    // ---- 差速旋转：角速度 ∝ 1/sqrt(r + core) → 中心快、外围慢（Kepler 近似） ----
    float omega = uRotation * (1.0 / sqrt(radius + 0.45));
    float ang = aAngle + omega;

    vec3 pos = vec3(cos(ang) * radius, aZ, sin(ang) * radius);

    // Halo：球壳真实位置，绕 Y 轴缓慢整体自转
    float isHalo = step(2.5, aRegion) * step(aRegion, 3.5);
    float haloAng = uRotation * 0.18;
    mat2 rotY = mat2(cos(haloAng), -sin(haloAng), sin(haloAng), cos(haloAng));
    vec2 rxz = rotY * aBase.xz;
    vec3 haloPos = vec3(rxz.x, aBase.y, rxz.y);
    pos = mix(pos, haloPos, isHalo);

    // 旋臂上的微扰流动（旋臂"呼吸/翻涌"，非刚性旋转）
    float n = fbm2(vec2(radius * 1.4 + uTime * 0.02, ang * 2.0));
    float armMask = step(1.5, aRegion) * step(aRegion, 2.5);
    pos.x += n * 0.06 * armMask;
    pos.z += n * 0.06 * armMask;

    // ---- 鼠标吸引 ----
    vec2 toMouse = uMouse - pos.xz;
    float dist = length(toMouse);
    float att = smoothstep(uAttractRadius, 0.0, dist) * uAttract;
    pos.xz += normalize(toMouse + vec2(1e-4)) * att * uAttractStrength;

    // ---- 解体淡出 ----
    float isDissolve = uDissolve;
    if (isDissolve > 0.001) {
      vec3 dirOut = normalize(pos + vec3(hash11(seed*3.1)-0.5, hash11(seed*7.7)-0.5, hash11(seed*11.3)*0.9+0.35));
      pos += dirOut * 11.0 * isDissolve * isDissolve * (0.35 + seed*0.9);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // ---- 大小：幂律，绝大多数 < 1px ----
    float baseSize = uSize * (0.32 + pow(aRank, 2.6) * 6.5);
    baseSize *= mix(1.0, 1.4, step(aRegion, 1.5));
    float ps = baseSize * uPixelRatio * (760.0 / max(-mv.z, 0.1));
    gl_PointSize = clamp(ps, 0.6, 90.0);

    // ---- 核球 HDR 过曝贡献（高斯软核，随曝光增强） ----
    float core = exp(-radius * radius / (GAL_RADIUS * GAL_RADIUS * 0.045));
    vCoreGlow = core * uExposureBoost;

    float alpha = uReveal * (0.5 + aRank * 0.6);
    alpha *= mix(0.7, 1.0, step(1.5, aRegion));
    alpha *= (1.0 - isDissolve);
    vAlpha = clamp(alpha, 0.0, 1.5);

    vRank = aRank;
    vSpectrum = aSpectrum;
    vRegion = aRegion;
    vSeed = seed;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uFlash;
  uniform float uHiiGlow;
  uniform vec3 uSpectrum[7];
  uniform float uDiag;

  varying float vRank;
  varying float vSpectrum;
  varying float vRegion;
  varying float vSeed;
  varying float vAlpha;
  varying float vCoreGlow;

  float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }

  void main() {
    if (uDiag > 0.5) { gl_FragColor = vec4(1.0); return; }

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    // 真实恒星：极小核 + 软光晕
    float disc = smoothstep(0.5, 0.05, d);
    float halo = smoothstep(0.5, 0.0, d) * (0.06 + vRank * 0.12);

    // 亮星衍射星芒（仅高星等）
    float spikeMask = smoothstep(0.8, 0.96, vRank);
    float sx = pow(max(1.0 - abs(uv.x)*3.0, 0.0), 12.0) * exp(-abs(uv.y)*9.0);
    float sy = pow(max(1.0 - abs(uv.y)*3.0, 0.0), 12.0) * exp(-abs(uv.x)*9.0);
    float dx = pow(max(1.0 - abs(uv.x+uv.y)*2.1, 0.0), 14.0);
    float dy = pow(max(1.0 - abs(uv.x-uv.y)*2.1, 0.0), 14.0);
    float spike = (sx + sy) * 0.9 + (dx + dy) * 0.35;
    spike *= spikeMask;

    int sp = int(vSpectrum + 0.5);
    vec3 col = uSpectrum[sp];

    // HII region：粉色发射节点
    float hii = step(3.5, vRegion) * step(vRegion, 4.5);
    col = mix(col, vec3(1.0, 0.42, 0.55), hii * 0.7);
    halo += hii * uHiiGlow * smoothstep(0.5, 0.0, d);

    // 闪烁
    float twAmp = (0.18 - vRank * 0.12);
    float twSpeed = 0.5 + hash11(vSeed*3.7) * 1.2;
    float tw = 1.0 - twAmp + twAmp * sin(uTime * twSpeed + vSeed * 628.3);
    tw = mix(tw, 0.97 + 0.03*sin(uTime*0.6 + vSeed*157.0), spikeMask);

    float glow = disc + halo + spike;
    col *= glow * tw;

    // 核球过曝叠加（HDR，中心烧白 → 溢出 Bloom）
    col += vCoreGlow * vec3(1.0, 0.92, 0.78) * 2.2;

    col *= (1.0 + uFlash * 0.8);

    float a = (disc + halo * 0.4 + spike * 0.6) * clamp(vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

interface GalaxyProps {
  count: number
}

function diagModeEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('diag') === '1'
  } catch {
    return false
  }
}

export function Galaxy({ count }: GalaxyProps) {
  const diagMode = useMemo(diagModeEnabled, [])

  const { geometry, material } = useMemo(() => {
    const b = buildGalaxy(count)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
    geo.setAttribute('aSpectrum', new THREE.BufferAttribute(b.aSpectrum, 1))
    geo.setAttribute('aRank', new THREE.BufferAttribute(b.aRank, 1))
    geo.setAttribute('aRegion', new THREE.BufferAttribute(b.aRegion, 1))
    geo.setAttribute('aRadius', new THREE.BufferAttribute(b.aRadius, 1))
    geo.setAttribute('aAngle', new THREE.BufferAttribute(b.aAngle, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(b.aSeed, 1))
    geo.setAttribute('aZ', new THREE.BufferAttribute(b.aZ, 1))
    geo.setAttribute('aBase', new THREE.BufferAttribute(b.aBase, 3))

    const spectrumColors = SPECTRAL_CLASSES.map(
      (c) => new THREE.Color(c.color[0], c.color[1], c.color[2]),
    )

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: INTRO_CONFIG.particles.baseSize },
        uReveal: { value: 1 },
        uDissolve: { value: 0 },
        uRotation: { value: 0 },
        uExposureBoost: { value: 1.0 },
        uFlash: { value: 0 },
        uHiiGlow: { value: 0.6 },
        uMouse: { value: new THREE.Vector2() },
        uAttract: { value: 0 },
        uAttractRadius: { value: INTRO_CONFIG.mouse.attractRadius },
        uAttractStrength: { value: INTRO_CONFIG.mouse.attractStrength },
        uSpectrum: { value: spectrumColors },
        uDiag: { value: diagMode ? 1 : 0 },
      },
    })

    let lastT = performance.now()
    mat.onBeforeRender = (renderer) => {
      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.1)
      lastT = now

      const u = mat.uniforms
      // 动态读取实际渲染 DPR（对齐 R3F 的 dpr 设置，避免高 DPR 屏幕粒子过大）
      u.uPixelRatio.value = (renderer as THREE.WebGLRenderer).getPixelRatio()
      u.uTime.value = now / 1000
      u.uRotation.value += dt * 0.07
      u.uReveal.value = introState.reveal
      u.uDissolve.value = introState.dissolve
      u.uFlash.value = introState.flash
      u.uExposureBoost.value =
        1.0 + introState.bulgeBoost * 1.5 + Math.max(0, 1.0 - introState.cameraZ / 6) * 0.7

      const k = 1 - Math.pow(1 - INTRO_CONFIG.mouse.smooth, dt * 60)
      pointerState.smooth.lerp(pointerState.world, k)
      u.uMouse.value.set(pointerState.smooth.x, pointerState.smooth.y)
      u.uAttract.value = pointerState.attract
    }

    return { geometry: geo, material: mat }
  }, [count])

  return (
    <group rotation={[-0.62, 0, 0]}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
