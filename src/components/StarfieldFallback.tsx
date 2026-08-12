/**
 * StarfieldFallback —— WebGL2 不可用时的 CSS 星空降级
 *
 * 不依赖任何图形 API：三层 box-shadow 星点（远/中/近），
 * 缓慢漂移 + 闪烁，保持与 WebGL 版本一致的视觉基调（黑底白星）。
 */
import { useMemo } from 'react'

function buildStarLayer(count: number, maxSize: number): string {
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 100).toFixed(2)
    const y = (Math.random() * 100).toFixed(2)
    const size = (Math.random() * (maxSize - 1) + 1).toFixed(1)
    shadows.push(`${x}vw ${y}vh 0 ${size}px rgba(255,255,255,${(0.3 + Math.random() * 0.5).toFixed(2)})`)
  }
  return shadows.join(',')
}

export function StarfieldFallback() {
  const layers = useMemo(
    () => [
      buildStarLayer(110, 1.4),
      buildStarLayer(70, 2.2),
      buildStarLayer(36, 3.2),
    ],
    [],
  )

  return (
    <div className="stars-fallback" aria-hidden="true">
      {layers.map((shadows, i) => (
        <span
          key={i}
          className={`stars-fallback-layer stars-fallback-layer--${i + 1}`}
          style={{ boxShadow: shadows }}
        />
      ))}
    </div>
  )
}
