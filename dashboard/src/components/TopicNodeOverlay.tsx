import { useMemo } from 'react'
import type { Edge, TopicNode } from '../types/hub'
import { classifyAllTopics } from '../utils/topicClassification'

function statusColor(status: TopicNode['status']): string {
  if (status === 'weak') return '#e8a020'
  if (status === 'rising') return '#3a7ad4'
  if (status === 'mainstream') return '#2ab8a0'
  return '#888780'
}

export function TopicNodeOverlay({
  topics,
  edges,
  layoutDims,
  onSelectTopic,
}: {
  topics: TopicNode[]
  edges: Edge[]
  layoutDims: { w: number; h: number }
  onSelectTopic: (t: TopicNode) => void
}) {
  const { w, h } = layoutDims

  const signals = useMemo(() => classifyAllTopics(topics, edges), [topics, edges])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: w,
        height: h,
        pointerEvents: 'none',
      }}
    >
      {topics.map((t) => {
        const cx = t.x * w
        const cy = t.y * h
        const signal = signals.get(t.id) ?? 'normal'
        const sizeMultiplier = signal === 'trending' ? 1.15 : 1
        const displayR = Math.max(28, t.radius * 2.2) * sizeMultiplier
        const diameter = displayR * 2
        const color = statusColor(t.status)
        const accel = t.acceleration ?? 0
        const isWeak = t.status === 'weak'
        const isDisplaced = t.status === 'displaced'
        const fontSize = diameter > 70 ? 11 : diameter > 50 ? 10 : 9

        const extraShadow =
          signal === 'trending'
            ? `0 0 20px ${color}80, 0 0 40px ${color}40`
            : signal === 'underrated'
              ? '0 0 16px rgba(232, 160, 32, 0.4)'
              : `0 0 12px ${color}30`

        const outline =
          signal === 'underrated'
            ? { outline: '2px dashed #e8a020', outlineOffset: '3px' }
            : {}

        return (
          <div
            key={t.id}
            data-topic-node
            onClick={() => onSelectTopic(t)}
            style={{
              position: 'absolute',
              left: cx - displayR,
              top: cy - displayR,
              width: diameter,
              height: diameter,
              borderRadius: '50%',
              background: 'rgba(13, 31, 60, 0.75)',
              border: `2px ${isWeak ? 'dashed' : 'solid'} ${color}`,
              opacity: isDisplaced ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              boxSizing: 'border-box',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'transform 0.15s ease',
              boxShadow: extraShadow,
              animation: signal === 'trending'
                ? `pulse-glow ${accel > 3 ? '0.8s' : accel > 1 ? '1.2s' : '2s'} ease-in-out infinite`
                : accel <= 0 ? undefined : `pulse-glow ${Math.max(1, 3 - accel)}s ease-in-out infinite`,
              ...outline,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize,
                fontWeight: 600,
                color: 'rgba(220, 235, 255, 0.9)',
                textAlign: 'center',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}
            >
              {t.label}
            </span>

            {/* Trending badge */}
            {signal === 'trending' && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -2,
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontWeight: 700,
                  color,
                }}
              >
                ▲
              </span>
            )}

            {/* Underrated badge */}
            {signal === 'underrated' && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  left: -2,
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontWeight: 700,
                  color: '#e8a020',
                }}
              >
                ◆
              </span>
            )}
          </div>
        )
      })}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
        }
      `}</style>
    </div>
  )
}
