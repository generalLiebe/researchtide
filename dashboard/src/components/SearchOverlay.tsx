import { useEffect, useRef } from 'react'
import { ScrambleText } from '../hooks/useScrambleText'
import { type SearchMode, type SortBy, useSearch } from '../hooks/useSearch'
import type { DashboardData, TopicNode } from '../types/hub'
import type { ViewKey } from './TabBar'

function statusDotColor(status: string): string {
  if (status === 'weak') return '#e8a020'
  if (status === 'rising') return '#3a7ad4'
  if (status === 'mainstream') return '#2ab8a0'
  return '#888780'
}

const headerMono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '.15em',
  textTransform: 'uppercase',
}

const MODES: { key: SearchMode; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'topics', label: 'TOPICS' },
  { key: 'papers', label: 'PAPERS' },
]

const SORTS: { key: SortBy; label: string }[] = [
  { key: 'relevance', label: 'RELEVANCE' },
  { key: 'citations', label: 'CITATIONS' },
  { key: 'date', label: 'DATE' },
]

export function SearchOverlay({
  data,
  open,
  onToggle,
  onSelectTopic,
  onSelectPaperTopic,
  setView,
}: {
  data: DashboardData | null
  open: boolean
  onToggle: () => void
  onSelectTopic: (t: TopicNode) => void
  onSelectPaperTopic: (topic: string) => void
  setView: (v: ViewKey) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useSearch(data)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !open && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        onToggle()
      }
      if (e.key === 'Escape' && open) {
        onToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onToggle])

  if (!open) {
    return (
      <button
        onClick={onToggle}
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          padding: '3px 10px',
          border: '1px solid rgba(100, 150, 220, 0.4)',
          borderRadius: 4,
          cursor: 'pointer',
          background: 'rgba(240, 246, 255, 0.7)',
          color: '#6688aa',
          backdropFilter: 'blur(8px)',
        }}
      >
        [ SEARCH ]
      </button>
    )
  }

  const showPaperFilters = search.mode === 'papers' || search.mode === 'all'

  return (
    <div style={{ position: 'relative' }}>
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 320,
        background: 'rgba(240, 246, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(177, 197, 255, 0.25)',
        borderRadius: 6,
        boxShadow: '0 4px 24px rgba(70, 91, 141, 0.12)',
        padding: 12,
        maxHeight: '60vh',
        overflowY: 'auto',
        fontFamily: 'var(--font-headline)',
      }}
    >
      {/* Corner brackets */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...headerMono, color: 'var(--text-muted)' }}>
            <ScrambleText text="SEARCH" duration={300} enabled={open} />
          </span>
          <button
            onClick={onToggle}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        placeholder="KEYWORD // AUTHOR"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 8px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: '.05em',
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px solid rgba(177, 197, 255, 0.3)',
          borderRadius: 3,
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => search.setMode(m.key)}
            style={{
              ...headerMono,
              flex: 1,
              padding: '4px 0',
              border: '1px solid rgba(100, 150, 220, 0.3)',
              borderRadius: 3,
              cursor: 'pointer',
              background: search.mode === m.key ? 'rgba(100, 150, 220, 0.2)' : 'transparent',
              color: search.mode === m.key ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Paper filters */}
      {showPaperFilters && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(177, 197, 255, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ ...headerMono, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              MIN CITATIONS
            </span>
            <input
              type="number"
              min={0}
              value={search.minCitations ?? ''}
              onChange={(e) => search.setMinCitations(e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
              style={{
                width: 60,
                padding: '3px 6px',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10,
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(177, 197, 255, 0.3)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => search.setSortBy(s.key)}
                style={{
                  ...headerMono,
                  fontSize: '9px',
                  flex: 1,
                  padding: '3px 0',
                  border: '1px solid rgba(100, 150, 220, 0.25)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  background: search.sortBy === s.key ? 'rgba(100, 150, 220, 0.15)' : 'transparent',
                  color: search.sortBy === s.key ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {search.query.trim() && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(177, 197, 255, 0.15)' }}>
          {/* Topic results */}
          {(search.mode === 'topics' || search.mode === 'all') && search.topicResults.length > 0 && (
            <>
              <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 6 }}>
                TOPICS ({search.topicResults.length})
              </div>
              {search.topicResults.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setView('topics')
                    onSelectTopic(t)
                    onToggle()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 6px',
                    marginBottom: 2,
                    cursor: 'pointer',
                    borderRadius: 3,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(177, 197, 255, 0.12)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: statusDotColor(t.status),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.label}
                  </span>
                  <span style={{ ...headerMono, fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    SP {t.socialPenetration.toFixed(0)}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Paper results */}
          {(search.mode === 'papers' || search.mode === 'all') && (
            <>
              {search.loading && (
                <div style={{ ...headerMono, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>
                  SEARCHING...
                </div>
              )}
              {!search.loading && search.paperResults.length > 0 && (
                <>
                  <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 6, marginTop: search.topicResults.length > 0 ? 8 : 0 }}>
                    PAPERS ({search.paperTotal})
                  </div>
                  {search.paperResults.map((p) => (
                    <div
                      key={p.paper_id}
                      onClick={() => {
                        if (p.categories.length > 0) {
                          onSelectPaperTopic(p.categories[0])
                        }
                        onToggle()
                      }}
                      style={{
                        padding: '6px',
                        marginBottom: 4,
                        cursor: 'pointer',
                        borderRadius: 3,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(177, 197, 255, 0.12)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 2 }}>
                        {p.title.length > 80 ? `${p.title.slice(0, 80)}...` : p.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                        <span>
                          {p.authors.length <= 2 ? p.authors.join(', ') : `${p.authors[0]} et al.`}
                        </span>
                        {p.published && <span>{p.published.slice(0, 4)}</span>}
                        {p.citation_count != null && (
                          <span style={{ color: 'var(--tier-a)' }}>
                            {p.citation_count} cit.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!search.loading && search.paperResults.length === 0 && search.query.trim() && (
                <div style={{ ...headerMono, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>
                  NO PAPERS FOUND
                </div>
              )}
            </>
          )}

          {search.topicResults.length === 0 && search.paperResults.length === 0 && !search.loading && (
            <div style={{ ...headerMono, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>
              NO RESULTS
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
