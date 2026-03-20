import { useScrambleText } from '../hooks/useScrambleText'
import { AlertBanner } from './AlertBanner'
import { EthicsLagBar } from './EthicsLagBar'
import { StatCard } from './StatCard'
import { TopicPill } from './TopicPill'
import type { Hub, TopicNode } from '../types/hub'

type Selected =
  | { kind: 'hub'; data: Hub }
  | { kind: 'topic'; data: TopicNode }
  | { kind: 'none' }

function tierColorFromIntensity(intensity: number): string {
  if (intensity >= 90) return 'var(--tier-s)'
  if (intensity >= 75) return 'var(--tier-a)'
  if (intensity >= 65) return 'var(--tier-b)'
  return 'var(--tier-c)'
}

function tierLabelFromIntensity(intensity: number): string {
  if (intensity >= 90) return 'TIER S'
  if (intensity >= 75) return 'TIER A'
  if (intensity >= 65) return 'TIER B'
  return 'TIER C'
}

function tierColorFromStatus(status: TopicNode['status']): string {
  if (status === 'weak') return 'var(--tier-s)'
  if (status === 'rising') return 'var(--tier-a)'
  if (status === 'mainstream') return 'var(--tier-b)'
  return '#888780'
}

function CornerBrackets() {
  const style = (pos: Record<string, number | string>): React.CSSProperties => ({
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: '#b1c5ff',
    borderStyle: 'solid',
    ...pos,
  })

  return (
    <>
      <div style={style({ top: 0, left: 0, borderWidth: '2px 0 0 2px' })} />
      <div style={style({ top: 0, right: 0, borderWidth: '2px 2px 0 0' })} />
      <div style={style({ bottom: 0, left: 0, borderWidth: '0 0 2px 2px' })} />
      <div style={style({ bottom: 0, right: 0, borderWidth: '0 2px 2px 0' })} />
    </>
  )
}

export function DetailPanel({
  selected,
  onClose,
  onDeepAnalysis,
  onDrillDown,
}: {
  selected: Selected
  onClose: () => void
  onDeepAnalysis: () => void
  onDrillDown?: (topic: TopicNode) => void
}) {
  const open = selected.kind !== 'none'

  const base: React.CSSProperties = {
    position: 'absolute',
    top: 54,
    bottom: 32,
    width: 320,
    right: open ? 0 : -340,
    transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'rgba(240, 246, 255, 0.78)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderLeft: '1px solid rgba(177, 197, 255, 0.25)',
    boxShadow: open ? '-4px 0 24px rgba(70, 91, 141, 0.08)' : 'none',
    boxSizing: 'border-box',
    padding: 16,
    overflow: 'auto',
    fontFamily: 'var(--font-headline)',
  }

  const headerMono: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '.15em',
    textTransform: 'uppercase',
  }

  if (selected.kind === 'none') {
    return <aside style={base} aria-hidden={!open} />
  }

  return (
    <aside style={base}>
      {/* Close button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          onClick={onClose}
          style={{
            pointerEvents: 'auto',
            border: 'none',
            background: 'transparent',
            fontSize: 16,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          x
        </button>
      </div>

      {selected.kind === 'hub' ? (
        <HubDetail
          hub={selected.data}
          headerMono={headerMono}
          onDeepAnalysis={onDeepAnalysis}
        />
      ) : (
        <TopicDetail
          topic={selected.data}
          headerMono={headerMono}
          onDeepAnalysis={onDeepAnalysis}
          onDrillDown={onDrillDown}
        />
      )}
    </aside>
  )
}

function HubDetail({
  hub,
  headerMono,
  onDeepAnalysis,
}: {
  hub: Hub
  headerMono: React.CSSProperties
  onDeepAnalysis: () => void
}) {
  const tierColor = tierColorFromIntensity(hub.intensity)
  const tierLabel = tierLabelFromIntensity(hub.intensity)
  const scrambledName = useScrambleText(hub.name, { duration: 450 })

  return (
    <>
      <AlertBanner hub={hub} />

      {/* Header card with corner brackets */}
      <div
        style={{
          position: 'relative',
          padding: 12,
          background: 'rgba(255, 255, 255, 0.5)',
          marginBottom: 16,
        }}
      >
        <CornerBrackets />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span
            style={{
              ...headerMono,
              fontSize: '11px',
              background: tierColor,
              color: '#fff',
              padding: '1px 6px',
            }}
          >
            {tierLabel}
          </span>
          <span style={{ ...headerMono, color: 'var(--text-muted)' }}>
            {hub.region.toUpperCase().replace(/ /g, '_')}
          </span>
        </div>
        <h2
          style={{
            fontSize: 20,
            fontFamily: 'var(--font-headline)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {scrambledName}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            fontWeight: 500,
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          {hub.subtitle}
        </p>
      </div>

      {/* Metrics grid — 1px gap style */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          background: 'rgba(177, 197, 255, 0.15)',
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <StatCard label="Signal Intensity" value={`${hub.intensity}`} color={tierColor} />
        <StatCard
          label="YoY Growth"
          value={`${hub.yoyGrowth >= 0 ? '+' : ''}${hub.yoyGrowth.toFixed(1)}%`}
          color={hub.yoyGrowth >= 0 ? 'var(--success)' : 'var(--alert-ethics)'}
        />
        <StatCard label="Papers" value={`${hub.papersK.toFixed(1)}K`} />
        <StatCard label="Region" value={hub.region} />
      </div>

      {/* Topics */}
      <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 8 }}>
        ACTIVE TOPIC CLUSTERS
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {hub.topics.map((t) => (
          <TopicPill key={t} text={t} />
        ))}
      </div>

      <div style={{ height: 16 }} />
      <ActionButton onClick={onDeepAnalysis} />
    </>
  )
}

