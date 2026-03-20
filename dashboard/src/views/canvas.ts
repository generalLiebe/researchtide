import type { Edge, TimelineSeries } from '../types/hub'

export function resizeCanvasToParent(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight
  if (h <= 0) return
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  return { w, h, dpr }
}

export function hitTest(
  x: number,
  y: number,
  points: Array<{ id: number; x: number; y: number; r: number }>,
) {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    const dx = x - p.x
    const dy = y - p.y
    if (dx * dx + dy * dy <= p.r * p.r) return p.id
  }
  return null
}

export function drawFlowingEdges(
  ctx: CanvasRenderingContext2D,
  edges: Edge[],
  pos: Map<number, { x: number; y: number }>,
  t: number,
) {
  ctx.save()
  ctx.lineWidth = 0.7
  ctx.strokeStyle = 'rgba(80, 130, 210, 0.18)'
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const a = pos.get(e.source)
    const b = pos.get(e.target)
    if (!a || !b) continue
    const dashA = 5 + 3 * Math.sin(t * 0.04 + i)
    ctx.setLineDash([dashA, 8])
    ctx.lineDashOffset = -t * 0.4
    ctx.globalAlpha = Math.max(0.05, Math.min(0.6, e.weight))
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()
}

// --- Timeline chart utilities ---

export const TIER_COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

export interface ChartLayout {
  left: number
  right: number
  top: number
  bottom: number
  w: number
  h: number
}

export function computeChartLayout(canvasW: number, canvasH: number): ChartLayout {
  const left = 56
  const right = canvasW - 20
  const top = 24
  const bottom = canvasH - 32
  return { left, right, top, bottom, w: right - left, h: bottom - top }
}

export function drawTimelineChart(
  ctx: CanvasRenderingContext2D,
  series: TimelineSeries[],
  layout: ChartLayout,
  highlightIdx: number | null,
  hoverX: number | null,
) {
  // Collect all months and find y-max
  const allMonths = new Set<string>()
  let yMax = 0
  for (const s of series) {
    for (const m of s.monthly) {
      allMonths.add(m.month)
      if (m.count > yMax) yMax = m.count
    }
  }
  const months = Array.from(allMonths).sort()
  if (months.length === 0) return { months, yMax }

  yMax = Math.ceil(yMax * 1.1) || 1
  const { left, right, top, bottom, w, h } = layout

  // Grid lines
  ctx.save()
  ctx.strokeStyle = 'rgba(100, 150, 220, 0.08)'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  const ySteps = 5
  for (let i = 0; i <= ySteps; i++) {
    const y = top + (h / ySteps) * i
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
    // Y-axis label
    const val = Math.round(yMax - (yMax / ySteps) * i)
    ctx.fillStyle = 'rgba(160, 180, 210, 0.6)'
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(String(val), left - 6, y + 3)
  }

  // X-axis labels (every 3rd month)
  ctx.textAlign = 'center'
  for (let i = 0; i < months.length; i++) {
    if (i % 3 !== 0 && i !== months.length - 1) continue
    const x = left + (w / (months.length - 1 || 1)) * i
    ctx.fillStyle = 'rgba(160, 180, 210, 0.6)'
    ctx.fillText(months[i], x, bottom + 14)
  }
  ctx.restore()

  // Draw lines
  for (let si = 0; si < series.length; si++) {
    const s = series[si]
    const color = TIER_COLORS[si % TIER_COLORS.length]
    const isHighlight = highlightIdx === null || highlightIdx === si
    const monthMap = new Map(s.monthly.map((m) => [m.month, m.count]))

    // Scale line width by acceleration magnitude
    const absAccel = Math.abs(s.acceleration)
    const accelWidth = isHighlight ? Math.min(5, 2 + absAccel * 0.5) : 1

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = accelWidth
    ctx.globalAlpha = isHighlight ? 1 : 0.2
    ctx.beginPath()

    let started = false
    for (let i = 0; i < months.length; i++) {
      const count = monthMap.get(months[i]) ?? 0
      const x = left + (w / (months.length - 1 || 1)) * i
      const y = bottom - (count / yMax) * h
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  // Hover crosshair
  if (hoverX !== null && hoverX >= left && hoverX <= right) {
    ctx.save()
    ctx.strokeStyle = 'rgba(177, 197, 255, 0.4)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(hoverX, top)
    ctx.lineTo(hoverX, bottom)
    ctx.stroke()
    ctx.restore()
  }

  return { months, yMax }
}
