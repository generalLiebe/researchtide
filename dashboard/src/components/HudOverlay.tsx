import { useEffect, useMemo, useState } from 'react'
import { useScrambleText } from '../hooks/useScrambleText'
import type { ViewKey } from './TabBar'

const STATUS_CYCLE = [
  'MONITORING GLOBAL RESEARCH STREAMS',
  'ANALYZING CITATION FLOWS',
  'DETECTING WEAK SIGNALS',
  'COMPUTING ETHICS LAG DELTA',
  'UPDATING INFLUENCE GRAPH',
] as const

function nowClock() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function HudOverlay({
  view,
  statusMessage,
}: {
  view: ViewKey
  statusMessage: string
}) {
  const [clock, setClock] = useState(nowClock())
  const [cycleIdx, setCycleIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setClock(nowClock()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCycleIdx((v) => (v + 1) % STATUS_CYCLE.length), 1400)
    return () => clearInterval(t)
  }, [])

  const viewNameRaw = useMemo(
    () => (view === 'world' ? 'WORLD MAP' : view === 'topics' ? 'TOPIC GRAPH' : view === 'papers' ? 'PAPER RANKING' : 'TIMELINE'),
    [view],
  )
  const viewName = useScrambleText(viewNameRaw, { duration: 400 })
  const scrambledCycle = useScrambleText(STATUS_CYCLE[cycleIdx], { duration: 500 })
  const scrambledStatus = useScrambleText(statusMessage, { duration: 600 })

  const hudText: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-hud)',
    letterSpacing: '.2em',
    color: 'var(--text-mono)',
    textTransform: 'uppercase',
  }

  const corner: React.CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: '#b1c5ff',
    borderStyle: 'solid',
    pointerEvents: 'none',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
      {/* corner brackets */}
      <div style={{ ...corner, left: 10, top: 10, borderWidth: '2px 0 0 2px' }} />
      <div style={{ ...corner, right: 10, top: 10, borderWidth: '2px 2px 0 0' }} />
      <div style={{ ...corner, left: 10, bottom: 10, borderWidth: '0 0 2px 2px' }} />
      <div style={{ ...corner, right: 10, bottom: 10, borderWidth: '0 2px 2px 0' }} />

      {/* top bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingInline: 24,
          background: 'rgba(247, 249, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(177, 197, 255, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ ...hudText, fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {`RESEARCHTIDE // ${viewName}`}
          </span>
          <div style={{ width: 1, height: 12, background: 'rgba(177, 197, 255, 0.3)' }} />
          <span style={{ ...hudText, color: 'var(--text-muted)' }}>
            {`STATUS: ${scrambledStatus.replace(/ /g, '_')}`}
          </span>
        </div>
        <span style={{ ...hudText, fontSize: '11px' }}>{clock}</span>
      </div>

      {/* bottom bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingInline: 24,
          background: 'rgba(247, 249, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(177, 197, 255, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={hudText}>NODES ONLINE</span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </div>
        <span style={hudText}>{scrambledCycle}</span>
        <span style={hudText}>{scrambledStatus}</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
