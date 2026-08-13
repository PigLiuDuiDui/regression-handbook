/**
 * Forest —— 暗夜星空 · 森林场景（极简版）
 *
 * 构成：
 *  - Stars（星空点缀）：稀疏星星，柔和微光，随机闪烁
 *  - Trees（树影）：深色树形剪影作为森林前景
 *  - Mist（薄雾）：FBM 噪声柔和雾层
 *
 * 保留交互：CameraRig 拖拽旋转/滚轮缩放/双击复位不变。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { introState } from './introState'
import { GLSL_NOISE } from './glsl/noise.glsl.ts'

/* ------------------------------------------------------------------ */
/* 星空点缀（稀疏星星 + 柔和微光）                                      */
/* ------------------------------------------------------------------ */

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

const STAR_VERT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aSeed;
  attribute float aScale;
  varying float vSeed;
  varying float vScale;
  void main() {
    vSeed = aSeed;
    vScale = aScale;
    vec3 pos = position;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float ps = uSize * aScale * uPixelRatio * (600.0 / max(-mv.z, 0.1));
    gl_PointSize = clamp(ps, 1.0, 80.0);
  }
`

const STAR_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying float vSeed;
  varying float vScale;
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // 星星：细小核 + 极柔和光晕
    float core = 1.0 - smoothstep(0.0, 0.15, d);
    float halo = (1.0 - smoothstep(0.0, 0.5, d)) * 0.4;
    // 随机闪烁（缓慢、轻柔，避免刺眼）
    float tw = 0.75 + 0.25 * sin(uTime * (0.4 + vSeed * 1.0) + vSeed * 628.0);
    // 星星颜色：冷暖混合（多数暖白，少数冷蓝白）
    float cool = step(0.75, hash11(vSeed * 3.1));
    vec3 col = mix(vec3(1.0, 0.96, 0.88), vec3(0.85, 0.9, 1.0), cool);
    float a = (core + halo) * tw * (0.85 + vScale * 0.8);
    gl_FragColor = vec4(col * a * 2.0, a);
  }
`

/* ------------------------------------------------------------------ */
/* 树剪影（深色树形轮廓）                                              */
/* ------------------------------------------------------------------ */

const TREE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const TREE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;
  ${GLSL_NOISE}
  void main() {
    vec2 p = vUv;
    // 树干：按 x 分段成多棵树
    float trunk = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float cx = (fi + 0.5) / 5.0 + (hash11(fi * 3.7 + uSeed) - 0.5) * 0.18;
      float tx = p.x - cx;
      float tw = 0.018 + hash11(fi * 7.1 + uSeed) * 0.028;
      trunk += (1.0 - smoothstep(tw, tw * 2.5, abs(tx))) * (1.0 - smoothstep(0.0, 0.95, p.y));
    }
    // 树冠：顶部 fbm 噪声团块
    float canopy = fbm2(p * 2.6 + uSeed * 7.7);
    canopy *= smoothstep(0.0, 0.85, p.y) * (1.0 - smoothstep(0.85, 1.0, p.y));
    canopy = smoothstep(0.38, 0.82, canopy);
    float tree = max(trunk * 1.2, canopy * 0.9);
    // 深色树影（极深绿）
    vec3 col = vec3(0.015, 0.04, 0.025);
    gl_FragColor = vec4(col, tree);
  }
`

/* ------------------------------------------------------------------ */
/* 薄雾                                                                */
/* ------------------------------------------------------------------ */

const MIST_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const MIST_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  uniform vec3 uColA;
  uniform vec3 uColB;
  ${GLSL_NOISE}
  void main() {
    vec2 p = vWorld.xy * 0.1 + uSeed * 13.7;
    float flow = uTime * 0.012;
    vec2 warp = domainWarp2v(p * 0.5 + flow);
    float mist = fbm2(p * 1.1 + warp * 0.8);
    mist = mist * 0.6 + 0.4;
    float height = 1.0 - smoothstep(-1.2, 1.0, vWorld.y * 0.6);
    mist *= height;
    float mask = smoothstep(0.48, 1.0, mist);
    mask *= smoothstep(0.15, 0.6, fbm2(p * 2.2 + 2.0) + 0.3);
    float hue = fbm2(p * 0.6 + 9.0) * 0.5 + 0.5;
    vec3 col = mix(uColA, uColB, hue);
    float alpha = mask * uOpacity;
    alpha = pow(alpha, 1.3);
    gl_FragColor = vec4(col * (0.4 + mist * 0.7), alpha);
  }
`

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