function TopicDetail({
  topic,
  headerMono,
  onDeepAnalysis,
  onDrillDown,
}: {
  topic: TopicNode
  headerMono: React.CSSProperties
  onDeepAnalysis: () => void
  onDrillDown?: (topic: TopicNode) => void
}) {
  const statusColor = tierColorFromStatus(topic.status)
  const scrambledLabel = useScrambleText(topic.label, { duration: 450 })

  return (
    <>
      <AlertBanner topic={topic} />

      {/* Header */}
      <h2
        style={{
          fontSize: 18,
          fontFamily: 'var(--font-headline)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          margin: '0 0 6px',
        }}
      >
        {scrambledLabel}
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <span
          style={{
            ...headerMono,
            fontSize: '10px',
            background: `${statusColor}20`,
            color: statusColor,
            padding: '2px 6px',
            border: `1px solid ${statusColor}30`,
          }}
        >
          {`STATUS: ${topic.status.toUpperCase()}`}
        </span>
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          background: 'rgba(177, 197, 255, 0.15)',
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <StatCard label="Growth Rate" value={`+${topic.growth.toFixed(1)}%`} color={statusColor} />
        <StatCard label="Social Pen." value={`${topic.socialPenetration.toFixed(0)}`} />
        <StatCard
          label="Citation Vel."
          value={`${(topic.citationVelocity ?? 0).toFixed(1)}/mo`}
          color="var(--tier-a)"
        />
        <StatCard
          label="Acceleration"
          value={`${(topic.acceleration ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(topic.acceleration ?? 0).toFixed(1)}`}
          color={(topic.acceleration ?? 0) >= 0 ? 'var(--success)' : 'var(--alert-ethics)'}
        />
      </div>

      {/* Ethics Lag */}
      <div style={{ marginBottom: 16 }}>
        <EthicsLagBar ethicLagMonths={topic.ethicLag} />
      </div>

      {/* Influences */}
      {topic.influences.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              ...headerMono,
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--bg-tertiary)',
              paddingBottom: 4,
              marginBottom: 8,
            }}
          >
            INFLUENCES
          </div>
          {topic.influences.slice(0, 8).map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-primary)',
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              <span style={{ color: 'var(--tier-a)', fontSize: 12 }}>&rarr;</span>
              {t}
            </div>
          ))}
        </div>
      )}

      {topic.influencedBy.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              ...headerMono,
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--bg-tertiary)',
              paddingBottom: 4,
              marginBottom: 8,
            }}
          >
            INFLUENCED BY
          </div>
          {topic.influencedBy.slice(0, 8).map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12 }}>&larr;</span>
              {t}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 8 }} />
      {onDrillDown && topic.childCount != null && topic.childCount > 0 && (
        <>
          <button
            onClick={() => onDrillDown(topic)}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              border: 'none',
              padding: '10px 16px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #1a4a6e, #0d3454)',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
              marginBottom: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #0d3454, #062540)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #1a4a6e, #0d3454)' }}
          >
            DRILL DOWN
            <span style={{ fontSize: 12 }}>&#x25BC;</span>
          </button>
        </>
      )}
      <ActionButton onClick={onDeepAnalysis} />
    </>
  )
}

function ActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        pointerEvents: 'auto',
        width: '100%',
        border: 'none',
        padding: '10px 16px',
        cursor: 'pointer',
        background: 'linear-gradient(135deg, #465b8d, #314576)',
        color: '#fff',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(135deg, #314576, #1a2e5a)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(135deg, #465b8d, #314576)'
      }}
    >
      DEEP ANALYSIS
      <span style={{ fontSize: 12 }}>&rarr;</span>
    </button>
  )
}
