import { useScrambleText } from '../hooks/useScrambleText'

export function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  const scrambledValue = useScrambleText(value, { duration: 400 })

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.6)',
        padding: '8px 10px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-metric)',
          fontFamily: 'var(--font-headline)',
          fontWeight: 700,
          color: color ?? 'var(--text-primary)',
        }}
      >
        {scrambledValue}
      </div>
    </div>
  )
}
