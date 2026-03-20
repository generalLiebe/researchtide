import { useCallback, useRef, useState } from 'react'
import { useAnimationFrame } from './useAnimation'

export interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const MIN_SCALE = 0.5
const MAX_SCALE = 5.0

export function useViewTransform() {
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  const animRef = useRef<{
    start: ViewTransform
    target: ViewTransform
    startTime: number
    duration: number
  } | null>(null)

  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startOX: number; startOY: number }>({
    active: false, startX: 0, startY: 0, startOX: 0, startOY: 0,
  })

  // Animation loop
  useAnimationFrame(() => {
    const anim = animRef.current
    if (!anim) return
    const elapsed = performance.now() - anim.startTime
    const progress = Math.min(1, elapsed / anim.duration)
    const t = easeInOut(progress)

    const newTransform = {
      scale: anim.start.scale + (anim.target.scale - anim.start.scale) * t,
      offsetX: anim.start.offsetX + (anim.target.offsetX - anim.start.offsetX) * t,
      offsetY: anim.start.offsetY + (anim.target.offsetY - anim.start.offsetY) * t,
    }
    setTransform(newTransform)

    if (progress >= 1) {
      animRef.current = null
    }
  }, animRef.current != null)

  const animateTo = useCallback((target: ViewTransform, durationMs = 400) => {
    animRef.current = {
      start: { ...transformRef.current },
      target,
      startTime: performance.now(),
      duration: durationMs,
    }
  }, [])

  const reset = useCallback(() => {
    animateTo({ scale: 1, offsetX: 0, offsetY: 0 }, 300)
  }, [animateTo])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    setTransform((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor))
      const ratio = newScale / prev.scale
      return {
        scale: newScale,
        offsetX: cursorX - (cursorX - prev.offsetX) * ratio,
        offsetY: cursorY - (cursorY - prev.offsetY) * ratio,
      }
    })
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Only start drag if clicking on the container itself or canvas, not on interactive nodes
    const target = e.target as HTMLElement
    if (target.closest('[data-topic-node]')) return
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOX: transformRef.current.offsetX,
      startOY: transformRef.current.offsetY,
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    setTransform((prev) => ({
      ...prev,
      offsetX: d.startOX + dx,
      offsetY: d.startOY + dy,
    }))
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false
  }, [])

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - transformRef.current.offsetX) / transformRef.current.scale,
    y: (sy - transformRef.current.offsetY) / transformRef.current.scale,
  }), [])

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    x: wx * transformRef.current.scale + transformRef.current.offsetX,
    y: wy * transformRef.current.scale + transformRef.current.offsetY,
  }), [])

  return {
    transform,
    isAnimating: animRef.current != null,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    animateTo,
    reset,
    screenToWorld,
    worldToScreen,
  }
}
