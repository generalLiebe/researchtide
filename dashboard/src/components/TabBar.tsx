import { ScrambleText } from '../hooks/useScrambleText'

export type ViewKey = 'world' | 'topics' | 'timeline' | 'papers'

const TABS: { key: ViewKey; label: string }[] = [
  { key: 'world', label: '[ WORLD MAP ]' },
  { key: 'topics', label: '[ TOPIC GRAPH ]' },
  { key: 'timeline', label: '[ TIMELINE ]' },
  { key: 'papers', label: '[ PAPERS ]' },
]

export function TabBar({
  view,
  onChange,
}: {
  view: ViewKey
  onChange: (v: ViewKey) => void
}) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    letterSpacing: '.15em',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--tier-a)' : '2px solid transparent',
    cursor: 'pointer',
    userSelect: 'none',
    textTransform: 'uppercase',
    transition: 'color 0.2s, border-color 0.2s',
  })

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {TABS.map(({ key, label }) => (
        <div
          key={key}
          style={tabStyle(view === key)}
          role="button"
          tabIndex={0}
          onClick={() => onChange(key)}
          onKeyDown={(e) => e.key === 'Enter' && onChange(key)}
        >
          <ScrambleText text={label} duration={350} enabled={view === key} />
        </div>
      ))}
    </div>
  )
}
