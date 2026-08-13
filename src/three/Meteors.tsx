/**
 * Meteors —— 电影级流星系统
 *
 * 每颗流星包含（一条连续拉伸 billboard 上 shader 生成）：
 *  - 发光核心（亮白、HDR，头部）
 *  - Bloom（由全局 Bloom 后处理自然产生）
 *  - 蓝色离子尾（电离层发光，中段，青蓝，随尾流衰减）
 *
 * 设计克制：细直线丝光 —— 只保留“亮头 + 渐细渐淡的离子尾”，
 * 去掉碎屑/蜿蜒/爆闪/烟雾等花哨层，避免像“毛虫”或“发光棒”。
 * 数量稀少（最大同时 12 颗，平均十几秒一颗），偶遇才惊艳。
 *
 * 速度 / 长度 / 颜色全随机，尾迹等效 200~600px。
 *
 * 实现：每颗流星 = 沿运动方向拉伸的 instanced billboard。
 * 实例矩阵把平面对齐到 (dir, 横向)；fragment 沿局部 V 轴生成
 * 核心 → 离子尾 的连续衰减，横向高斯收束成细丝。
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { introState } from './introState'
import { GLSL_NOISE } from './glsl/noise.glsl.ts'

const MAX_METEORS = 12

interface MeteorInstance {
  active: boolean
  born: number
  life: number
  origin: THREE.Vector3
  dir: THREE.Vector3
  speed: number
  length: number
  colorType: number
  coreWidth: number
  flareAt: number
  seed: number
}

const METEOR_COLORS = [
  new THREE.Color(1.0, 1.0, 1.0),       // 白
  new THREE.Color(0.58, 0.78, 1.0),     // 蓝
  new THREE.Color(0.42, 0.95, 1.0),     // 青
]

const METEOR_VERT = /* glsl */ `
  attribute float aColorType;
  attribute float aFade;
  attribute float aFlare;
  attribute float aWidth;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vColorType;
  varying float vFade;
  varying float vFlare;
  varying float vWidth;
  varying float vSeed;
  void main() {
    vUv = uv;
    vColorType = aColorType;
    vFade = aFade;
    vFlare = aFlare;
    vWidth = aWidth;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const METEOR_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColors[3];
  varying vec2 vUv;
  varying float vColorType;
  varying float vFade;
  varying float vFlare;
  varying float vWidth;
  varying float vSeed;

  ${GLSL_NOISE}

  void main() {
    float v = vUv.y; // 0 tail -> 1 head

    // ---- 横向高斯锐线：头部最细，尾端渐宽（锥形细线，整体极细） ----
    float taper = mix(1.0, 0.45, v);
    float cx = abs(vUv.x - 0.5) * 2.0;
    float radial = exp(-cx * cx * (40.0 / max(vWidth, 0.02)) / taper);

    // ---- 头部亮核：高次聚成一点（只有贴近头部的 3% 长度发光，避免粗头） ----
    float core = pow(v, 30.0) * 1.8;

    // ---- 离子尾：从头到尾平滑渐淡的细线（“划线”感，尾端自然消失） ----
    float ion = exp(-(1.0 - v) * 3.2) * 0.45;
    ion *= smoothstep(0.0, 0.3, v);

    // 峰值收敛 ~2.2（仅头部小区域），线条主体 ≤1.5 不过曝，形不被 Bloom 泡糊
    float intensity = (core + ion) * radial * vFade;

    // early-out
    if (intensity < 0.004) discard;

    int ct = int(vColorType + 0.5);
    vec3 col = uColors[ct];
    col = mix(col, vec3(1.0), core * 0.85);

    float a = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col * intensity, a);
  }
`

