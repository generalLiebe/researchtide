import { useCallback, useEffect, useRef, useState } from 'react'
import { useTimelineData } from '../hooks/useTimelineData'
import { resizeCanvasToParent, computeChartLayout, drawTimelineChart, TIER_COLORS } from './canvas'

export function TimelineView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { data, error } = useTimelineData()
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; month: string; values: { cat: string; count: number }[] } | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dims = resizeCanvasToParent(canvas)
    if (!dims) return
    const { w, h, dpr } = dims

    ctx.save()
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#0d1f3c'
    ctx.fillRect(0, 0, w, h)

    // Stars
    ctx.fillStyle = 'rgba(177, 197, 255, 0.15)'
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5) % w)
      const sy = ((i * 97.3 + 13) % h)
      ctx.fillRect(sx, sy, 1, 1)
    }

    if (data && data.series.length > 0) {
      const layout = computeChartLayout(w, h)
      drawTimelineChart(ctx, data.series, layout, highlightIdx, hoverX)
    } else if (!data && !error) {
      ctx.fillStyle = 'rgba(177, 197, 255, 0.4)'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('LOADING TIMELINE DATA...', w / 2, h / 2)
    } else if (error) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.6)'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('TIMELINE DATA UNAVAILABLE', w / 2, h / 2)
    }

    ctx.restore()
  }, [data, error, highlightIdx, hoverX])

  useEffect(() => {
    draw()
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || !data) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setHoverX(mx)

      const dims = { w: rect.width, h: rect.height }
      const layout = computeChartLayout(dims.w, dims.h)

      // Find which month we're hovering
      const allMonths = new Set<string>()
      for (const s of data.series) {
        for (const m of s.monthly) allMonths.add(m.month)
      }
      const months = Array.from(allMonths).sort()
      if (months.length === 0) return

      const step = layout.w / (months.length - 1 || 1)
      const idx = Math.round((mx - layout.left) / step)
      if (idx >= 0 && idx < months.length) {
        const month = months[idx]
        const values: { cat: string; count: number }[] = []
        for (const s of data.series) {
          const found = s.monthly.find((m) => m.month === month)
          if (found && found.count > 0) values.push({ cat: s.category, count: found.count })
        }
        values.sort((a, b) => b.count - a.count)
        setTooltip({ x: e.clientX - rect.left, y: my, month, values: values.slice(0, 5) })
      }
    },
    [data],
  )

  const handleMouseLeave = useCallback(() => {
    setHoverX(null)
    setTooltip(null)
  }, [])

  const headerMono: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '.15em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 0, height: '100%' }}>
      {/* Chart area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', width: '100%', borderRadius: 4 }}
        />

        {/* Tooltip */}
        {tooltip && tooltip.values.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 400) - 160),
              top: tooltip.y - 10,
              background: 'rgba(13, 31, 60, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(177, 197, 255, 0.2)',
              padding: '6px 8px',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 120,
            }}
          >
            <div style={{ ...headerMono, color: 'rgba(177, 197, 255, 0.7)', marginBottom: 4 }}>
              {tooltip.month}
            </div>
            {tooltip.values.map((v) => (
              <div
                key={v.cat}
                style={{
                  ...headerMono,
                  fontSize: '9px',
                  color: '#e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 1,
                }}
              >
                <span>{v.cat}</span>
                <span style={{ color: '#93c5fd' }}>{v.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acceleration ranking panel */}
      <div
        style={{
          width: 200,
          background: 'rgba(240, 246, 255, 0.78)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(177, 197, 255, 0.25)',
          padding: 12,
          overflow: 'auto',
          fontFamily: 'var(--font-headline)',
        }}
      >
        <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 10 }}>
          ACCELERATION RANKING
        </div>

        {data?.series
          .slice()
          .sort((a, b) => Math.abs(b.acceleration) - Math.abs(a.acceleration))
          .map((s) => {
            const origIdx = data.series.indexOf(s)
            const color = TIER_COLORS[origIdx % TIER_COLORS.length]
            const isActive = highlightIdx === null || highlightIdx === origIdx
            const arrow = s.acceleration > 0 ? '↑' : s.acceleration < 0 ? '↓' : '→'
            const arrowColor = s.acceleration > 0 ? '#10b981' : s.acceleration < 0 ? '#ef4444' : '#94a3b8'

            return (
              <div
                key={s.category}
                onClick={() => setHighlightIdx(highlightIdx === origIdx ? null : origIdx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 6px',
                  marginBottom: 2,
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.4,
                  background: highlightIdx === origIdx ? 'rgba(177, 197, 255, 0.1)' : 'transparent',
                  transition: 'opacity 0.2s, background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.category}
                  </div>
                </div>
                <span style={{ ...headerMono, color: arrowColor, fontSize: '11px', flexShrink: 0 }}>
                  {arrow} {Math.abs(s.acceleration).toFixed(1)}
                </span>
                {s.acceleration > 2.0 && (
                  <span
                    style={{
                      ...headerMono,
                      fontSize: '8px',
                      color: '#d4a017',
                      background: 'rgba(212, 160, 23, 0.15)',
                      border: '1px solid rgba(212, 160, 23, 0.3)',
                      padding: '1px 4px',
                      flexShrink: 0,
                      fontWeight: 700,
                    }}
                  >
                    ▲ SIGNAL
                  </span>
                )}
                {s.acceleration < -5.0 && (
                  <span
                    style={{
                      ...headerMono,
                      fontSize: '8px',
                      color: '#94a3b8',
                      background: 'rgba(148, 163, 184, 0.12)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      padding: '1px 4px',
                      flexShrink: 0,
                      fontWeight: 700,
                    }}
                  >
                    ▼ FADING
                  </span>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
