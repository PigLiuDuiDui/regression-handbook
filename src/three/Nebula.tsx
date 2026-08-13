/**
 * Nebula —— 程序化真实宇宙星云（体积化 + Domain Warp）
 *
 * 彻底抛弃平面径向渐变。采用两层体积化手段：
 *  1. 每个星云斑块由 5 层 billboard 切片沿盘面法线堆叠，fragment 对每层
 *     用 Domain Warp 采样 3D 云密度并累加 → 产生真实纵深与视差。
 *  2. 单层内用 fbm + 域扭曲 + 脊线生成破碎、翻卷、丝状的真实云。
 *
 * 着色按真实天体物理分层：
 *  - 反射星云：蓝 / 青（年轻热星散射）
 *  - 发射星云 Hα：粉红（电离氢，Voronoi 团块节点）
 *  - 暖白核心（被照亮区）
 *  - 暗裂隙：Worley F2 纤维状暗带
 *
 * 边缘破碎（噪声阈值裁切），绝不规则。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { introState } from './introState'
import { GLSL_NOISE } from './glsl/noise.glsl.ts'
import { NEBULA_PALETTE } from '../lib/constants'

/* ------------------------------------------------------------------ */
/* 着色器                                                              */
/* ------------------------------------------------------------------ */

const NEBULA_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vLayer;
  attribute float aLayer;
  void main() {
    vUv = uv;
    vLayer = aLayer;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const NEBULA_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vLayer;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  uniform vec3  uColA;     // 主色（蓝/青反射星云）
  uniform vec3  uColB;     // 次色（紫）
  uniform vec3  uColHII;   // Hα 粉
  uniform float uHii;      // HII 强度
  uniform float uLayerCount;

  ${GLSL_NOISE}

  void main() {
    // 世界坐标驱动噪声 → 云在空间中固定，相机移动产生体积视差
    vec2 p = vWorld.xy * 0.14 + uSeed * 29.3;
    float zseed = vWorld.z * 0.18 + vLayer * 1.9 + uSeed * 7.1;

    // 慢速翻卷流动
    float flow = uTime * 0.012 + uSeed * 3.3;

    // ---- 单次域扭曲（复用，避免多重 domainWarp 的昂贵采样） ----
    vec2 warp = domainWarp2v(p * 0.55 + flow);

    // ---- 主体云密度：一次 fbm2 + 一次脊线 ----
    float cloud = fbm2(p * 0.9 + warp * 1.1);
    cloud = cloud * 0.6 + 0.4;

    // 层密度调制：让切片叠加形成体积（中心层最密）
    float layerW = 1.0 - abs(vLayer / (uLayerCount - 1.0) - 0.5) * 2.0;
    cloud *= mix(0.45, 1.0, smoothstep(0.0, 1.0, layerW));

    // 脊线破碎边缘（复用 zseed）
    float ridge = fbmRidged(p * 1.7 + zseed);
    float density = cloud * 0.7 + ridge * 0.45;

    // 细碎高频消解（复用 warp）
    float detail = fbm2(p * 2.6 + warp * 0.9 + 3.7);
    density *= 0.55 + detail * 0.6;

    // ---- Early-out：低密度区域直接丢弃，避免后续昂贵计算 ----
    if (density < 0.42) discard;

    // 边缘破碎 mask（阈值裁切）
    float mask = smoothstep(0.46, 1.0, density);
    mask *= smoothstep(0.15, 0.6, detail * 0.5 + 0.3);

    // 颜色分层（低频，复用 warp 低频分量）
    float hueMix = fbm2(p * 0.6 + 9.0) * 0.5 + 0.5;
    vec3 col = mix(uColA, uColB, hueMix);

    // 暖白核心
    col = mix(col, vec3(1.0, 0.95, 0.86), smoothstep(0.95, 1.55, density));

    // Hα 发射团块（Voronoi，只在较密区域）
    float v = voronoi((p + warp * 0.7) * 2.4);
    float hiiCells = smoothstep(0.5, 0.02, v) * uHii;
    hiiCells *= smoothstep(0.55, 1.0, density);
    col = mix(col, uColHII, hiiCells * 0.85);

    // 暗裂隙：Worley F2 纤维状暗带
    float fiber = worleyF2(p * 2.0);
    float crack = smoothstep(0.0, 0.12, abs(fiber));
    mask *= (1.0 - crack * 0.55);

    float alpha = mask * uOpacity;
    alpha = pow(alpha, 1.3);

    // 云体自发光
    vec3 outCol = col * (0.45 + density * 0.9);
    gl_FragColor = vec4(outCol, alpha);
  }
`

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

interface CloudDef {
  pos: [number, number, number]
  size: [number, number]
  rot: number
  seed: number
  colA: [number, number, number]
  colB: [number, number, number]
  hii: number
}

/** 每片星云的体积切片层数（3 层已足够形成纵深，5 层成本过高） */
const SLICES = 3

/** 星云斑块布局：覆盖星系盘内外，蓝青紫暖白粉红交错 */
function buildClouds(): CloudDef[] {
  const defs: CloudDef[] = [
    // 核球外晕：暖白 + 紫，强 HII
    { pos: [0.4, 0.1, 0.3], size: [6.2, 6.2], rot: 0, seed: 0.13, colA: NEBULA_PALETTE.violet, colB: NEBULA_PALETTE.warmWhite, hii: 0.95 },
    // 旋臂内段：蓝 + 青（反射星云）
    { pos: [3.4, 0.0, 1.7], size: [5.0, 3.0], rot: 0.5, seed: 0.42, colA: NEBULA_PALETTE.blue, colB: NEBULA_PALETTE.cyan, hii: 0.55 },
    { pos: [-3.2, 0.0, -1.9], size: [4.6, 2.8], rot: -0.6, seed: 0.71, colA: NEBULA_PALETTE.blue, colB: NEBULA_PALETTE.cyan, hii: 0.55 },
    // 旋臂中段：紫 + 粉 HII
    { pos: [5.9, 0.0, 0.2], size: [4.4, 2.6], rot: 1.1, seed: 0.88, colA: NEBULA_PALETTE.violet, colB: NEBULA_PALETTE.hiiPink, hii: 1.0 },
    { pos: [-5.6, 0.0, 0.4], size: [4.0, 2.4], rot: -1.2, seed: 0.27, colA: NEBULA_PALETTE.violet, colB: NEBULA_PALETTE.hiiPink, hii: 1.0 },
    // 外缘淡蓝薄雾（反射星云，大而淡）
    { pos: [1.6, 0.1, -2.8], size: [6.0, 3.6], rot: 0.2, seed: 0.55, colA: NEBULA_PALETTE.blue, colB: NEBULA_PALETTE.warmWhite, hii: 0.25 },
    { pos: [-1.9, -0.1, 3.0], size: [5.4, 3.2], rot: -0.3, seed: 0.63, colA: NEBULA_PALETTE.cyan, colB: NEBULA_PALETTE.blue, hii: 0.25 },
    // 远端背景星云（深空层次）
    { pos: [0.0, 0.3, -4.5], size: [8.0, 5.0], rot: 0.0, seed: 0.19, colA: NEBULA_PALETTE.violet, colB: NEBULA_PALETTE.cyan, hii: 0.35 },
  ]
  return defs
}

export function Nebula() {
  const group = useMemo(() => {
    const clouds = buildClouds()
    const g = new THREE.Group()

    for (const c of clouds) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSeed: { value: c.seed },
          uColA: { value: new THREE.Color(c.colA[0], c.colA[1], c.colA[2]) },
          uColB: { value: new THREE.Color(c.colB[0], c.colB[1], c.colB[2]) },
          uColHII: { value: new THREE.Color(NEBULA_PALETTE.hiiPink[0], NEBULA_PALETTE.hiiPink[1], NEBULA_PALETTE.hiiPink[2]) },
          uHii: { value: c.hii },
          uLayerCount: { value: SLICES },
        },
      })
      mat.onBeforeRender = () => {
        mat.uniforms.uTime.value = performance.now() / 1000
        mat.uniforms.uOpacity.value = 0.3 * introState.nebula
      }

      // 体积切片：沿盘面法线（局部 z）堆叠多层
      const w = c.size[0]
      const h = c.size[1]
      const geo = new THREE.PlaneGeometry(w, h)
      // 每层一个独立顶点组（不同 aLayer / 不同 z 偏移）
      const layerGeo = new THREE.BufferGeometry()
      const total = geo.attributes.position.count * SLICES
      const positions = new Float32Array(total * 3)
      const uvs = new Float32Array(total * 2)
      const layers = new Float32Array(total)
      const idx = new Float32Array(total)

      const srcPos = geo.attributes.position.array as Float32Array
      const srcUv = geo.attributes.uv.array as Float32Array
      const depthStep = 0.5

      for (let s = 0; s < SLICES; s++) {
        const zOff = (s - (SLICES - 1) / 2) * depthStep
        for (let i = 0; i < geo.attributes.position.count; i++) {
          const d = (s * geo.attributes.position.count + i)
          positions[d * 3] = srcPos[i * 3]
          positions[d * 3 + 1] = srcPos[i * 3 + 1]
          positions[d * 3 + 2] = zOff
          uvs[d * 2] = srcUv[i * 2]
          uvs[d * 2 + 1] = srcUv[i * 2 + 1]
          layers[d] = s
          idx[d] = i
        }
      }
      layerGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      layerGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      layerGeo.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1))

      // 复用原几何的索引（每层用同样的三角形索引）
      if (geo.index) {
        const srcIndex = geo.index.array as Uint16Array | Uint32Array
        const index = new (srcIndex instanceof Uint32Array ? Uint32Array : Uint16Array)(
          srcIndex.length * SLICES,
        )
        const perLayer = srcIndex.length
        for (let s = 0; s < SLICES; s++) {
          for (let i = 0; i < perLayer; i++) {
            index[s * perLayer + i] = srcIndex[i] + s * geo.attributes.position.count
          }
        }
        layerGeo.setIndex(new THREE.BufferAttribute(index, 1))
      }

      const mesh = new THREE.Mesh(layerGeo, mat)
      mesh.position.set(c.pos[0], c.pos[1], c.pos[2])
      mesh.rotation.set(0, 0, c.rot)
      g.add(mesh)
    }
    return g
  }, [])

  return (
    <group rotation={[-0.62, 0, 0]}>
      <primitive object={group} dispose={null} />
    </group>
  )
}