export function Meteors() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const insts = useRef<MeteorInstance[]>(
    Array.from({ length: MAX_METEORS }, () => ({
      active: false,
      born: 0,
      life: 0,
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      speed: 0,
      length: 0,
      colorType: 0,
      coreWidth: 0,
      flareAt: 0,
      seed: Math.random(),
    })),
  )

  const { geometry, material, colorAttr, fadeAttr, flareAttr, widthAttr, seedAttr } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    const colorArr = new Float32Array(MAX_METEORS)
    const fadeArr = new Float32Array(MAX_METEORS)
    const flareArr = new Float32Array(MAX_METEORS)
    const widthArr = new Float32Array(MAX_METEORS)
    const seedArr = new Float32Array(MAX_METEORS)
    geo.setAttribute('aColorType', new THREE.InstancedBufferAttribute(colorArr, 1))
    geo.setAttribute('aFade', new THREE.InstancedBufferAttribute(fadeArr, 1))
    geo.setAttribute('aFlare', new THREE.InstancedBufferAttribute(flareArr, 1))
    geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(widthArr, 1))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArr, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: METEOR_VERT,
      fragmentShader: METEOR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColors: { value: METEOR_COLORS },
      },
    })
    return {
      geometry: geo,
      material: mat,
      colorAttr: geo.getAttribute('aColorType') as THREE.InstancedBufferAttribute,
      fadeAttr: geo.getAttribute('aFade') as THREE.InstancedBufferAttribute,
      flareAttr: geo.getAttribute('aFlare') as THREE.InstancedBufferAttribute,
      widthAttr: geo.getAttribute('aWidth') as THREE.InstancedBufferAttribute,
      seedAttr: geo.getAttribute('aSeed') as THREE.InstancedBufferAttribute,
    }
  }, [])

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _pos = useMemo(() => new THREE.Vector3(), [])
  const _scl = useMemo(() => new THREE.Vector3(), [])
  const _cam = useMemo(() => new THREE.Vector3(), [])

  const spawn = (now: number) => {
    const free = insts.current.find((m) => !m.active)
    if (!free) return
    free.active = true
    free.born = now
    free.life = 1.8 + Math.random() * 2.0
    const ang = Math.random() * Math.PI * 2
    const r = 5 + Math.random() * 6
    // 出生在上方/四周，向斜下方坠落（保留"流星雨"方向一致性）
    free.origin.set(Math.cos(ang) * r, 4 + Math.random() * 5, (Math.random() - 0.5) * 6)
    free.dir.set(
      (Math.random() - 0.5) * 1.4,
      -(1.0 + Math.random() * 1.4),
      (Math.random() - 0.5) * 0.8,
    ).normalize()
    free.speed = 3 + Math.random() * 4
    // 长度：世界单位，透视下等效 200~600px 尾迹（克制，不横穿屏幕）
    free.length = 4 + Math.random() * 4
    free.colorType = Math.floor(Math.random() * 3)
    // 线宽：0.05~0.10 世界单位（细锐划线，头部为点）
    free.coreWidth = 0.05 + Math.random() * 0.05
    free.flareAt = 0.2 + Math.random() * 0.6
    free.seed = Math.random()
  }

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = state.clock.elapsedTime

    // 生成率克制：meteorRate=1（主页）时平均 ~7s 一颗，偶遇才惊艳
    const rate = 0.1 + introState.meteorRate * 0.4
    if (Math.random() < rate * 0.005) spawn(t)

    material.uniforms.uTime.value = t

    for (let m = 0; m < MAX_METEORS; m++) {
      const inst = insts.current[m]
      if (!inst.active) {
        _m.makeScale(0, 0, 0)
        mesh.setMatrixAt(m, _m)
        fadeAttr.setX(m, 0)
        flareAttr.setX(m, 0)
        continue
      }
      const age = t - inst.born
      const k = age / inst.life
      if (k >= 1) {
        inst.active = false
        _m.makeScale(0, 0, 0)
        mesh.setMatrixAt(m, _m)
        fadeAttr.setX(m, 0)
        flareAttr.setX(m, 0)
        continue
      }
      // 淡入淡出（开头快速亮起，结尾消散）
      const fade = Math.min(1.0, k * 4.0) * Math.sin(Math.min(k, 1) * Math.PI)
      // 爆闪：flameAt 附近一次脉冲
      const flare = k > inst.flareAt && k < inst.flareAt + 0.1 ? 1.0 : 0.0

      // 头部位置
      const head = inst.origin.clone().addScaledVector(inst.dir, inst.speed * age)
      state.camera.getWorldPosition(_cam)
      const viewDir = _cam.clone().sub(head).normalize()
      const side = new THREE.Vector3().crossVectors(inst.dir, viewDir).normalize()
      const basisX = side.clone().multiplyScalar(inst.coreWidth * 0.7)
      const basisY = inst.dir.clone().multiplyScalar(inst.length)

      const mat3 = new THREE.Matrix4().makeBasis(basisX, basisY, viewDir)
      _q.setFromRotationMatrix(mat3)
      _pos.copy(head).addScaledVector(inst.dir, -inst.length * 0.5)
      _scl.set(1, 1, 1)
      _m.compose(_pos, _q, _scl)
      mesh.setMatrixAt(m, _m)

      fadeAttr.setX(m, fade)
      flareAttr.setX(m, flare)
      colorAttr.setX(m, inst.colorType)
      widthAttr.setX(m, inst.coreWidth)
      seedAttr.setX(m, inst.seed)
    }
    mesh.instanceMatrix.needsUpdate = true
    fadeAttr.needsUpdate = true
    flareAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    widthAttr.needsUpdate = true
    seedAttr.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_METEORS]}
      frustumCulled={false}
    />
  )
}
