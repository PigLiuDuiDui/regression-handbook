/**
 * useDeviceCapability
 *
 * 挂载时异步检测设备能力（硬件指标 + FPS 采样），
 * 检测完成前返回 null，界面先渲染纯黑层，避免闪烁。
 */
import { useEffect, useState } from 'react'
import { initialCapability, resolveCapability, type DeviceCapability } from '../lib/quality'

export function useDeviceCapability(): DeviceCapability {
  // 首帧即用同步推断的初始能力渲染场景，避免能力检测期间纯黑、粒子迟迟不显示。
  // FPS 采样完成后若需降档，再平滑替换。
  const [capability, setCapability] = useState<DeviceCapability>(() => initialCapability())

  useEffect(() => {
    let cancelled = false
    resolveCapability().then((cap) => {
      if (!cancelled) setCapability(cap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return capability
}
