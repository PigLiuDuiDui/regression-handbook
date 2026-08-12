/**
 * useLenis
 *
 * 全站 Lenis 平滑滚动。
 * intro 播放期间锁定滚动（stop），intro 结束后解除。
 */
import { useEffect } from 'react'
import Lenis from 'lenis'

export function useLenis(locked: boolean) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    })

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  // 锁定 / 解锁滚动（intro 期间禁止滚动）
  useEffect(() => {
    if (locked) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [locked])
}
