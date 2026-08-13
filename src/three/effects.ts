/**
 * 自定义后期效果 —— 电影质感核心
 *
 * 1. CinematicGradeEffect
 *    单 pass 内完成（顺序即视觉叠加）：
 *      - Exposure（曝光）
 *      - ACES Film Tone Mapping（HDR → 显示，电影感核心，精确 fit）
 *      - Black Level（黑位提升，暗部有层次，非纯黑）
 *      - Highlight Roll-Off（高光滚降，保护过曝核心不脏）
 *      - Color Grading（阴影冷、高光暖、饱和度克制）
 *      - Chromatic Aberration（色散，边缘增强）
 *      - Vignette（暗角）
 *      - Lens Dirt（镜头污渍辉光，基于 fbm 噪声，随亮区脉动）
 *      - Lens Flare（基于亮源的炫光鬼影，径向分布）
 *
 * 2. FilmGrainEffect —— 时间演化胶片颗粒
 * 3. MotionSmearEffect —— 径向运动模糊（急推时）
 *
 * 参考 Interstellar / BBC / NASA 调色：浑厚对比、暗部蓝绿层次、
 * 高光暖白滚降、克制饱和度。
 */
import { BlendFunction, Effect } from 'postprocessing'
import { Uniform, Vector2, Vector3 } from 'three'

/* ------------------------------------------------------------------ */
/* 共享噪声（镜头脏点用）                                              */
/* ------------------------------------------------------------------ */
const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.03;
      a *= 0.5;
    }
    return v;
  }
`

/* ------------------------------------------------------------------ */
/* Cinematic Grade                                                     */
/* ------------------------------------------------------------------ */

const GRADE_FRAGMENT = /* glsl */ `
  uniform float uExposure;
  uniform float uBlackLevel;
  uniform float uHiRoll;
  uniform float uSaturation;
  uniform vec3  uShadowsTint;
  uniform vec3  uHighlightsTint;
  uniform float uCA;
  uniform float uVignette;
  uniform float uDirt;
  uniform float uFlare;

  ${NOISE_GLSL}

  // ACES Filmic Tone Mapping（Hill 精确 fit，比 Narkowicz 近似更真实）
  vec3 acesFit(vec3 x) {
    const mat3 ACES_INPUT = mat3(
      0.59719, 0.07600, 0.02840,
      0.35458, 0.90834, 0.13383,
      0.04823, 0.01566, 0.83777
    );
    const mat3 ACES_OUTPUT = mat3(
       1.60475, -0.10208, -0.00327,
      -0.53108,  1.10813, -0.07276,
      -0.07367, -0.00605,  1.07602
    );
    vec3 v = ACES_INPUT * x;
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    vec3 outCol = clamp(ACES_OUTPUT * (a / b), 0.0, 1.0);
    return outCol;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 center = uv - 0.5;
    float r2 = dot(center, center);

    // ---- Chromatic Aberration（边缘增强，方向随径向） ----
    float caAmt = uCA * (0.3 + r2 * 2.6);
    vec2 dir = normalize(center + 1e-6);
    float cr = texture2D(inputBuffer, uv - dir * caAmt).r;
    float cg = inputColor.g;
    float cb = texture2D(inputBuffer, uv + dir * caAmt).b;
    vec3 col = vec3(cr, cg, cb);

    // ---- Exposure ----
    col *= uExposure;

    // ---- 亮度 ----
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

    // ---- Highlight Roll-Off：软滚降保护过曝核心 ----
    float hi = smoothstep(0.55, 1.4, luma);
    col = mix(col, col / (1.0 + hi * uHiRoll), hi * 0.85);

    // ---- ACES Tone Mapping ----
    col = acesFit(col);

    // ---- Color Grading：阴影冷、高光暖、饱和度克制 ----
    vec3 graded = col;
    graded += uShadowsTint * (1.0 - smoothstep(0.0, 0.55, luma));
    graded += uHighlightsTint * smoothstep(0.45, 1.0, luma);
    float gluma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded = mix(vec3(gluma), graded, uSaturation);
    col = graded;

    // ---- Black Level（暗部非纯黑，蓝绿层次） ----
    float lift = uBlackLevel * (1.0 - smoothstep(0.0, 0.3, luma));
    col = max(col, lift);

    // ---- Lens Dirt（fbm 污渍，随亮区脉动，模拟真实镜头玻璃） ----
    float dirt = fbm(uv * vec2(7.0, 7.0 * resolution.y / resolution.x) + time * 0.0);
    dirt = smoothstep(0.55, 1.0, dirt);
    float bright = smoothstep(0.6, 1.0, luma);
    col += dirt * uDirt * bright * vec3(0.55, 0.6, 0.65);

    // ---- Lens Flare（径向鬼影，沿中心连线采样） ----
    float flare = 0.0;
    for (int i = 1; i <= 4; i++) {
      float fi = float(i);
      vec2 fuv = 0.5 + center * (fi * 0.3) * (fi * 0.25 + 0.5);
      float fb = dot(texture2D(inputBuffer, fuv).rgb, vec3(0.333));
      flare += smoothstep(0.65, 1.0, fb) * (1.0 - fi * 0.2);
    }
    col += flare * uFlare * vec3(0.7, 0.8, 1.0) * 0.1;

    // ---- Vignette（反向 smoothstep → 用 1 - smoothstep 表达） ----
    float vig = 1.0 - smoothstep(0.3, 1.0, r2 * 1.25);
    col *= mix(1.0, 1.0 - uVignette, vig);

    outputColor = vec4(col, inputColor.a);
  }
