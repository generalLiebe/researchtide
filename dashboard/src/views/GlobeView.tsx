import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimationFrame } from '../hooks/useAnimation'
import type { Edge, Hub } from '../types/hub'
import { hitTest, resizeCanvasToParent } from './canvas'
import { type ContinentPolygonsRaw, loadContinentsRaw } from './continents'

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

const DEG = Math.PI / 180

function projectToGlobe(
  lon: number,
  lat: number,
  rotLon: number,
  rotLat: number,
  cx: number,
  cy: number,
  R: number,
): { x: number; y: number; z: number } | null {
  const lambda = (lon - rotLon) * DEG
  const phi = lat * DEG
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const cosLam = Math.cos(lambda)

  // Rotate around X axis by rotLat
  const rotLatRad = rotLat * DEG
  const cosRot = Math.cos(rotLatRad)
  const sinRot = Math.sin(rotLatRad)

  const x3 = cosPhi * Math.sin(lambda)
  const y3raw = sinPhi
  const z3raw = cosPhi * cosLam

  const y3 = y3raw * cosRot - z3raw * sinRot
  const z3 = y3raw * sinRot + z3raw * cosRot

  if (z3 < 0) return null // back hemisphere

  return {
    x: cx + x3 * R,
    y: cy - y3 * R,
    z: z3,
  }
}

