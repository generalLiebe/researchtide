import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeywordData } from '../hooks/useKeywordData'
import { resizeCanvasToParent } from './canvas'
import { computeBubbleLayout, drawKeywordBubbles, drawMiniSparkline } from './keywordCanvas'
import type { BubblePoint } from './keywordCanvas'
import type { KeywordMetric } from '../types/hub'

type SortKey = 'horizon' | 'frequency' | 'velocity' | 'acceleration'

function scoreColor(score: number): string {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#eab308'
}

function Sparkline({ kw, color }: { kw: KeywordMetric; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawMiniSparkline(ref.current, kw.monthly, kw.forecast, color)
  }, [kw, color])
  return <canvas ref={ref} style={{ width: 80, height: 24, display: 'block', borderRadius: 2 }} />
}

export function KeywordsView({ onKeywordClick }: { onKeywordClick?: (keyword: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { data, error } = useKeywordData()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('horizon')
  const [emergingOnly, setEmergingOnly] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; kw: KeywordMetric } | null>(null)
  const bubblesRef = useRef<BubblePoint[]>([])

  const sortedKeywords = useCallback(() => {
    if (!data) return []
    let kws = [...data.keywords]
    if (emergingOnly) kws = kws.filter((k) => k.is_emerging)
    kws.sort((a, b) => {
      switch (sortBy) {
        case 'horizon': return b.horizon_score - a.horizon_score
        case 'frequency': return b.total_count - a.total_count
        case 'velocity': return b.velocity - a.velocity
        case 'acceleration': return Math.abs(b.acceleration) - Math.abs(a.acceleration)
      }
    })
    return kws
  }, [data, sortBy, emergingOnly])

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
    ctx.fillStyle = 'rgba(177, 197, 255, 0.12)'
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 137.5) % w, (i * 97.3 + 13) % h, 1, 1)
    }

    if (data && data.keywords.length > 0) {
      const layout = computeBubbleLayout(w, h)

      // Title
      ctx.fillStyle = 'rgba(177, 197, 255, 0.5)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.letterSpacing = '0.15em'
      ctx.fillText('KEYWORD LANDSCAPE', layout.left, 20)

      const bubbles = drawKeywordBubbles(ctx, data.keywords, layout, hoverIdx, selectedIdx)
      bubblesRef.current = bubbles
    } else if (!data && !error) {
      ctx.fillStyle = 'rgba(177, 197, 255, 0.4)'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('LOADING KEYWORD DATA...', w / 2, h / 2)
    } else if (error) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.6)'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('KEYWORD DATA UNAVAILABLE', w / 2, h / 2)
    }

    ctx.restore()
  }, [data, error, hoverIdx, selectedIdx])

  useEffect(() => {
    draw()
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !data) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Hit test bubbles
    let found: number | null = null
    for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
      const p = bubblesRef.current[i]
      const dx = mx - p.x
      const dy = my - p.y
      if (dx * dx + dy * dy <= p.r * p.r) {
        found = p.idx
        break
      }
    }
    setHoverIdx(found)

    if (found !== null && data.keywords[found]) {
      setTooltip({ x: mx, y: my, kw: data.keywords[found] })
    } else {
      setTooltip(null)
    }
  }, [data])

  const handleCanvasClick = useCallback(() => {
    if (hoverIdx !== null) {
      setSelectedIdx(hoverIdx === selectedIdx ? null : hoverIdx)
    }
  }, [hoverIdx, selectedIdx])

  const headerMono: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '.15em',
    textTransform: 'uppercase',
  }

  const sorted = sortedKeywords()

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 0, height: '100%' }}>
      {/* Bubble chart area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => { setHoverIdx(null); setTooltip(null) }}
          onClick={handleCanvasClick}
          style={{ display: 'block', width: '100%', cursor: hoverIdx !== null ? 'pointer' : 'default', borderRadius: 4 }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 400) - 200),
              top: tooltip.y - 10,
              background: 'rgba(13, 31, 60, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(177, 197, 255, 0.2)',
              padding: '8px 10px',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 150,
            }}
          >
            <div style={{ ...headerMono, color: '#e2e8f0', fontSize: '11px', marginBottom: 4 }}>
              {tooltip.kw.keyword}
            </div>
            <div style={{ ...headerMono, fontSize: '9px', color: 'rgba(177, 197, 255, 0.7)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>PAPERS: {tooltip.kw.paper_count}</span>
              <span>VELOCITY: {tooltip.kw.velocity > 0 ? '+' : ''}{tooltip.kw.velocity.toFixed(1)}</span>
              <span>HORIZON: {tooltip.kw.horizon_score.toFixed(0)}</span>
              {tooltip.kw.fields.length > 0 && (
                <span>FIELDS: {tooltip.kw.fields.slice(0, 3).join(', ')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keyword table sidebar */}
      <div
        style={{
          width: 340,
          background: 'rgba(240, 246, 255, 0.78)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(177, 197, 255, 0.25)',
          padding: 12,
          overflow: 'auto',
          fontFamily: 'var(--font-headline)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sort controls */}
        <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 8 }}>
          KEYWORD TRENDS
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {(['horizon', 'frequency', 'velocity', 'acceleration'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{
                ...headerMono,
                fontSize: '8px',
                padding: '2px 6px',
                border: `1px solid ${sortBy === key ? 'rgba(100, 150, 220, 0.5)' : 'rgba(100, 150, 220, 0.2)'}`,
                borderRadius: 3,
                background: sortBy === key ? 'rgba(100, 150, 220, 0.15)' : 'transparent',
                color: sortBy === key ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {key}
            </button>
          ))}
          <button
            onClick={() => setEmergingOnly(!emergingOnly)}
            style={{
              ...headerMono,
              fontSize: '8px',
              padding: '2px 6px',
              border: `1px solid ${emergingOnly ? 'rgba(245, 158, 11, 0.5)' : 'rgba(100, 150, 220, 0.2)'}`,
              borderRadius: 3,
              background: emergingOnly ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
              color: emergingOnly ? '#f59e0b' : 'var(--text-muted)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            EMERGING
          </button>
        </div>

        {/* Keyword list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sorted.map((kw) => {
            const arrow = kw.velocity > 0 ? '\u2191' : kw.velocity < 0 ? '\u2193' : '\u2192'
            const arrowColor = kw.velocity > 0 ? '#10b981' : kw.velocity < 0 ? '#ef4444' : '#94a3b8'
            const sc = scoreColor(kw.horizon_score)
            const levelLabel = kw.horizon_alert_level === 'breakthrough'
              ? 'BREAKTHROUGH'
              : kw.horizon_alert_level === 'emerging'
              ? 'EMERGING'
              : 'WATCH'
            const isSelected = selectedIdx !== null && data?.keywords[selectedIdx]?.keyword === kw.keyword

            return (
              <div
                key={kw.keyword}
                onClick={() => onKeywordClick?.(kw.keyword)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 6px',
                  marginBottom: 2,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(100, 150, 220, 0.12)' : 'transparent',
                  borderRadius: 3,
                  transition: 'background 0.15s',
                }}
              >
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
                    {kw.keyword}
                  </div>
                  {kw.fields.length > 0 && (
                    <div style={{ ...headerMono, fontSize: '8px', color: 'var(--text-muted)', marginTop: 1 }}>
                      {kw.fields.slice(0, 2).join(', ')}
                    </div>
                  )}
                </div>

                <Sparkline kw={kw} color={sc} />

                <span style={{ ...headerMono, color: arrowColor, fontSize: '10px', flexShrink: 0, width: 36, textAlign: 'right' }}>
                  {arrow} {Math.abs(kw.velocity).toFixed(1)}
                </span>

                <span
                  style={{
                    ...headerMono,
                    fontSize: '7px',
                    color: sc,
                    background: `${sc}18`,
                    border: `1px solid ${sc}40`,
                    padding: '1px 4px',
                    flexShrink: 0,
                    fontWeight: 700,
                    borderRadius: 2,
                    minWidth: 48,
                    textAlign: 'center',
                  }}
                >
                  {levelLabel}
                </span>
              </div>
            )
          })}
          {sorted.length === 0 && data && (
            <div style={{ ...headerMono, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
              {emergingOnly ? 'NO EMERGING KEYWORDS' : 'NO KEYWORD DATA'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
