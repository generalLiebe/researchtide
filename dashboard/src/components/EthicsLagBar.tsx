export function EthicsLagBar({ ethicLagMonths }: { ethicLagMonths: number }) {
  const lag = Math.max(0, Math.min(24, ethicLagMonths))
  const pct = (lag / 24) * 100
  const severity = lag > 10 ? 'CRITICAL' : lag > 6 ? 'ELEVATED' : 'NOMINAL'
  const severityColor =
    lag > 10 ? 'var(--alert-ethics)' : lag > 6 ? 'var(--tier-s)' : 'var(--success)'

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '.15em',
            textTransform: 'uppercase',
          }}
        >
          ETHICS_LAG_OFFSET
        </span>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: severityColor,
            letterSpacing: '.1em',
          }}
        >
          {severity}
        </span>
      </div>
      <div
        style={{
          height: 6,
          width: '100%',
          background: 'var(--bg-tertiary)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(to right, var(--success), var(--tier-s), var(--alert-ethics))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: `${100 - pct}%`,
            top: 0,
            height: '100%',
            width: 2,
            background: '#fff',
          }}
        />
      </div>
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>TECH</span>
        <span>{`${lag.toFixed(1)} MONTHS`}</span>
      </div>
    </div>
  )
}