export function GlobeView({
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
  const [continentData, setContinentData] = useState<ContinentPolygonsRaw | null>(null)

  const rotRef = useRef({ lon: 0, lat: -20 })
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startLon: number; startLat: number; totalDist: number }>({
    active: false, startX: 0, startY: 0, startLon: 0, startLat: 0, totalDist: 0,
  })
  const zoomRef = useRef(3.0) // start zoomed in, animate to 1.0
  const prevActiveRef = useRef(active)

  // Click ripple effect state (startT will be set from the animation frame time)
  const rippleRef = useRef<{ x: number; y: number; startT: number; color: string } | null>(null)
  const lastFrameT = useRef(0) // track the latest animation frame time

  useEffect(() => {
    loadContinentsRaw().then(setContinentData)
  }, [])

  // Reset zoom when tab becomes active (re-entering globe view)
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      zoomRef.current = 3.0
    }
    prevActiveRef.current = active
  }, [active])

  const hubById = useMemo(() => new Map(hubs.map((h) => [h.id, h])), [hubs])

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    lastFrameT.current = tMs

    // Auto-rotate when not dragging
    if (!dragRef.current.active) {
      rotRef.current.lon += 0.08
    }

    // Animate zoom: ease from current value toward 1.0
    const zoom = zoomRef.current
    zoomRef.current = 1.0 + (zoom - 1.0) * 0.94 // exponential decay (~60fps smooth)

    // Fade-in opacity tied to zoom progress (fully visible when zoom < 1.3)
    const opacity = Math.min(1, Math.max(0, (3.0 - zoom) / 2.0))

    const { lon: rotLon, lat: rotLat } = rotRef.current
    const cx = w * 0.5
    const cy = h * 0.48
    const R = Math.min(w, h) * 0.38 * zoom

    // Background gradient (same as WorldMapView)
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.6)
    grad.addColorStop(0, '#f0f6ff')
    grad.addColorStop(1, '#dce8f8')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    ctx.globalAlpha = opacity

    // Globe body
    const globeGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    globeGrad.addColorStop(0, '#e8f0ff')
    globeGrad.addColorStop(0.7, '#c8daf5')
    globeGrad.addColorStop(1, '#a0b8d8')
    ctx.fillStyle = globeGrad
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    // Graticule (30° intervals)
    ctx.save()
    ctx.strokeStyle = 'rgba(100, 150, 220, 0.12)'
    ctx.lineWidth = 0.5
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath()
      let started = false
      for (let lon = -180; lon <= 180; lon += 3) {
        const p = projectToGlobe(lon, lat, rotLon, rotLat, cx, cy, R)
        if (!p) { started = false; continue }
        if (!started) { ctx.moveTo(p.x, p.y); started = true }
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    // Longitude lines
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath()
      let started = false
      for (let lat = -90; lat <= 90; lat += 3) {
        const p = projectToGlobe(lon, lat, rotLon, rotLat, cx, cy, R)
        if (!p) { started = false; continue }
        if (!started) { ctx.moveTo(p.x, p.y); started = true }
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Continents
    if (continentData) {
      ctx.save()
      // Clip to globe circle to prevent fill leaking outside
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      ctx.fillStyle = 'rgba(180, 210, 240, 0.55)'
      ctx.strokeStyle = 'rgba(100, 150, 220, 0.35)'
      ctx.lineWidth = 0.8
      for (const ring of continentData) {
        if (ring.length < 3) continue

        // Project all points; track which are visible
        const projected: Array<{ x: number; y: number } | null> = []
        let allVisible = true
        for (let i = 0; i < ring.length; i++) {
          const p = projectToGlobe(ring[i][0], ring[i][1], rotLon, rotLat, cx, cy, R)
          projected.push(p)
          if (!p) allVisible = false
        }

        if (allVisible) {
          // Fully visible ring — fill and stroke normally
          ctx.beginPath()
          ctx.moveTo(projected[0]!.x, projected[0]!.y)
          for (let i = 1; i < projected.length; i++) {
            ctx.lineTo(projected[i]!.x, projected[i]!.y)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        } else {
          // Partially visible — stroke visible segments only (no fill to avoid artifacts)
          ctx.beginPath()
          let started = false
          for (let i = 0; i < projected.length; i++) {
            const p = projected[i]
            if (!p) { started = false; continue }
            if (!started) { ctx.moveTo(p.x, p.y); started = true }
            else ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Edge outline (rim)
    ctx.save()
    ctx.strokeStyle = 'rgba(100, 150, 220, 0.30)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Highlight arc (top-left)
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, R - 1, -Math.PI * 0.75, -Math.PI * 0.35)
    ctx.stroke()
    ctx.restore()

    // Edges (connections between visible hubs)
    const t = tMs / 16.0
    const hubPositions = new Map<number, { x: number; y: number; z: number; r: number; intensity: number; name: string }>()
    for (const hub of hubs) {
      const lon = hub.lon ?? 0
      const lat = hub.lat ?? 0
      const p = projectToGlobe(lon, lat, rotLon, rotLat, cx, cy, R)
      if (!p) continue
      const baseR = 3 + hub.intensity / 32
      const displayR = baseR * (0.7 + 0.3 * p.z)
      hubPositions.set(hub.id, { x: p.x, y: p.y, z: p.z, r: displayR, intensity: hub.intensity, name: hub.name })
    }

    // Draw edges
    ctx.save()
    ctx.lineWidth = 0.7
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const a = hubPositions.get(e.source)
      const b = hubPositions.get(e.target)
      if (!a || !b) continue
      ctx.strokeStyle = 'rgba(80, 130, 210, 0.18)'
      const dashA = 5 + 3 * Math.sin(t * 0.04 + i)
      ctx.setLineDash([dashA, 8])
      ctx.lineDashOffset = -t * 0.4
      ctx.globalAlpha = Math.max(0.05, Math.min(0.6, e.weight)) * opacity
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.restore()

    // Draw hubs
    for (const [id, p] of hubPositions.entries()) {
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

      // Tier-S extra ring
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

    // Click ripple effect
    const rip = rippleRef.current
    if (rip) {
      const elapsedMs = tMs - rip.startT
      const durationMs = 750
      const progress = elapsedMs / durationMs

      if (progress > 1) {
        rippleRef.current = null
      } else {
        ctx.save()
        const col = rip.color

        // 3 staggered expanding rings
        for (let i = 0; i < 3; i++) {
          const ringProgress = Math.max(0, Math.min(1, (progress - i * 0.12) / 0.7))
          if (ringProgress <= 0) continue
          const ease = 1 - (1 - ringProgress) * (1 - ringProgress) // easeOut
          const radius = 8 + ease * 60
          const alpha = (1 - ringProgress) * 0.6
          ctx.strokeStyle = col
          ctx.globalAlpha = alpha * opacity
          ctx.lineWidth = 1.5 - ringProgress * 1.0
          ctx.setLineDash([3 + ringProgress * 8, 2 + ringProgress * 4])
          ctx.beginPath()
          ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Center flash
        const flashAlpha = Math.max(0, 1 - progress * 3) * 0.7
        if (flashAlpha > 0) {
          const g = ctx.createRadialGradient(rip.x, rip.y, 0, rip.x, rip.y, 20)
          g.addColorStop(0, `${col}`)
          g.addColorStop(1, `${col}00`)
          ctx.globalAlpha = flashAlpha * opacity
          ctx.fillStyle = g
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.arc(rip.x, rip.y, 20, 0, Math.PI * 2)
          ctx.fill()
        }

        // Cross-hair lines that shrink
        const crossAlpha = Math.max(0, 1 - progress * 2) * 0.4
        if (crossAlpha > 0) {
          ctx.globalAlpha = crossAlpha * opacity
          ctx.strokeStyle = col
          ctx.lineWidth = 0.8
          ctx.setLineDash([])
          const len = 20 + progress * 30
          const gap = 6 + progress * 10
          // Horizontal
          ctx.beginPath()
          ctx.moveTo(rip.x - len, rip.y); ctx.lineTo(rip.x - gap, rip.y)
          ctx.moveTo(rip.x + gap, rip.y); ctx.lineTo(rip.x + len, rip.y)
          // Vertical
          ctx.moveTo(rip.x, rip.y - len); ctx.lineTo(rip.x, rip.y - gap)
          ctx.moveTo(rip.x, rip.y + gap); ctx.lineTo(rip.x, rip.y + len)
          ctx.stroke()
        }

        ctx.restore()
      }
    }

    ctx.globalAlpha = 1
  }, active)

  const handlePointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current
    if (!c) return
    c.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLon: rotRef.current.lon,
      startLat: rotRef.current.lat,
      totalDist: 0,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    d.totalDist = Math.abs(dx) + Math.abs(dy)
    rotRef.current.lon = d.startLon - dx * 0.3
    rotRef.current.lat = Math.max(-80, Math.min(80, d.startLat + dy * 0.3))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    const wasClick = d.totalDist < 5
    d.active = false

    if (wasClick) {
      const c = canvasRef.current
      const dims = layoutRef.current
      if (!c || !dims) return
      const rect = c.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const { lon: rotLon, lat: rotLat } = rotRef.current
      const cx = dims.w * 0.5
      const cy = dims.h * 0.48
      const R = Math.min(dims.w, dims.h) * 0.38 * zoomRef.current

      const points: Array<{ id: number; x: number; y: number; r: number }> = []
      for (const hub of hubs) {
        const lon = hub.lon ?? 0
        const lat = hub.lat ?? 0
        const p = projectToGlobe(lon, lat, rotLon, rotLat, cx, cy, R)
        if (!p) continue
        const baseR = (3 + hub.intensity / 32) * (0.7 + 0.3 * p.z)
        points.push({ id: hub.id, x: p.x, y: p.y, r: baseR + 8 })
      }

      const hit = hitTest(mx, my, points)
      if (hit == null) return onClear()
      const hub = hubById.get(hit)
      if (hub) {
        // Trigger ripple effect at the hub's projected position
        const hitPt = points.find((p) => p.id === hit)
        if (hitPt) {
          const color = tierColor(hub.intensity)
          rippleRef.current = { x: hitPt.x, y: hitPt.y, startT: lastFrameT.current, color }
        }
        onSelectHub(hub)
      }
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        border: '1px solid rgba(100, 150, 220, 0.35)',
        background: '#f0f6ff',
        overflow: 'hidden',
        height: '100%',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ display: 'block' }}
      />
    </div>
  )
}
