import type { Edge, ForecastPoint, TimelineSeries } from '../types/hub'

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

export function computeChartLayout(canvasW: number, canvasH: number, needsScrollbar = false): ChartLayout {
  const left = 56
  const right = canvasW - 20
  const top = 24
  const bottom = canvasH - (needsScrollbar ? 48 : 32)
  return { left, right, top, bottom, w: right - left, h: bottom - top }
}

export interface TimelineChartResult {
  months: string[]           // actual months only
  combinedMonths: string[]   // actual + forecast
  actualCount: number
  yMax: number
  virtualWidth: number       // total width needed for all months
  pxPerMonth: number
}

export function drawTimelineChart(
  ctx: CanvasRenderingContext2D,
  series: TimelineSeries[],
  layout: ChartLayout,
  highlightIdx: number | null,
  hoverX: number | null,
  scrollOffset: number = 0,
): TimelineChartResult | undefined {
  // --- Build unified month array (actual + forecast) ---
  const actualMonthSet = new Set<string>()
  let yMax = 0
  for (const s of series) {
    for (const m of s.monthly) {
      actualMonthSet.add(m.month)
      if (m.count > yMax) yMax = m.count
    }
  }
  const actualMonths = Array.from(actualMonthSet).sort()
  if (actualMonths.length === 0) return undefined

  // Collect forecast months
  const forecastMonthSet = new Set<string>()
  for (const s of series) {
    if (s.forecast) {
      for (const fp of s.forecast) {
        forecastMonthSet.add(fp.month)
        if (fp.upper_80 > yMax) yMax = fp.upper_80
      }
    }
  }
  const forecastOnly = Array.from(forecastMonthSet)
    .filter((m) => !actualMonthSet.has(m))
    .sort()
  const combinedMonths = [...actualMonths, ...forecastOnly]
  const actualCount = actualMonths.length

  yMax = Math.ceil(yMax * 1.1) || 1
  const { left, right, top, bottom, w, h } = layout

  // --- Compute step size and virtual width ---
  const totalMonths = combinedMonths.length
  // Fit all months into the chart width — no minimum pixel constraint
  const pxPerMonth = w / (totalMonths - 1 || 1)
  const virtualWidth = pxPerMonth * (totalMonths - 1)

  // Map month index → X position (accounting for scroll)
  const monthX = (i: number) => left + i * pxPerMonth - scrollOffset

  // --- Clip to chart area ---
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top - 16, w, h + 32)
  ctx.clip()

  // --- Grid lines (drawn across full visible width) ---
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
  }

  // --- X-axis labels (every 3rd month, unified) ---
  ctx.fillStyle = 'rgba(160, 180, 210, 0.6)'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  for (let i = 0; i < combinedMonths.length; i++) {
    if (i % 3 !== 0 && i !== combinedMonths.length - 1) continue
    const x = monthX(i)
    if (x < left - 30 || x > right + 30) continue  // skip off-screen
    const isForecast = i >= actualCount
    ctx.fillStyle = isForecast ? 'rgba(160, 180, 210, 0.4)' : 'rgba(160, 180, 210, 0.6)'
    ctx.fillText(combinedMonths[i], x, bottom + 14)
  }

  // --- Forecast boundary divider ---
  if (forecastOnly.length > 0) {
    const boundaryX = monthX(actualCount - 1)
    if (boundaryX >= left && boundaryX <= right) {
      ctx.save()
      ctx.strokeStyle = 'rgba(177, 197, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(boundaryX, top)
      ctx.lineTo(boundaryX, bottom)
      ctx.stroke()

      ctx.fillStyle = 'rgba(177, 197, 255, 0.5)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('FORECAST', boundaryX, top - 4)
      ctx.restore()
    }

    // Light background tint for forecast region
    const fcStartX = Math.max(left, monthX(actualCount - 1))
    const fcEndX = monthX(combinedMonths.length - 1)
    if (fcEndX > left && fcStartX < right) {
      ctx.save()
      ctx.fillStyle = 'rgba(100, 150, 220, 0.04)'
      ctx.fillRect(
        Math.max(left, fcStartX),
        top,
        Math.min(right, fcEndX) - Math.max(left, fcStartX),
        h,
      )
      ctx.restore()
    }
  }

  // --- Draw actual data lines ---
  for (let si = 0; si < series.length; si++) {
    const s = series[si]
    const color = TIER_COLORS[si % TIER_COLORS.length]
    const isHighlight = highlightIdx === null || highlightIdx === si
    const dataMap = new Map(s.monthly.map((m) => [m.month, m.count]))

    const absAccel = Math.abs(s.acceleration)
    const accelWidth = isHighlight ? Math.min(5, 2 + absAccel * 0.5) : 1

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = accelWidth
    ctx.globalAlpha = isHighlight ? 1 : 0.2
    ctx.setLineDash([])
    ctx.beginPath()

    let started = false
    for (let i = 0; i < actualCount; i++) {
      const count = dataMap.get(combinedMonths[i]) ?? 0
      const x = monthX(i)
      const y = bottom - (count / yMax) * h
      if (!started) { ctx.moveTo(x, y); started = true }
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // --- Draw forecast lines + confidence bands ---
  if (forecastOnly.length > 0) {
    for (let si = 0; si < series.length; si++) {
      const s = series[si]
      if (!s.forecast || s.forecast.length === 0) continue

      const color = TIER_COLORS[si % TIER_COLORS.length]
      const isHighlight = highlightIdx === null || highlightIdx === si
      const fcMap = new Map(s.forecast.map((fp) => [fp.month, fp]))

      // Build ordered forecast points matching combinedMonths
      const fcIndices: { idx: number; fp: ForecastPoint }[] = []
      for (let i = actualCount; i < combinedMonths.length; i++) {
        const fp = fcMap.get(combinedMonths[i])
        if (fp) fcIndices.push({ idx: i, fp })
      }
      if (fcIndices.length === 0) continue

      // Confidence band
      ctx.save()
      ctx.globalAlpha = isHighlight ? 0.10 : 0.03
      ctx.fillStyle = color
      ctx.beginPath()
      for (let j = 0; j < fcIndices.length; j++) {
        const x = monthX(fcIndices[j].idx)
        const y = bottom - (fcIndices[j].fp.upper_80 / yMax) * h
        if (j === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      for (let j = fcIndices.length - 1; j >= 0; j--) {
        const x = monthX(fcIndices[j].idx)
        const y = bottom - (fcIndices[j].fp.lower_80 / yMax) * h
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Forecast dashed line (connecting from last actual point)
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = isHighlight ? 2 : 0.8
      ctx.globalAlpha = isHighlight ? 0.8 : 0.15
      ctx.setLineDash([5, 4])
      ctx.beginPath()

      // Start from last actual data point
      const dataMap = new Map(s.monthly.map((m) => [m.month, m.count]))
      const lastActual = dataMap.get(actualMonths[actualMonths.length - 1]) ?? 0
      const lastX = monthX(actualCount - 1)
      const lastY = bottom - (lastActual / yMax) * h
      ctx.moveTo(lastX, lastY)

      for (const { idx, fp } of fcIndices) {
        ctx.lineTo(monthX(idx), bottom - (fp.predicted / yMax) * h)
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  // End chart clip
  ctx.restore()

  // --- Y-axis labels (drawn outside clip) ---
  ctx.save()
  ctx.fillStyle = 'rgba(160, 180, 210, 0.6)'
  ctx.font = '11px monospace'
  ctx.textAlign = 'right'
  for (let i = 0; i <= ySteps; i++) {
    const y = top + (h / ySteps) * i
    const val = Math.round(yMax - (yMax / ySteps) * i)
    ctx.fillText(String(val), left - 6, y + 3)
  }
  ctx.restore()

  // --- Hover crosshair ---
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

  return { months: actualMonths, combinedMonths, actualCount, yMax, virtualWidth, pxPerMonth }
}

/** Draw a scroll indicator bar below the chart */
export function drawScrollIndicator(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  virtualWidth: number,
  chartWidth: number,
  scrollOffset: number,
  actualCount: number,
  totalCount: number,
) {
  if (virtualWidth <= chartWidth + 1) return  // no scroll needed

  const { left, bottom, w } = layout
  const trackY = bottom + 24
  const trackH = 6
  const trackR = 3

  // Track background
  ctx.save()
  ctx.fillStyle = 'rgba(100, 150, 220, 0.10)'
  ctx.beginPath()
  ctx.roundRect(left, trackY, w, trackH, trackR)
  ctx.fill()

  // Forecast region indicator on track
  const fcRatio = actualCount / totalCount
  const fcX = left + w * fcRatio
  ctx.fillStyle = 'rgba(100, 150, 220, 0.06)'
  ctx.beginPath()
  ctx.roundRect(fcX, trackY, w - (fcX - left), trackH, trackR)
  ctx.fill()

  // Visible window thumb
  const visibleRatio = chartWidth / virtualWidth
  const thumbW = Math.max(20, w * visibleRatio)
  const scrollRatio = scrollOffset / (virtualWidth - chartWidth)
  const thumbX = left + scrollRatio * (w - thumbW)

  ctx.fillStyle = 'rgba(177, 197, 255, 0.35)'
  ctx.beginPath()
  ctx.roundRect(thumbX, trackY, thumbW, trackH, trackR)
  ctx.fill()

  ctx.restore()
}
