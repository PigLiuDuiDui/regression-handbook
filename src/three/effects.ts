/**
 * 自定义后期效果
 *
 * 1. FilmGrainEffect —— 时间驱动的胶片颗粒（Noise）
 *    比 postprocessing 内置 Noise 更像真实胶片：逐像素随机抖动 + 时间演化
 * 2. MotionSmearEffect —— 径向运动模糊
 *    从屏幕中心向外拉伸采样，模拟"镜头快速推进"时的径向拖影
 *    （Finale 粒子过渡时由 GSAP 驱动的 uIntensity 0 → 峰值 → 0）
 */
import { BlendFunction, Effect } from 'postprocessing'
import { Uniform, Vector2 } from 'three'

/* ------------------------------------------------------------------ */
/* Film Grain                                                          */
/* ------------------------------------------------------------------ */

const GRAIN_FRAGMENT = /* glsl */ `
  uniform float uIntensity;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // 基于位置 + 时间的伪随机噪声（每帧演化 → 胶片颗粒流动）
    // 注：time / resolution 由 postprocessing 的 Effect 模板自动注入（小写）
    vec2 coord = uv * resolution + fract(time * 60.0) * 137.0;
    float n = fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453123);

    vec3 color = inputColor.rgb + (n - 0.5) * uIntensity * 2.0;
    outputColor = vec4(color, inputColor.a);
  }
`

interface FilmGrainOptions {
  blendFunction?: BlendFunction
  /** 颗粒强度（0~0.15 为安全区间） */
  intensity?: number
}

export class FilmGrainEffect extends Effect {
  constructor({ blendFunction = BlendFunction.OVERLAY, intensity = 0.05 }: FilmGrainOptions = {}) {
    super('FilmGrainEffect', GRAIN_FRAGMENT, {
      blendFunction,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(intensity)],
      ]),
    })
  }
}

/* ------------------------------------------------------------------ */
/* Radial Motion Smear                                                 */
/* ------------------------------------------------------------------ */

const SMEAR_FRAGMENT = /* glsl */ `
  uniform float uIntensity;
  uniform vec2 uCenter;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uIntensity < 0.001) {
      outputColor = inputColor;
      return;
    }

    vec2 dir = uv - uCenter;
    const int SAMPLES = 7;
    vec3 sum = vec3(0.0);

    for (int i = 0; i < SAMPLES; i++) {
      float t = float(i) / float(SAMPLES - 1);
      // 沿径向偏移采样，产生"朝中心冲去"的拖影
      vec2 sampleUv = uv - dir * t * uIntensity * 0.22;
      sum += texture2D(inputBuffer, sampleUv).rgb;
    }

    vec3 color = sum / float(SAMPLES);
    // 保留中心清晰、边缘拖影（镜头推进的真实感）
    outputColor = vec4(mix(color, inputColor.rgb, 0.18), inputColor.a);
  }
`

interface MotionSmearOptions {
  blendFunction?: BlendFunction
}

export class MotionSmearEffect extends Effect {
  constructor({ blendFunction = BlendFunction.NORMAL }: MotionSmearOptions = {}) {
    super('MotionSmearEffect', SMEAR_FRAGMENT, {
      blendFunction,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(0)],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
      ]),
    })
  }
}
