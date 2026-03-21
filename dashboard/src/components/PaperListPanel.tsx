import { useState } from 'react'
import { usePapers } from '../hooks/usePapers'

interface PaperListPanelProps {
  target: { hub?: string; topic?: string; keyword?: string } | null
  onClose: () => void
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown'
  if (authors.length <= 3) return authors.join(', ')
  return `${authors.slice(0, 3).join(', ')} et al.`
}

function formatYear(published: string | null): string {
  if (!published) return ''
  return published.slice(0, 4)
}

export function PaperListPanel({ target, onClose }: PaperListPanelProps) {
  const { papers, total, loading, error } = usePapers(target)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const open = target !== null

  const headerMono: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '.15em',
    textTransform: 'uppercase',
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(240, 246, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(177, 197, 255, 0.3)',
        boxShadow: open ? '-8px 0 32px rgba(70, 91, 141, 0.12)' : 'none',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-headline)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(177, 197, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ ...headerMono, color: 'var(--text-muted)', marginBottom: 4 }}>
            DEEP ANALYSIS
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
            }}
          >
            {target?.hub ?? target?.topic ?? 'Papers'}
          </h3>
          {!loading && (
            <span style={{ ...headerMono, color: 'var(--text-muted)' }}>
              {total} PAPERS FOUND
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 18,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
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

        {papers.map((p) => {
          const expanded = expandedIds.has(p.paper_id)
          return (
            <div
              key={p.paper_id}
              style={{
                position: 'relative',
                padding: 12,
                marginBottom: 8,
                background: 'rgba(255, 255, 255, 0.55)',
                border: '1px solid rgba(177, 197, 255, 0.15)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => toggleExpand(p.paper_id)}
            >
              {/* Title */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <span>{p.title}</span>
                <span
                  style={{
                    ...headerMono,
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                >
                  ▼
                </span>
              </div>

              {/* Authors + year */}
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  marginBottom: 6,
                }}
              >
                {formatAuthors(p.authors)}
                {formatYear(p.published) && ` · ${formatYear(p.published)}`}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {p.citation_count != null && (
                  <span style={{ ...headerMono, color: 'var(--text-muted)' }}>
                    {p.citation_count} CITATIONS
                  </span>
                )}

                {p.reference_count > 0 && (
                  <span
                    style={{
                      ...headerMono,
                      fontSize: '9px',
                      padding: '1px 5px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                    }}
                  >
                    {p.reference_count} REFS
                  </span>
                )}

                {/* Category pills */}
                {p.categories.slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    style={{
                      ...headerMono,
                      fontSize: '9px',
                      padding: '1px 5px',
                      background: 'rgba(177, 197, 255, 0.12)',
                      border: '1px solid rgba(177, 197, 255, 0.2)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Expanded: Abstract */}
              {expanded && p.abstract && (
                <ExpandedAbstract abstract={p.abstract} />
              )}

              {/* Links */}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {p.doi && (
                  <a
                    href={`https://doi.org/${p.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...headerMono,
                      fontSize: '9px',
                      color: 'var(--tier-a)',
                      textDecoration: 'none',
                    }}
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
                    style={{
                      ...headerMono,
                      fontSize: '9px',
                      color: 'var(--tier-a)',
                      textDecoration: 'none',
                    }}
                  >
                    ARXIV ↗
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpandedAbstract({ abstract }: { abstract: string }) {
  const [showAll, setShowAll] = useState(false)

  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 0',
        borderTop: '1px solid rgba(177, 197, 255, 0.15)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          display: showAll ? 'block' : '-webkit-box',
          WebkitLineClamp: showAll ? undefined : 4,
          WebkitBoxOrient: showAll ? undefined : 'vertical',
          overflow: showAll ? 'visible' : 'hidden',
        }}
      >
        {abstract}
      </div>
      {abstract.length > 200 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowAll((v) => !v)
          }}
          style={{
            border: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '.12em',
            color: 'var(--tier-a)',
            cursor: 'pointer',
            padding: '4px 0 0',
            textTransform: 'uppercase',
          }}
        >
          {showAll ? 'SHOW LESS' : 'SHOW MORE'}
        </button>
      )}
    </div>
  )
}
