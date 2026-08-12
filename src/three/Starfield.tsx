/**
 * Starfield —— 银河粒子系统（核心 WebGL 层）
 *
 * 粒子全部在 GPU 顶点着色器中完成位置合成，CPU 每帧零开销：
 *
 *   galaxy（螺旋银河，随时间自转 + 漂移）
 *      │  uAntlerProgress（GSAP 驱动）
 *      ▼
 *   antler（鹿角轮廓目标，粒子带随机延迟 → 点 → 线 → 面 → 轮廓）
 *      │  uDissolve（Finale：解体飞散）
 *      ▼
 *   burst（向四周 + 朝向相机飞散）
 *
 * 三类粒子（aKind）：
 *   0 = 星点   ：参加鹿角聚集，近景 / 中景 / 远景按 z 分布
 *   1 = 尘埃   ：沿臂的云雾带，始终留在背景漂移，uNebula 控制浮现
 *   2 = 导星   ：唯一一颗亮星，第一幕黑场中独自闪烁
 *
 * 色板为冷暖三段（暖金白 → 纯白 → 冷蓝白，见 INTRO_CONFIG.particles.palette），
 * 大小按幂律分布：85% 细碎暗星 + 5% 大而亮的亮星（光晕 + 星芒）→ 星河层次感。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { buildAntlerSkeleton } from './antler'
import { introState, pointerState } from './introState'
import { INTRO_CONFIG } from '../config/intro.config'

/* ------------------------------------------------------------------ */
/* Shader                                                              */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uAntlerProgress; // 0 = 银河, 1 = 鹿角
  uniform float uReveal;         // 0 = 黑场, 1 = 全亮
  uniform float uLoneStar;       // 第一幕导星强度
  uniform float uFlash;          // 化成星光脉冲
  uniform float uNebula;         // 星云浮现（尘埃层）
  uniform float uDissolve;       // Finale 解体飞散
  uniform float uSpin;           // 银河自转速度
  uniform float uDrift;          // 粒子漂移幅度
  uniform vec2  uMouse;          // 平滑指针（世界坐标）
  uniform float uAttract;        // 吸引开关强度
  uniform float uAttractRadius;  // 吸引半径
  uniform float uAttractStrength;// 吸引位移

  attribute vec3  aAntler;       // 鹿角目标位置
  attribute float aSeed;         // 随机种子
  attribute float aKind;         // 0 星点 / 1 尘埃 / 2 导星

  varying float vAlpha;
  varying float vColorMix;
  varying float vKind;
  varying float vSeed; // 粒子种子（闪烁独立相位）
  varying float vRank; // 大小排名（亮星判定）

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vec3 pos = position;
    float seed = aSeed;

    // ---- 银河自转（仅未聚集粒子） ----
    float rot = uTime * uSpin;
    float c = cos(rot);
    float s = sin(rot);
    pos.xy = mat2(c, -s, s, c) * pos.xy;

    // ---- 粒子漂移（微弱的宇宙风） ----
    pos += vec3(
      sin(uTime * 0.31 + seed * 6.2831) * uDrift,
      cos(uTime * 0.24 + seed * 9.4247) * uDrift,
      sin(uTime * 0.18 + seed * 12.566) * uDrift * 0.5
    );

    // ---- 聚集：粒子按各自延迟依次到达鹿角（点 → 线 → 面 → 轮廓） ----
    float delay = hash(seed * 1.731);
    float arrive = smoothstep(delay, 1.0, uAntlerProgress);
    pos = mix(pos, aAntler, arrive);

    // ---- 鼠标吸引（轻微） ----
    vec2 toMouse = uMouse - pos.xy;
    float dist = length(toMouse);
    float att = smoothstep(uAttractRadius, 0.0, dist) * uAttract;
    pos.xy += normalize(toMouse + vec2(1e-4)) * att * uAttractStrength;

    // ---- Finale 解体：从中心向四周 + 朝向相机飞散 ----
    float isStar = 1.0 - step(0.5, aKind); // 尘埃不参与解体
    if (uDissolve > 0.001 && isStar > 0.5) {
      vec3 center = vec3(0.0, 0.0, 0.0);
      vec3 dirOut = normalize(
        pos - center +
        vec3(hash(seed * 3.1) - 0.5, hash(seed * 7.7) - 0.5, hash(seed * 11.3) * 0.9 + 0.35)
      );
      float burst = uDissolve * uDissolve;
      pos += dirOut * 11.0 * burst * (0.35 + hash(seed) * 0.9);
    }

    // ---- MVP ----
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // ---- 大小：幂律分布（细碎暗星为主，少量亮星） ----
    // rank < 0.95：0.55~1.15 倍（暗星主体）；rank > 0.95：1.15~4.15 倍（亮星，前 5%）
    float sizeRank = hash(seed * 5.7);
    float sizeMul = mix(0.55, 1.15, smoothstep(0.0, 0.85, sizeRank));
    sizeMul = mix(sizeMul, 1.15 + pow(sizeRank, 6.0) * 3.0, step(0.95, sizeRank));
    // 尘埃：大而柔的云雾点（inline，避免与下方亮度段 dust 重名 → 重复声明编译失败）
    sizeMul = mix(
      sizeMul,
      1.6 + hash(seed * 3.3) * 1.2,
      step(0.5, aKind) * (1.0 - step(1.5, aKind))
    );
    float loneMul = 1.0 + step(1.5, aKind) * 2.2; // 导星更大
    gl_PointSize = uSize * sizeMul * loneMul * uPixelRatio * (760.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);

    // ---- 亮度 / 透明度 ----
    float lone = step(1.5, aKind);
    float dust = step(0.5, aKind) * (1.0 - lone);

    // 第一幕：仅导星可见；之后随 uReveal 全亮
    float base = uReveal * (1.0 - dust) + dust * uReveal * (0.25 + 0.75 * uNebula);
    base = max(base, lone * uLoneStar * 0.85);

    // 化成星光脉冲
    base *= 1.0 + uFlash * 1.5;

    // 解体时淡出
    base *= 1.0 - uDissolve * (1.0 - lone * 0.6);

    // 暗星略暗、亮星更亮（衬托层次）
    base *= 0.85 + sizeRank * 0.15;

    vAlpha = base;
    vColorMix = mix(0.12, 1.0, hash(seed * 2.37));
    vKind = aKind;
    vSeed = seed;
    vRank = sizeRank;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform vec3  uPaletteWarm; // 暖金白（亮星）
  uniform vec3  uPaletteMist; // 冷蓝白（暗星）
  uniform float uDiag; // 诊断：?diag=1 时粒子强制纯白满亮，区分 shader 逻辑与渲染管线问题

  varying float vAlpha;
  varying float vColorMix;
  varying float vKind;
  varying float vSeed;
  varying float vRank;

  void main() {
    if (uDiag > 0.5) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    // 软圆核 + 微光晕
    float disc = smoothstep(0.5, 0.14, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.2;

    // 星芒（十字亮线）
    float crossX = pow(max(1.0 - abs(uv.x) * 4.2, 0.0), 9.0) * step(abs(uv.y), 0.07);
    float crossY = pow(max(1.0 - abs(uv.y) * 4.2, 0.0), 9.0) * step(abs(uv.x), 0.07);
    float starCross = (crossX + crossY) * 0.4;

    // 亮星（前 5%）：光晕与星芒显著增强 → 星河里“发光的星星”
    float bright = smoothstep(0.93, 1.0, vRank);
    halo += bright * 1.1 * smoothstep(0.5, 0.0, d);
    starCross += bright * 1.4 * (crossX + crossY);

    // 导星：第一幕主角，纯白强光晕
    float lone = step(1.5, vKind);
    halo += lone * 0.8 * smoothstep(0.5, 0.0, d);
    starCross += lone * 0.6 * (crossX + crossY);

    // 冷暖三段色板：暖金白 → 纯白 → 冷蓝白（按种子插值，clamp 防外推）
    vec3 snow = vec3(1.0);
    float cm = clamp(vColorMix, 0.0, 1.0);
    vec3 base = mix(
      mix(uPaletteWarm, snow, clamp(cm * 2.0, 0.0, 1.0)),
      mix(snow, uPaletteMist, clamp(cm * 2.0 - 1.0, 0.0, 1.0)),
      step(0.5, cm)
    );
    // 亮星偏暖金，导星纯白
    base = mix(base, uPaletteWarm, bright * 0.55);
    base = mix(base, snow, lone * 0.85);

    // 独立闪烁：每颗星按种子错相位，亮星稳定、导星柔和
    float tw = 0.82 + 0.18 * sin(uTime * 1.35 + vSeed * 628.3);
    tw = mix(tw, 0.9 + 0.1 * sin(uTime * 0.9 + vSeed * 251.3), bright);
    tw = mix(tw, 0.72 + 0.28 * sin(uTime * 1.1 + vSeed * 314.15), lone);

    // 尘埃：柔雾点（软边）+ 暗
    float dust = step(0.5, vKind) * (1.0 - lone);
    disc = mix(disc, smoothstep(0.5, 0.0, d), dust);
    halo = mix(halo, smoothstep(0.5, 0.0, d) * 0.4, dust);

    float glow = disc + halo + starCross * (1.0 - dust * 0.8);
    vec3 col = base * glow * tw * (1.0 + uFlash * 0.85 * (1.0 - lone));
    col = mix(col, col * 0.5, dust);

    gl_FragColor = vec4(col, (disc + halo * 0.35) * vAlpha);
  }
`

/* ------------------------------------------------------------------ */
/* 几何生成                                                            */
/* ------------------------------------------------------------------ */

/**
 * 生成银河粒子几何体
 * - 星点（75%）：中心核球（22%，球状密集区）+ 三条窄螺旋臂（78%），内密外疏
 * - 尘埃（24.9%）：沿臂的云雾带，z 方向更分散 → 星云弥散感
 * - 导星（0.1%）：一颗近景亮星，第一幕独奏
 */
function buildGalaxyGeometry(count: number): THREE.BufferGeometry {
  const { galaxyArms, galaxyRadius, galaxyThickness } = INTRO_CONFIG.particles
  const skeleton = buildAntlerSkeleton()
  const skelCount = skeleton.length / 3

  const positions = new Float32Array(count * 3)
  const aAntler = new Float32Array(count * 3)
  const aSeed = new Float32Array(count)
  const aKind = new Float32Array(count)

  const rng = mulberry32(20260601) // 固定种子 → 每次刷新形状稳定

  for (let i = 0; i < count; i++) {
    const seed = rng()
    aSeed[i] = seed

    const roll = rng()
    const kind = roll < 0.75 ? 0 : roll < 0.999 ? 1 : 2
    aKind[i] = kind

    if (kind === 1) {
      // 尘埃：沿臂的云雾带（比星点宽 → 弥散感）
      const arm = Math.floor(rng() * galaxyArms)
      const armAngle = (arm / galaxyArms) * Math.PI * 2
      const r = galaxyRadius * (0.25 + rng() * 0.85)
      const spread = 0.55 + rng() * 0.75
      const angle = armAngle + (r / galaxyRadius) * 2.4 + (rng() - 0.5) * spread
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = (rng() - 0.5) * galaxyThickness * 2.2
      positions[i * 3 + 2] = Math.sin(angle) * r * 0.85 + (rng() - 0.5) * galaxyThickness * 2.0
    } else if (kind === 2) {
      // 导星：正前方近景，中心略偏上
      positions[i * 3] = (rng() - 0.5) * 0.06
      positions[i * 3 + 1] = 0.42 + (rng() - 0.5) * 0.05
      positions[i * 3 + 2] = 2.4
    } else {
      // 星点：中心核球（22%）+ 窄螺旋臂（78%）
      const isBulge = rng() < 0.22
      const arm = Math.floor(rng() * galaxyArms)
      const armAngle = (arm / galaxyArms) * Math.PI * 2
      const r = isBulge
        ? galaxyRadius * 0.3 * Math.pow(rng(), 0.5)          // 核球：半径 0~2.25，偏向中心
        : galaxyRadius * (0.3 + Math.pow(rng(), 0.75) * 0.7) // 臂：核球边缘到外缘，内密外疏
      const spread = isBulge ? 1.0 : 0.3 + rng() * 0.45      // 臂收窄 → 星河条带感
      const angle = isBulge
        ? rng() * Math.PI * 2
        : armAngle + (r / galaxyRadius) * 2.4 + (rng() - 0.5) * spread
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = (rng() - 0.5) * galaxyThickness * (isBulge ? 1.5 : 1.0)
      positions[i * 3 + 2] = Math.sin(angle) * r * (isBulge ? 1.0 : 0.9)
    }

    // 鹿角目标：星点随机采样骨架；尘埃/导星保持自身（不聚集）
    if (kind === 0) {
      const s = Math.floor(rng() * skelCount) * 3
      aAntler[i * 3] = skeleton[s]
      aAntler[i * 3 + 1] = skeleton[s + 1]
      aAntler[i * 3 + 2] = skeleton[s + 2]
    } else {
      aAntler[i * 3] = positions[i * 3]
      aAntler[i * 3 + 1] = positions[i * 3 + 1]
      aAntler[i * 3 + 2] = positions[i * 3 + 2]
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aAntler', new THREE.BufferAttribute(aAntler, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
  geometry.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1))
  return geometry
}

/** 可复现的伪随机数生成器（mulberry32） */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

interface StarfieldProps {
  /** 粒子总数（由设备性能档位决定） */
  count: number
}

/** 诊断模式：?diag=1 时粒子强制纯白满亮（用于区分 shader 逻辑与渲染管线问题） */
function diagModeEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('diag') === '1'
  } catch {
    return false
  }
}

export function Starfield({ count }: StarfieldProps) {
  const diagMode = useMemo(diagModeEnabled, [])

  const { geometry, material } = useMemo(() => {
    const geo = buildGalaxyGeometry(count)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: INTRO_CONFIG.particles.baseSize },
        uAntlerProgress: { value: 0 },
        uReveal: { value: 0 },
        uLoneStar: { value: 0 },
        uFlash: { value: 0 },
        uNebula: { value: 0 },
        uDissolve: { value: 0 },
        uSpin: { value: INTRO_CONFIG.particles.galaxySpin },
        uDrift: { value: INTRO_CONFIG.particles.driftAmplitude },
        uMouse: { value: new THREE.Vector2() },
        uAttract: { value: 0 },
        uAttractRadius: { value: INTRO_CONFIG.mouse.attractRadius },
        uAttractStrength: { value: INTRO_CONFIG.mouse.attractStrength },
        uPaletteWarm: { value: new THREE.Color(INTRO_CONFIG.particles.palette.warm) },
        uPaletteMist: { value: new THREE.Color(INTRO_CONFIG.particles.palette.mist) },
        uDiag: { value: diagMode ? 1 : 0 },
      },
    })
    // 每帧渲染前同步动画状态 → uniform。
    // 注意：不用 useFrame+ref（StrictMode 双挂载下 ref 与渲染实例可能错位），
    // onBeforeRender 是挂在 material 本身上的 three 原生回调，渲染它时必然执行。
    let lastT = 0
    mat.onBeforeRender = () => {
      const now = performance.now()
      const delta = Math.min((now - lastT) / 1000, 0.1)
      lastT = now

      const u = mat.uniforms
      u.uTime.value = now / 1000
      u.uAntlerProgress.value = introState.antlerProgress
      u.uReveal.value = introState.reveal
      u.uFlash.value = introState.flash
      u.uNebula.value = introState.nebula
      u.uDissolve.value = introState.dissolve

      // 粒子大小随相机距离动态补偿（透视抵消）：
      // 相机拉远（主页 z=14）时粒子不缩成针尖，推进（finale z=1.35）时不胀满屏
      u.uSize.value =
        INTRO_CONFIG.particles.baseSize *
        (introState.cameraZ / INTRO_CONFIG.act2.cameraStartZ)

      // 导星强度：第一幕独奏（由 Intro Timeline 驱动）
      u.uLoneStar.value = introState.loneStar

      // 指针平滑（帧率无关的 lerp）
      const k = 1 - Math.pow(1 - INTRO_CONFIG.mouse.smooth, delta * 60)
      pointerState.smooth.lerp(pointerState.world, k)
      u.uMouse.value.set(pointerState.smooth.x, pointerState.smooth.y)
      u.uAttract.value = pointerState.attract
    }

    return { geometry: geo, material: mat }
  }, [count])

  return (
    <group rotation={[-0.07, 0, 0]}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
