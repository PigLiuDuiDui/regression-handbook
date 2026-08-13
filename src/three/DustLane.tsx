/**
 * DustLane —— 银河暗带（真实尘埃遮挡，细丝状）
 *
 * 关键认知：银河是 Additive（黑底加亮），暗尘埃不能简单用大平面
 * NormalBlending 覆盖，否则会压暗整个视野形成"脏黑块"。
 *
 * 正确做法：
 *  - 用对数螺旋相位 mask 让尘埃严格沿旋臂「内侧」分布（真实银河暗带
 *    就是旋臂内侧的尘埃吸收带，而非随机散布）。
 *  - 域扭曲 + Worley F2 纤维噪声 → 细丝状、破碎、翻卷的真实尘埃。
 *  - 中心薄、外缘收窄、中间最密（盘面尘埃分布）。
 *  - 暗色非纯黑：极深冷褐（暗星云如马头星云的色调）。
 *
 * 渲染顺序：depthTest=false + renderOrder 高，压在线性亮银河之上。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { introState } from './introState'
import { GLSL_NOISE } from './glsl/noise.glsl.ts'

const DUST_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const DUST_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uArmCount;   // 旋臂数（与 Galaxy 一致）
  uniform float uTightness;  // 螺旋紧致度

  ${GLSL_NOISE}

  void main() {
    // 盘面极坐标（尘埃在盘面内分布）
    vec2 q = vWorld.xy;
    float r = length(q);
    float a = atan(q.y, q.x);

    // ---- 径向 early-out：盘外区域直接丢弃（大幅减少无效计算） ----
    if (r < 0.5 || r > 7.5) discard;

    // ---- 螺旋相位 mask：尘埃沿旋臂内侧分布 ----
    float spiralPhase = a + r * uTightness;
    float armSum = 0.0;
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      armSum += sin(spiralPhase * 1.0 + fi * (6.28318 / uArmCount));
    }
    armSum = armSum / 2.0;

    // 尘埃在「臂的内侧」，收窄成细带
    float dustBand = sin(spiralPhase * 1.0 + 0.35);
    float band = smoothstep(0.25, 0.92, dustBand) * smoothstep(0.25, 0.92, -dustBand + 1.2);
    band *= 0.5 + 0.5 * sin(spiralPhase * 2.0 + 1.2);

    // ---- 径向分布：中心薄、外缘收窄 ----
    float radial = smoothstep(0.6, 2.2, r) * (1.0 - smoothstep(6.4, 7.4, r));

    // ---- 域扭曲 → 翻卷丝状尘埃（单次 warp 复用） ----
    vec2 p = q * 0.34 + uSeed * 11.7;
    vec2 warp = domainWarp2v(p * 0.6 + uTime * 0.004);
    float d1 = fbm2(p * 1.5 + warp * 1.1);
    float d2 = fbmRidged(p * 2.9 + warp * 0.8 + 4.0);
    float dens = (d1 * 0.6 + d2 * 0.55);

    // Worley F2 纤维 → 细丝状尘埃
    float fiber = worleyF2(p * 2.4 + warp * 0.5);
    dens *= smoothstep(0.02, 0.35, fiber);

    // 组合
    float total = dens * band * radial;

    // early-out：几乎无尘埃区域丢弃
    if (total < 0.3) discard;

    // 阈值裁切 → 不连续、破碎的暗带
    float dark = smoothstep(0.42, 0.95, total) * uOpacity;

    // 非纯黑：极深冷褐（暗星云层次）
    vec3 dustCol = vec3(0.012, 0.010, 0.016);
    dustCol += vec3(0.02, 0.015, 0.012) * smoothstep(0.5, 0.9, total);

    gl_FragColor = vec4(dustCol, dark);
  }
`

export function DustLane() {
  const group = useMemo(() => {
    const g = new THREE.Group()
    const defs = [
      { pos: [0, 0, 0.0] as [number, number, number], size: [16, 16] as [number, number], seed: 0.31 },
      { pos: [0, 0, 0.3] as [number, number, number], size: [13, 13] as [number, number], seed: 0.74 },
    ]
    for (const c of defs) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSeed: { value: c.seed },
          uArmCount: { value: 2 },
          uTightness: { value: 2.35 * 0.18 },
        },
      })
      mat.onBeforeRender = () => {
        mat.uniforms.uTime.value = performance.now() / 1000
        mat.uniforms.uOpacity.value = 0.9 * introState.nebula
      }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.size[0], c.size[1]), mat)
      mesh.position.set(...c.pos)
      mesh.renderOrder = 5
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
