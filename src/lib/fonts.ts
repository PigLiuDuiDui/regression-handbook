/**
 * 字体加载
 *
 * Logo（Cinzel 900）、Tagline（Cormorant Garamond）、中文（Noto Serif SC 900）
 * 必须在"光束扫过 Logo 显现"之前完成加载，
 * 否则 Logo 会以 fallback 字体渲染，破坏电影质感。
 *
 * 策略：Intro 开始前等待字体就绪，最长等待 1.2s（不阻塞整体节奏）。
 */

const FONT_SPECS: Array<[string, string]> = [
  ['900 48px "Cinzel"', 'Cinzel'],
  ['300 24px "Cormorant Garamond"', 'Cormorant Garamond'],
  ['900 32px "Noto Serif SC"', 'Noto Serif SC'],
]

/** 主动触发字体下载并等待就绪 */
export async function loadCriticalFonts(timeoutMs = 1200): Promise<void> {
  // 仅现代浏览器支持 FontFaceSet；不支持时直接放行
  if (!document.fonts?.load) return

  try {
    await Promise.race([
      Promise.all(FONT_SPECS.map(([spec, family]) => document.fonts.load(spec, family))),
      new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
    ])
  } catch {
    // 字体加载失败不阻塞动画，display=swap 会兜底
  }
}