`

interface GradeOptions {
  blendFunction?: BlendFunction
  exposure?: number
  blackLevel?: number
  hiRoll?: number
  saturation?: number
  shadowsTint?: [number, number, number]
  highlightsTint?: [number, number, number]
  ca?: number
  vignette?: number
  dirt?: number
  flare?: number
}

export class CinematicGradeEffect extends Effect {
  constructor(opts: GradeOptions = {}) {
    super('CinematicGradeEffect', GRADE_FRAGMENT, {
      blendFunction: opts.blendFunction ?? BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uExposure', new Uniform(opts.exposure ?? 1.1)],
        ['uBlackLevel', new Uniform(opts.blackLevel ?? 0.016)],
        ['uHiRoll', new Uniform(opts.hiRoll ?? 0.9)],
        ['uSaturation', new Uniform(opts.saturation ?? 0.9)],
        ['uShadowsTint', new Uniform(new Vector3(...(opts.shadowsTint ?? [0.02, 0.005, -0.02])))],
        ['uHighlightsTint', new Uniform(new Vector3(...(opts.highlightsTint ?? [0.035, 0.02, 0.0])))],
        ['uCA', new Uniform(opts.ca ?? 0.0025)],
        ['uVignette', new Uniform(opts.vignette ?? 0.45)],
        ['uDirt', new Uniform(opts.dirt ?? 0.05)],
        ['uFlare', new Uniform(opts.flare ?? 0.5)],
      ]),
    })
  }
}

/* ------------------------------------------------------------------ */
/* Film Grain                                                          */
/* ------------------------------------------------------------------ */

const GRAIN_FRAGMENT = /* glsl */ `
  uniform float uIntensity;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 coord = uv * resolution + fract(time * 24.0) * 173.0;
    float n = fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453123);
    // 轻微去饱和颗粒
    vec3 grain = vec3(n - 0.5) * uIntensity * 2.0;
    float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    grain *= mix(1.6, 0.6, smoothstep(0.0, 0.6, luma));
    outputColor = vec4(inputColor.rgb + grain, inputColor.a);
  }
`

export class FilmGrainEffect extends Effect {
  constructor({ blendFunction = BlendFunction.OVERLAY, intensity = 0.05 }: { blendFunction?: BlendFunction; intensity?: number } = {}) {
    super('FilmGrainEffect', GRAIN_FRAGMENT, {
      blendFunction,
      uniforms: new Map<string, Uniform>([['uIntensity', new Uniform(intensity)]]),
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
    if (uIntensity < 0.001) { outputColor = inputColor; return; }
    vec2 dir = uv - uCenter;
    const int SAMPLES = 8;
    vec3 sum = vec3(0.0);
    for (int i = 0; i < SAMPLES; i++) {
      float t = float(i) / float(SAMPLES - 1);
      vec2 sampleUv = uv - dir * t * uIntensity * 0.25;
      sum += texture2D(inputBuffer, sampleUv).rgb;
    }
    vec3 color = sum / float(SAMPLES);
    outputColor = vec4(mix(color, inputColor.rgb, 0.15), inputColor.a);
  }
`

export class MotionSmearEffect extends Effect {
  constructor({ blendFunction = BlendFunction.NORMAL }: { blendFunction?: BlendFunction } = {}) {
    super('MotionSmearEffect', SMEAR_FRAGMENT, {
      blendFunction,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(0)],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
      ]),
    })
  }
}
