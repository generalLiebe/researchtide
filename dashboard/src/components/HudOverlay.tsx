import { useEffect, useMemo, useState } from 'react'
import { useScrambleText } from '../hooks/useScrambleText'
import type { HealthData } from '../types/hub'
import type { ViewKey } from './TabBar'

function nowClock() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}S AGO`
  if (seconds < 3600) return `${Math.round(seconds / 60)}M AGO`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}H ${m}M AGO` : `${h}H AGO`
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}S`
  if (seconds < 3600) return `${Math.round(seconds / 60)}M`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}H ${m}M`
}

export function HudOverlay({
  view,
  health,
}: {
  view: ViewKey
  health: HealthData | null
}) {
  const [clock, setClock] = useState(nowClock())
  const [infoIdx, setInfoIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setClock(nowClock()), 1000)
    return () => clearInterval(t)
  }, [])

  // Cycle through real status info
  const infoMessages = useMemo(() => {
    if (!health) return ['CONNECTING TO API...']
    const msgs: string[] = []

    // Data freshness
    const papersCache = health.caches?.papers
    if (papersCache?.exists && papersCache.age_seconds != null) {
      msgs.push(`DATA UPDATED ${formatAge(papersCache.age_seconds)}`)
    }

    // Keywords status
    const kwCache = health.caches?.keywords
    if (kwCache?.exists) {
      msgs.push('KEYWORDS INDEXED')
    } else {
      msgs.push('KEYWORDS PENDING')
    }

    // Hierarchy status
    const hierCache = health.caches?.hierarchy
    if (hierCache?.exists) {
      msgs.push('TOPIC HIERARCHY READY')
    }

    // Uptime
    msgs.push(`UPTIME ${formatUptime(health.uptime_seconds)}`)

    // Version
    msgs.push(`VERSION ${health.version}`)

    return msgs
  }, [health])

  useEffect(() => {
    const t = setInterval(() => setInfoIdx((v) => (v + 1) % infoMessages.length), 3000)
    return () => clearInterval(t)
  }, [infoMessages.length])

  const viewNameRaw = useMemo(
    () => (view === 'world' ? 'WORLD MAP' : view === 'topics' ? 'TOPIC GRAPH' : view === 'papers' ? 'PAPER RANKING' : 'TIMELINE'),
    [view],
  )
  const viewName = useScrambleText(viewNameRaw, { duration: 400 })

  const statusText = useMemo(() => {
    if (!health) return 'CONNECTING'
    return health.status === 'ok' ? 'SYSTEM NOMINAL' : 'SYSTEM DEGRADED'
  }, [health])
  const scrambledStatus = useScrambleText(statusText, { duration: 600 })

  const scrambledInfo = useScrambleText(infoMessages[infoIdx % infoMessages.length], { duration: 500 })

  // Node status
  const nodeText = useMemo(() => {
    if (!health) return 'CONNECTING'
    if (health.paper_count > 0) return `${health.paper_count} PAPERS INDEXED`
    return 'NO DATA'
  }, [health])

  const statusColor = !health ? 'var(--text-muted)' : health.status === 'ok' ? 'var(--success)' : '#f59e0b'
  const nodeOnline = health?.paper_count ? true : false

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
          <span style={{ ...hudText, color: statusColor }}>
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
          <span style={hudText}>{nodeText}</span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: nodeOnline ? 'var(--success)' : '#ef4444',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </div>
        <span style={hudText}>{scrambledInfo}</span>
        <span style={{ ...hudText, color: statusColor }}>{scrambledStatus}</span>
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
