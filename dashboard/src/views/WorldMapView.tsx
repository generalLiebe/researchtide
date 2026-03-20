import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimationFrame } from '../hooks/useAnimation'
import type { Edge, Hub } from '../types/hub'
import { drawFlowingEdges, hitTest, resizeCanvasToParent } from './canvas'
import { type ContinentPolygons, drawContinents, loadContinents, lonLatToNorm } from './continents'

// Tier colors (resolved, not CSS vars — canvas can't use var())
const TIER_S = '#e8a020'
const TIER_A = '#3a7ad4'
const TIER_B = '#2ab8a0'
const TIER_C = '#8aaad0'

function tierColor(intensity: number) {
  if (intensity >= 90) return TIER_S
  if (intensity >= 75) return TIER_A
  if (intensity >= 65) return TIER_B
  return TIER_C
}

export function WorldMapView({
  hubs,
  edges,
  onSelectHub,
  onClear,
  active = true,
}: {
  hubs: Hub[]
  edges: Edge[]
  onSelectHub: (hub: Hub) => void
  onClear: () => void
  active?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const layoutRef = useRef<{ w: number; h: number; dpr: number } | null>(null)
  const [continentData, setContinentData] = useState<ContinentPolygons | null>(null)

  useEffect(() => {
    loadContinents().then(setContinentData)
  }, [])

  const hubById = useMemo(() => new Map(hubs.map((h) => [h.id, h])), [hubs])

  /** Compute hub pixel positions from current canvas dimensions */
  function computePositions(w: number, h: number) {
    const map = new Map<number, { x: number; y: number; r: number; intensity: number; name: string }>()
    for (const hub of hubs) {
      // Use geographic projection when lon/lat is available.
      // Fall back to legacy normalized x/y.
      const [nx, ny] =
        typeof hub.lon === 'number' && typeof hub.lat === 'number'
          ? lonLatToNorm(hub.lon, hub.lat)
          : [hub.x ?? 0.5, hub.y ?? 0.5]
      const x = nx * w
      const y = ny * h
      const baseRadius = 3 + hub.intensity / 32
      map.set(hub.id, { x, y, r: baseRadius, intensity: hub.intensity, name: hub.name })
    }
    return map
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onResize = () => {
      const dims = resizeCanvasToParent(c)
      if (dims) layoutRef.current = dims
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useAnimationFrame((tMs) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dims = layoutRef.current
    if (!ctx || !dims) return

    const { w, h, dpr } = dims
    const t = tMs / 16.0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const positions = computePositions(w, h)

    // background
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.6)
    grad.addColorStop(0, '#f0f6ff')
    grad.addColorStop(1, '#dce8f8')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // subtle grid
    ctx.save()
    ctx.strokeStyle = 'rgba(74, 123, 203, 0.06)'
    ctx.lineWidth = 1
    for (let i = 1; i < 12; i++) {
      const x = (w * i) / 12
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let j = 1; j < 7; j++) {
      const y = (h * j) / 7
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.restore()

    // continent outlines
    drawContinents(ctx, w, h, continentData)

    // chaldeas glow
    ctx.save()
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.22)
    glow.addColorStop(0, 'rgba(100, 170, 255, 0.18)')
    glow.addColorStop(1, 'rgba(100,170,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.42, w * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // edges
    const posSimple = new Map<number, { x: number; y: number }>()
    for (const [id, p] of positions.entries()) posSimple.set(id, { x: p.x, y: p.y })
    drawFlowingEdges(ctx, edges, posSimple, t)

    // hubs
    for (const [id, p] of positions.entries()) {
      const baseR = p.r
      const phase = t * 0.035 + id * 0.7
      const pulseR = baseR + 4 + 2.5 * Math.sin(phase)

      const color = tierColor(p.intensity)

      // radial glow
      const g = ctx.createRadialGradient(p.x, p.y, baseR, p.x, p.y, baseR + 12)
      g.addColorStop(0, `${color}33`)
      g.addColorStop(1, `${color}00`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, baseR + 12, 0, Math.PI * 2)
      ctx.fill()

      // pulse ring
      ctx.strokeStyle = `${color}28`
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2)
      ctx.stroke()

      // Tier-S extra golden ring
      if (p.intensity >= 90) {
        ctx.strokeStyle = '#ffc10766'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, pulseR + 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // core dot
      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, baseR)
      core.addColorStop(0, `${color}ff`)
      core.addColorStop(1, `${color}cc`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2)
      ctx.fill()

      // reflection
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.arc(p.x - 0.25 * baseR, p.y - 0.28 * baseR, 0.22 * baseR, 0, Math.PI * 2)
      ctx.fill()

      // label
      ctx.font = "500 11px 'JetBrains Mono', ui-monospace, monospace"
      ctx.fillStyle = `${color}bb`
      ctx.textAlign = 'center'
      ctx.fillText(p.name, p.x, p.y + baseR + 14)
    }
  }, active)

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        border: '1px solid rgba(100, 150, 220, 0.35)',
        background: '#f0f6ff',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          const c = canvasRef.current
          const dims = layoutRef.current
          if (!c || !dims) return
          const rect = c.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const clickPositions = computePositions(dims.w, dims.h)
          const points = Array.from(clickPositions.entries()).map(([id, p]) => ({
            id,
            x: p.x,
            y: p.y,
            r: p.r + 8,
          }))
          const hit = hitTest(x, y, points)
          if (hit == null) return onClear()
          const hub = hubById.get(hit)
          if (hub) onSelectHub(hub)
        }}
        style={{ display: 'block' }}
      />
    </div>
  )
}
