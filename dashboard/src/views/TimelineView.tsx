import { useCallback, useEffect, useRef, useState } from 'react'
import { useTimelineData } from '../hooks/useTimelineData'
import { useHorizonAlerts } from '../hooks/useHorizonAlerts'
import {
  resizeCanvasToParent,
  computeChartLayout,
  drawTimelineChart,
  drawScrollIndicator,
  TIER_COLORS,
} from './canvas'
import type { TimelineChartResult } from './canvas'
import type { HorizonAlert } from '../types/hub'

export function TimelineView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { data, error } = useTimelineData()
  const { data: horizonData } = useHorizonAlerts()
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const chartResultRef = useRef<TimelineChartResult | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    month: string
    isForecast: boolean
    values: { cat: string; count: number; predicted?: boolean }[]
  } | null>(null)

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
      const hasScroll = chartResultRef.current
        ? chartResultRef.current.virtualWidth > w - 76
        : false
      const layout = computeChartLayout(w, h, hasScroll)
      const result = drawTimelineChart(ctx, data.series, layout, highlightIdx, hoverX, scrollOffset)
      chartResultRef.current = result

      // Draw scroll indicator if needed
      if (result && result.virtualWidth > layout.w + 1) {
        drawScrollIndicator(
          ctx,
          layout,
          result.virtualWidth,
          layout.w,
          scrollOffset,
          result.actualCount,
          result.combinedMonths.length,
        )
      }
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
  }, [data, error, highlightIdx, hoverX, scrollOffset])

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

      const result = chartResultRef.current
      if (!result) return

      const { combinedMonths, actualCount, pxPerMonth } = result
      const layout = computeChartLayout(rect.width, rect.height)

      // Find which month we're hovering (accounting for scroll)
      const idx = Math.round((mx - layout.left + scrollOffset) / pxPerMonth)
      if (idx >= 0 && idx < combinedMonths.length) {
        const month = combinedMonths[idx]
        const isForecast = idx >= actualCount
        const values: { cat: string; count: number; predicted?: boolean }[] = []

        if (isForecast) {
          // Show forecast values
          for (const s of data.series) {
            if (!s.forecast) continue
            const fp = s.forecast.find((f) => f.month === month)
            if (fp) values.push({ cat: s.category, count: Math.round(fp.predicted), predicted: true })
          }
        } else {
          // Show actual values
          for (const s of data.series) {
            const found = s.monthly.find((m) => m.month === month)
            if (found && found.count > 0) values.push({ cat: s.category, count: found.count })
          }
        }

        values.sort((a, b) => b.count - a.count)
        setTooltip({ x: mx, y: my, month, isForecast, values: values.slice(0, 5) })
      } else {
        setTooltip(null)
      }
    },
    [data, scrollOffset],
  )

  const handleMouseLeave = useCallback(() => {
    setHoverX(null)
    setTooltip(null)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const result = chartResultRef.current
      if (!result) return
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const layout = computeChartLayout(rect.width, rect.height)
      const maxScroll = Math.max(0, result.virtualWidth - layout.w)
      if (maxScroll <= 0) return

      // Use deltaX for horizontal scroll, deltaY with Shift for horizontal
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      setScrollOffset((prev) => Math.max(0, Math.min(maxScroll, prev + delta)))
    },
    [],
  )

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
          onWheel={handleWheel}
          style={{ display: 'block', width: '100%', borderRadius: 4 }}
        />

        {/* Tooltip */}
        {tooltip && tooltip.values.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 400) - 180),
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
            <div style={{ ...headerMono, color: 'rgba(177, 197, 255, 0.7)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>{tooltip.month}</span>
              {tooltip.isForecast && (
                <span style={{ fontSize: '8px', color: 'rgba(177, 197, 255, 0.4)', fontStyle: 'italic' }}>
                  FORECAST
                </span>
              )}
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
                <span style={{ color: v.predicted ? 'rgba(147, 197, 253, 0.6)' : '#93c5fd' }}>
                  {v.predicted ? '~' : ''}{v.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar: Horizon Signals + Acceleration ranking */}
      <div
        style={{
          width: 220,
          background: 'rgba(240, 246, 255, 0.78)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(177, 197, 255, 0.25)',
          padding: 12,
          overflow: 'auto',
          fontFamily: 'var(--font-headline)',
        }}
      >
        {/* Horizon Signals section */}
        {horizonData && horizonData.alerts.length > 0 && (
          <>
            <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 8 }}>
              HORIZON SIGNALS
            </div>
            {horizonData.alerts.slice(0, 8).map((alert: HorizonAlert) => {
              const levelConfig = {
                breakthrough: {
                  color: '#ef4444',
                  bg: 'rgba(239, 68, 68, 0.12)',
                  border: 'rgba(239, 68, 68, 0.35)',
                  label: 'BREAKTHROUGH SIGNAL',
                  blink: true,
                },
                emerging: {
                  color: '#f59e0b',
                  bg: 'rgba(245, 158, 11, 0.10)',
                  border: 'rgba(245, 158, 11, 0.30)',
                  label: 'EMERGING',
                  blink: false,
                },
                watch: {
                  color: '#eab308',
                  bg: 'rgba(234, 179, 8, 0.08)',
                  border: 'rgba(234, 179, 8, 0.25)',
                  label: 'WATCH',
                  blink: false,
                },
              }[alert.alert_level] || {
                color: '#94a3b8',
                bg: 'rgba(148, 163, 184, 0.08)',
                border: 'rgba(148, 163, 184, 0.2)',
                label: alert.alert_level.toUpperCase(),
                blink: false,
              }

              return (
                <div
                  key={alert.topic}
                  style={{
                    padding: '6px 8px',
                    marginBottom: 4,
                    background: levelConfig.bg,
                    border: `1px solid ${levelConfig.border}`,
                    borderRadius: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span
                      style={{
                        ...headerMono,
                        fontSize: '8px',
                        color: levelConfig.color,
                        fontWeight: 700,
                        animation: levelConfig.blink ? 'pulse 1.5s ease-in-out infinite' : undefined,
                      }}
                    >
                      {alert.alert_level === 'breakthrough' ? '\u26A0 ' : ''}{levelConfig.label}
                    </span>
                    <span
                      style={{
                        ...headerMono,
                        fontSize: '9px',
                        color: levelConfig.color,
                        marginLeft: 'auto',
                      }}
                    >
                      {alert.score.toFixed(0)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 2,
                    }}
                  >
                    {alert.topic}
                  </div>
                  {alert.cross_field.length > 0 && (
                    <div
                      style={{
                        ...headerMono,
                        fontSize: '8px',
                        color: 'var(--text-muted)',
                        lineHeight: 1.3,
                      }}
                    >
                      {'\u2192'} {alert.cross_field.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
            <div
              style={{
                height: 1,
                background: 'rgba(177, 197, 255, 0.15)',
                margin: '10px 0',
              }}
            />
          </>
        )}

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
