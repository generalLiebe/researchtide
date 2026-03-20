import { ScrambleText } from '../hooks/useScrambleText'
import type { BreadcrumbEntry } from '../types/hub'

export function BreadcrumbNav({
  breadcrumb,
  onNavigate,
  isLoading,
}: {
  breadcrumb: BreadcrumbEntry[]
  onNavigate: (index: number) => void
  isLoading: boolean
}) {
  if (breadcrumb.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: 'rgba(13, 31, 60, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(100, 150, 220, 0.35)',
        borderRadius: 4,
        padding: '4px 10px',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
      }}
    >
      {/* Root */}
      <span
        onClick={() => onNavigate(0)}
        style={{
          color: 'rgba(177, 197, 255, 0.6)',
          cursor: 'pointer',
          padding: '2px 4px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(177, 197, 255, 1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(177, 197, 255, 0.6)' }}
      >
        ROOT
      </span>

      {breadcrumb.map((entry, i) => {
        const isLast = i === breadcrumb.length - 1
        return (
          <span key={`${entry.level}-${entry.label}`} style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'rgba(100, 150, 220, 0.4)', margin: '0 2px' }}>&gt;</span>
            <span
              onClick={isLast ? undefined : () => onNavigate(i + 1)}
              style={{
                color: isLast ? 'rgba(220, 235, 255, 0.9)' : 'rgba(177, 197, 255, 0.6)',
                cursor: isLast ? 'default' : 'pointer',
                padding: '2px 4px',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!isLast) e.currentTarget.style.color = 'rgba(177, 197, 255, 1)' }}
              onMouseLeave={(e) => { if (!isLast) e.currentTarget.style.color = 'rgba(177, 197, 255, 0.6)' }}
            >
              {isLast ? <ScrambleText text={entry.label} duration={350} enabled /> : entry.label}
            </span>
          </span>
        )
      })}

      {isLoading && (
        <span style={{ color: 'rgba(177, 197, 255, 0.5)', marginLeft: 8, animation: 'pulse 1.5s ease-in-out infinite' }}>
          ...
        </span>
      )}
    </div>
  )
}
