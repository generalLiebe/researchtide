import type { Hub, TopicNode } from '../types/hub'

type AlertLevel = 'warning' | 'info' | 'danger'

interface Alert {
  level: AlertLevel
  message: string
}

const LEVEL_COLORS: Record<AlertLevel, string> = {
  warning: '#e8920c',
  info: '#3b82f6',
  danger: '#dc2626',
}

function getTopicAlerts(topic: TopicNode): Alert[] {
  const alerts: Alert[] = []
  const accel = topic.acceleration ?? 0
  const cv = topic.citationVelocity ?? 0

  if (accel > 3.0) {
    alerts.push({ level: 'info', message: 'ACCELERATION SPIKE: RAPID GROWTH DETECTED' })
  }
  if (topic.status === 'weak' && cv > 0 && accel > 0) {
    alerts.push({ level: 'warning', message: 'WEAK SIGNAL: EMERGING TREND DETECTED' })
  }
  if (topic.status === 'weak' && topic.growth > 40) {
    alerts.push({ level: 'warning', message: 'WEAK SIGNAL: UNUSUAL GROWTH PATTERN' })
  }
  if (topic.growth > 70) {
    alerts.push({ level: 'info', message: 'GROWTH SPIKE DETECTED' })
  }
  if (topic.ethicLag > 10) {
    alerts.push({ level: 'danger', message: 'ETHICS LAG WARNING: REGULATION TRAILING' })
  }
  return alerts
}

function getHubAlerts(hub: Hub): Alert[] {
  const alerts: Alert[] = []
  if (hub.yoyGrowth > 25) {
    alerts.push({ level: 'info', message: 'HIGH ACTIVITY: YoY GROWTH EXCEEDS 25%' })
  }
  return alerts
}

export function AlertBanner({ hub, topic }: { hub?: Hub; topic?: TopicNode }) {
  const alerts: Alert[] = []
  if (topic) alerts.push(...getTopicAlerts(topic))
  if (hub) alerts.push(...getHubAlerts(hub))

  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      {alerts.map((alert, i) => {
        const color = LEVEL_COLORS[alert.level]
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              padding: '8px 10px',
              background: `${color}10`,
              border: `1px solid ${color}30`,
            }}
          >
            {/* Corner brackets */}
            {[
              { top: 0, left: 0, borderWidth: '2px 0 0 2px' },
              { top: 0, right: 0, borderWidth: '2px 2px 0 0' },
              { bottom: 0, left: 0, borderWidth: '0 0 2px 2px' },
              { bottom: 0, right: 0, borderWidth: '0 2px 2px 0' },
            ].map((pos, j) => (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  width: 6,
                  height: 6,
                  borderColor: color,
                  borderStyle: 'solid',
                  ...pos,
                } as React.CSSProperties}
              />
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Pulse dot */}
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: color,
                  animation: 'pulse 2s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '.12em',
                  color,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {alert.message}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
