/**
 * 共享 GLSL 噪声函数库 —— 电影级程序化宇宙核心
 *
 * 目标：让星云 / 尘埃 / 银河具有真实天体物理的"层云感"，
 * 而非平面渐变。核心手段是 Domain Warp（域扭曲）——
 * 用噪声去扭曲采样的坐标，让 FBM 产生丝状、翻卷、破碎的自然云结构。
 *
 * 提供：
 *  - hash11 / hash22（可复现伪随机）
 *  - perlin2（经典梯度噪声，smoothstep 五次插值）
 *  - fbm2（分形布朗运动）
 *  - fbmRidged（脊线 FBM，破碎边缘）
 *  - domainWarp2 / domainWarp2v（域扭曲，云层核心）
 *  - voronoi（细胞噪声，HII 团块 / 暗带裂缝）
 *  - worleyF2（次近邻 Voronoi，纤维状暗带）
 *
 * 全部 WebGL2 / GLSL ES 3.0 兼容（#version 由 three 注入）。
 */

export const GLSL_NOISE = /* glsl */ `
  // ================= 基础 hash =================
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // ================= 2D Perlin =================
  float perlin2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 g00 = normalize(hash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0);
    vec2 g10 = normalize(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0);
    vec2 g01 = normalize(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0);
    vec2 g11 = normalize(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0);
    float n00 = dot(g00, f - vec2(0.0, 0.0));
    float n10 = dot(g10, f - vec2(1.0, 0.0));
    float n01 = dot(g01, f - vec2(0.0, 1.0));
    float n11 = dot(g11, f - vec2(1.0, 1.0));
    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
  }

  // ================= FBM 2D（4 层，性能/质量平衡） =================
  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      v += a * perlin2(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // ================= 脊线 FBM（破碎边缘 / 丝状，4 层） =================
  float fbmRidged(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(perlin2(p));
      n *= n;
      v += a * n;
      p = m * p;
      a *= 0.55;
    }
    return v;
  }

  // ================= Domain Warp（域扭曲，云层核心） =================
  // 用噪声扭曲采样坐标，让 FBM 产生翻卷、丝状、非重复的自然云。
  // 返回 range ≈ [-0.7, 0.7]
  float domainWarp2(vec2 p) {
    vec2 q = vec2(fbm2(p), fbm2(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm2(p + 4.0 * q + vec2(1.7, 9.2)),
                  fbm2(p + 4.0 * q + vec2(8.3, 2.8)));
    return fbm2(p + 4.0 * r);
  }

  // 返回矢量域扭曲（用于丝状云方向感）
  vec2 domainWarp2v(vec2 p) {
    vec2 q = vec2(fbm2(p), fbm2(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm2(p + 4.0 * q + vec2(1.7, 9.2)),
                  fbm2(p + 4.0 * q + vec2(8.3, 2.8)));
    return r;
  }

  // ================= Voronoi（细胞噪声） =================
  float voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash22(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        md = min(md, d);
      }
    }
    return sqrt(md);
  }

  // Worley F2（次近邻距离），生成纤维状 / 网状结构，用于暗带裂缝
  float worleyF2(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash22(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; }
        else if (d < d2) { d2 = d; }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }
`
