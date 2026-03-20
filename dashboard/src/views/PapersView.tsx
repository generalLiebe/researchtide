import { useMemo, useState } from 'react'
import { usePaperRanking } from '../hooks/usePaperRanking'
import type { Paper } from '../types/hub'

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown'
  if (authors.length <= 3) return authors.join(', ')
  return `${authors.slice(0, 3).join(', ')} et al.`
}

function formatYear(published: string | null): string {
  if (!published) return ''
  return published.slice(0, 4)
}

function deduplicatePapers(papers: Paper[]): Paper[] {
  const seen = new Set<string>()
  return papers.filter((p) => {
    const key = p.doi ?? p.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function fallbackVelocity(p: Paper): number {
  if (!p.published || p.citation_count == null) return 0
  const months = Math.max((Date.now() - new Date(p.published).getTime()) / (30.44 * 24 * 3600_000), 1)
  return p.citation_count / months
}

const headerMono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '.15em',
  textTransform: 'uppercase',
}

export function PapersView() {
  const { recent, rising, loading, error } = usePaperRanking()
  const [filter, setFilter] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filterFn = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return (_: Paper) => true
    return (p: Paper) =>
      p.title.toLowerCase().includes(q) ||
      p.abstract.toLowerCase().includes(q)
  }, [filter])

  const filteredRecent = useMemo(() => {
    const filtered = deduplicatePapers(recent.filter(filterFn))
    return filtered.sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
  }, [recent, filterFn])

  const filteredRising = useMemo(() => {
    const filtered = deduplicatePapers(rising.filter(filterFn))
    return filtered.sort((a, b) => {
      const va = a.citation_velocity ?? fallbackVelocity(a)
      const vb = b.citation_velocity ?? fallbackVelocity(b)
      return vb - va
    })
  }, [rising, filterFn])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Filter bar */}
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(240, 246, 255, 0.78)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(177, 197, 255, 0.25)',
          borderRadius: '4px 4px 0 0',
        }}
      >
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="FILTER BY KEYWORD..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.1em',
            color: 'var(--text-primary)',
            background: 'rgba(255, 255, 255, 0.5)',
            border: '1px solid rgba(177, 197, 255, 0.3)',
            outline: 'none',
          }}
        />
      </div>

      {/* Two-column ranking */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
        <RankingColumn
          title="RECENT PAPERS"
          papers={filteredRecent}
          loading={loading}
          error={error}
          expandedIds={expandedIds}
          onToggle={toggleExpand}
          metricFn={(p) =>
            p.citation_count != null ? `${p.citation_count} CITATIONS` : ''
          }
          borderRight
        />
        <RankingColumn
          title="RISING CITATIONS"
          papers={filteredRising}
          loading={loading}
          error={error}
          expandedIds={expandedIds}
          onToggle={toggleExpand}
          metricFn={(p) => {
            const vel = p.citation_velocity ?? fallbackVelocity(p)
            return vel > 0 ? `${vel.toFixed(1)} CIT/MO` : ''
          }}
          metricColor="#e8920c"
        />
      </div>
    </div>
  )
}

function RankingColumn({
  title,
  papers,
  loading,
  error,
  expandedIds,
  onToggle,
  metricFn,
  metricColor,
  borderRight = false,
}: {
  title: string
  papers: Paper[]
  loading: boolean
  error: string | null
  expandedIds: Set<string>
  onToggle: (id: string) => void
  metricFn: (p: Paper) => string
  metricColor?: string
  borderRight?: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(240, 246, 255, 0.78)',
        backdropFilter: 'blur(16px)',
        borderRight: borderRight ? '1px solid rgba(177, 197, 255, 0.25)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(177, 197, 255, 0.2)',
        }}
      >
        <span style={{ ...headerMono, color: 'var(--text-muted)', fontWeight: 700 }}>
          {title}
        </span>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', ...headerMono }}>
            LOADING PAPERS...
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--alert-ethics)', ...headerMono }}>
            ERROR: {error}
          </div>
        )}
        {!loading && !error && papers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', ...headerMono }}>
            NO PAPERS FOUND
          </div>
        )}

        {!loading &&
          !error &&
          papers.map((p, i) => {
            const expanded = expandedIds.has(p.paper_id)
            const metric = metricFn(p)
            return (
              <div
                key={p.paper_id}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 8px',
                  marginBottom: 4,
                  background: 'rgba(255, 255, 255, 0.55)',
                  border: '1px solid rgba(177, 197, 255, 0.15)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => onToggle(p.paper_id)}
              >
                {/* Rank number */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--tier-s)',
                    minWidth: 32,
                    textAlign: 'right',
                    lineHeight: 1.2,
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Paper content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                      marginBottom: 3,
                      display: '-webkit-box',
                      WebkitLineClamp: expanded ? undefined : 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: expanded ? 'visible' : 'hidden',
                    }}
                  >
                    {p.title}
                  </div>

                  {/* Authors + year */}
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginBottom: 5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatAuthors(p.authors)}
                    {formatYear(p.published) && ` · ${formatYear(p.published)}`}
                  </div>

                  {/* Metrics row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {metric && (
                      <span
                        style={{
                          ...headerMono,
                          fontSize: '9px',
                          color: metricColor ?? 'var(--text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        {metric}
                      </span>
                    )}

                    {p.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        style={{
                          ...headerMono,
                          fontSize: '8px',
                          padding: '1px 4px',
                          background: 'rgba(177, 197, 255, 0.12)',
                          border: '1px solid rgba(177, 197, 255, 0.2)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Expanded abstract */}
                  {expanded && p.abstract && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px solid rgba(177, 197, 255, 0.15)',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {p.abstract}
                    </div>
                  )}

                  {/* Links */}
                  {expanded && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...headerMono, fontSize: '9px', color: 'var(--tier-a)', textDecoration: 'none' }}
                        >
                          DOI ↗
                        </a>
                      )}
                      {p.arxiv_id && (
                        <a
                          href={`https://arxiv.org/abs/${p.arxiv_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...headerMono, fontSize: '9px', color: 'var(--tier-a)', textDecoration: 'none' }}
                        >
                          ARXIV ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