export function Forest() {
  const { stars, trees, mist } = useMemo(() => {
    // ---- 星空点缀 ----
    const rng = mulberry32(20260813)
    // 全穹顶球壳均匀分布：相机旋转到任何角度，星星都铺满屏幕；
    // 数量克制（稀疏星野，宁可少而干净，不要多而拥挤）
    const COUNT = 320
    const positions = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    const scales = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      // 球面均匀采样（acos 修正两极聚集）
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      const r = 10 + rng() * 14
      positions[i * 3] = Math.cos(theta) * Math.sin(phi) * r
      positions[i * 3 + 1] = Math.cos(phi) * r
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r
      seeds[i] = rng()
      scales[i] = 0.5 + Math.pow(rng(), 2.5) * 1.8
    }
    const sgeo = new THREE.BufferGeometry()
    sgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    sgeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    sgeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    const smat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: 0.045 },
      },
    })
    smat.onBeforeRender = (renderer) => {
      smat.uniforms.uTime.value = performance.now() / 1000
      smat.uniforms.uPixelRatio.value = (renderer as THREE.WebGLRenderer).getPixelRatio()
    }
    const starMesh = new THREE.Points(sgeo, smat)
    starMesh.frustumCulled = false

    // ---- 树影层（仅下半部，不挡夜空） ----
    const treeGroup = new THREE.Group()
    const treeDefs = [
      { pos: [0, -4.5, -4] as [number, number, number], size: [22, 7] as [number, number], seed: 0.2 },
      { pos: [0, -4.0, -7] as [number, number, number], size: [28, 8] as [number, number], seed: 0.65 },
    ]
    for (const d of treeDefs) {
      const tmat = new THREE.ShaderMaterial({
        vertexShader: TREE_VERT,
        fragmentShader: TREE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uSeed: { value: d.seed },
        },
      })
      const tm = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]), tmat)
      tm.position.set(...d.pos)
      tm.renderOrder = 2
      treeGroup.add(tm)
    }

    // ---- 薄雾 ----
    const mistGroup = new THREE.Group()
    const mistDefs = [
      { pos: [0, -2.4, -6] as [number, number, number], size: [24, 9] as [number, number], seed: 0.31, a: '#c8d5d8', b: '#f8f3e8' },
      { pos: [0, -1.8, -10] as [number, number, number], size: [30, 11] as [number, number], seed: 0.74, a: '#c8d5d8', b: '#16231c' },
    ]
    for (const d of mistDefs) {
      const mmat = new THREE.ShaderMaterial({
        vertexShader: MIST_VERT,
        fragmentShader: MIST_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSeed: { value: d.seed },
          uColA: { value: new THREE.Color(d.a) },
          uColB: { value: new THREE.Color(d.b) },
        },
      })
      mmat.onBeforeRender = () => {
        mmat.uniforms.uTime.value = performance.now() / 1000
        mmat.uniforms.uOpacity.value = 0.14 * introState.nebula
      }
      const mm = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]), mmat)
      mm.position.set(...d.pos)
      mm.renderOrder = 3
      mistGroup.add(mm)
    }

    return { stars: starMesh, trees: treeGroup, mist: mistGroup }
  }, [])

  return (
    <group>
      <primitive object={stars} dispose={null} />
      <primitive object={trees} dispose={null} />
      <primitive object={mist} dispose={null} />
    </group>
  )
}