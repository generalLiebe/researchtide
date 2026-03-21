import type { KeywordMetric, MonthlyCount, ForecastPoint } from '../types/hub'

export interface BubbleLayout {
  left: number
  right: number
  top: number
  bottom: number
  w: number
  h: number
}

export function computeBubbleLayout(canvasW: number, canvasH: number): BubbleLayout {
  const left = 56
  const right = canvasW - 20
  const top = 40
  const bottom = canvasH - 36
  return { left, right, top, bottom, w: right - left, h: bottom - top }
}

export interface BubblePoint {
  idx: number
  x: number
  y: number
  r: number
  keyword: string
  score: number
  count: number
  velocity: number
}

/** Score → color gradient: blue(0) → amber(50) → red(100) */
function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100
  if (t < 0.5) {
    const s = t * 2
    const r = Math.round(99 + (245 - 99) * s)
    const g = Math.round(102 + (158 - 102) * s)
    const b = Math.round(241 + (11 - 241) * s)
    return `rgb(${r},${g},${b})`
  }
  const s = (t - 0.5) * 2
  const r = Math.round(245 + (239 - 245) * s)
  const g = Math.round(158 + (68 - 158) * s)
  const b = Math.round(11 + (68 - 11) * s)
  return `rgb(${r},${g},${b})`
}

export function drawKeywordBubbles(
  ctx: CanvasRenderingContext2D,
  keywords: KeywordMetric[],
  layout: BubbleLayout,
  hoverIdx: number | null,
  selectedIdx: number | null,
): BubblePoint[] {
  const { left, right, top, bottom, w, h } = layout
  if (keywords.length === 0) return []

  // Compute ranges
  const maxCount = Math.max(...keywords.map((k) => k.total_count))
  const velocities = keywords.map((k) => k.velocity)
  const minVel = Math.min(...velocities, 0)
  const maxVel = Math.max(...velocities, 1)
  const velRange = maxVel - minVel || 1

  // Find peak month for each keyword → X position
  const allMonths = new Set<string>()
  for (const k of keywords) {
    for (const m of k.monthly) allMonths.add(m.month)
  }
  const months = Array.from(allMonths).sort()
  const monthIdx = new Map(months.map((m, i) => [m, i]))

  // Build bubble points
  const points: BubblePoint[] = []
  for (let i = 0; i < keywords.length; i++) {
    const k = keywords[i]

    // Peak month (highest count)
    let peakMonth = k.monthly[0]?.month ?? months[0]
    let peakCount = 0
    for (const m of k.monthly) {
      if (m.count > peakCount) {
        peakCount = m.count
        peakMonth = m.month
      }
    }
    const mi = monthIdx.get(peakMonth) ?? 0
    const x = left + (mi / Math.max(months.length - 1, 1)) * w
    const y = bottom - ((k.velocity - minVel) / velRange) * h
    const r = 6 + (k.total_count / maxCount) * 30

    points.push({ idx: i, x, y, r, keyword: k.keyword, score: k.horizon_score, count: k.total_count, velocity: k.velocity })
  }

  // Axis labels
  ctx.save()
  ctx.fillStyle = 'rgba(160, 180, 210, 0.5)'
  ctx.font = '9px monospace'

  // Y-axis label
  ctx.save()
  ctx.translate(14, top + h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillText('VELOCITY', 0, 0)
  ctx.restore()

  // X-axis label
  ctx.textAlign = 'center'
  ctx.fillText('PEAK ACTIVITY', left + w / 2, bottom + 28)

  // X-axis month ticks
  for (let i = 0; i < months.length; i++) {
    if (i % 4 !== 0 && i !== months.length - 1) continue
    const x = left + (i / Math.max(months.length - 1, 1)) * w
    ctx.fillText(months[i], x, bottom + 14)
  }

  // Y-axis velocity ticks
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (i / 4) * h
    const val = minVel + (i / 4) * velRange
    ctx.fillText(val.toFixed(1), left - 6, y + 3)
  }
  ctx.restore()

  // Grid
  ctx.save()
  ctx.strokeStyle = 'rgba(100, 150, 220, 0.06)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (i / 4) * h
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
  ctx.restore()

  // Draw bubbles
  for (const p of points) {
    const isHover = hoverIdx === p.idx
    const isSel = selectedIdx === p.idx
    const color = scoreColor(p.score)

    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.globalAlpha = isHover || isSel ? 0.85 : 0.5
    ctx.fillStyle = color
    ctx.fill()

    if (isHover || isSel) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.8
      ctx.stroke()
    }
    ctx.restore()

    // Label for larger or hovered bubbles
    if (p.r > 14 || isHover || isSel) {
      ctx.save()
      ctx.fillStyle = isHover || isSel ? '#fff' : 'rgba(220, 230, 255, 0.7)'
      ctx.font = `${isHover || isSel ? 11 : 9}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(
        p.keyword.length > 18 ? p.keyword.slice(0, 16) + '..' : p.keyword,
        p.x,
        p.y - p.r - 4,
      )
      ctx.restore()
    }
  }

  return points
}

/** Draw a mini sparkline for the keyword table */
export function drawMiniSparkline(
  canvas: HTMLCanvasElement,
  monthly: MonthlyCount[],
  forecast: ForecastPoint[],
  color: string,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.scale(dpr, dpr)

  const pad = 2
  const chartW = w - pad * 2
  const chartH = h - pad * 2

  const allCounts = monthly.map((m) => m.count)
  const fcCounts = forecast.map((f) => f.predicted)
  const max = Math.max(...allCounts, ...fcCounts, 1)
  const totalLen = monthly.length + forecast.length

  // Background
  ctx.fillStyle = 'rgba(13, 31, 60, 0.3)'
  ctx.fillRect(0, 0, w, h)

  // Actual data line
  if (monthly.length > 1) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    for (let i = 0; i < monthly.length; i++) {
      const x = pad + (i / Math.max(totalLen - 1, 1)) * chartW
      const y = pad + chartH - (monthly[i].count / max) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // Forecast dashed line
  if (forecast.length > 0 && monthly.length > 0) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.5
    ctx.setLineDash([3, 2])
    ctx.beginPath()

    // Start from last actual point
    const lastI = monthly.length - 1
    const lastX = pad + (lastI / Math.max(totalLen - 1, 1)) * chartW
    const lastY = pad + chartH - (monthly[lastI].count / max) * chartH
    ctx.moveTo(lastX, lastY)

    for (let i = 0; i < forecast.length; i++) {
      const x = pad + ((monthly.length + i) / Math.max(totalLen - 1, 1)) * chartW
      const y = pad + chartH - (forecast[i].predicted / max) * chartH
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }
}
