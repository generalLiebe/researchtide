import { useCallback, useMemo, useRef, useState } from 'react'
import { DetailPanel } from './components/DetailPanel'
import { HudOverlay } from './components/HudOverlay'
import { PaperListPanel } from './components/PaperListPanel'
import { SearchOverlay } from './components/SearchOverlay'
import { TabBar, type ViewKey } from './components/TabBar'
import { useDashboardData } from './hooks/useDashboardData'
import { useDrillDown } from './hooks/useDrillDown'
import { PapersView } from './views/PapersView'
import { TimelineView } from './views/TimelineView'
import { TopicGraphView } from './views/TopicGraphView'
import { WorldMapView } from './views/WorldMapView'
import { GlobeView } from './views/GlobeView'
import type { Edge, Hub, TopicNode } from './types/hub'

type Selected =
  | { kind: 'hub'; data: Hub }
  | { kind: 'topic'; data: TopicNode }
  | { kind: 'none' }

export default function App() {
  const [view, setView] = useState<ViewKey>('world')
  const [sel, setSel] = useState<Selected>({ kind: 'none' })
  const [deepTarget, setDeepTarget] = useState<{ hub?: string; topic?: string } | null>(null)
  const [worldMode, setWorldMode] = useState<'flat' | 'globe'>('globe')
  const [searchOpen, setSearchOpen] = useState(false)
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), [])

  const { data, error } = useDashboardData()

  // Stabilize empty array references to prevent infinite re-render loop
  // when data is null (during loading / API fetch)
  const EMPTY_TOPICS = useRef<TopicNode[]>([]).current
  const EMPTY_EDGES = useRef<Edge[]>([]).current
  const drill = useDrillDown(data?.topics ?? EMPTY_TOPICS, data?.edges ?? EMPTY_EDGES)

  const statusMessage = useMemo(() => {
    if (error) return 'API CONNECTION DEGRADED'
    if (!data) return 'CONNECTING TO RESEARCH STREAMS'
    return 'SYSTEM NOMINAL'
  }, [data, error])

  const handleDeepAnalysis = () => {
    if (sel.kind === 'hub') {
      setDeepTarget({ hub: sel.data.name })
    } else if (sel.kind === 'topic') {
      setDeepTarget({ topic: sel.data.label })
    }
  }

  // When a node is selected while DEEP ANALYSIS is open, switch to that node's analysis
  const selectNode = useCallback((next: Selected) => {
    setSel(next)
    if (deepTarget !== null) {
      if (next.kind === 'hub') {
        setDeepTarget({ hub: next.data.name })
      } else if (next.kind === 'topic') {
        setDeepTarget({ topic: next.data.label })
      }
    }
  }, [deepTarget])

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100svh',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <HudOverlay view={view} statusMessage={statusMessage} />

      <div style={{ paddingTop: 44, paddingInline: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 15 }}>
        <TabBar view={view} onChange={(v) => { setView(v); setSel({ kind: 'none' }); setDeepTarget(null) }} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <SearchOverlay
            data={data ?? null}
            open={searchOpen}
            onToggle={toggleSearch}
            onSelectTopic={(t) => {
              setView('topics')
              selectNode({ kind: 'topic', data: t })
            }}
            onSelectPaperTopic={(topic) => setDeepTarget({ topic })}
            setView={setView}
          />
          {view === 'world' && (['globe', 'flat'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setWorldMode(m)}
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                border: '1px solid rgba(100, 150, 220, 0.4)',
                borderRadius: 4,
                cursor: 'pointer',
                background: worldMode === m ? 'rgba(100, 150, 220, 0.25)' : 'rgba(240, 246, 255, 0.7)',
                color: worldMode === m ? '#2a5cb0' : '#6688aa',
                backdropFilter: 'blur(8px)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', paddingInline: 8, paddingBottom: 12, height: 'calc(100svh - 122px)' }}>
        {/* Views — always mounted, crossfade with opacity */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: view === 'world' ? 1 : 0,
          pointerEvents: view === 'world' ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          paddingInline: 8,
        }}>
          {worldMode === 'globe' ? (
            <GlobeView
              hubs={data?.hubs ?? []}
              edges={data?.edges ?? []}
              onSelectHub={(hub) => selectNode({ kind: 'hub', data: hub })}
              onClear={() => setSel({ kind: 'none' })}
              active={view === 'world'}
            />
          ) : (
            <WorldMapView
              hubs={data?.hubs ?? []}
              edges={data?.edges ?? []}
              onSelectHub={(hub) => selectNode({ kind: 'hub', data: hub })}
              onClear={() => setSel({ kind: 'none' })}
              active={view === 'world'}
            />
          )}
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          opacity: view === 'topics' ? 1 : 0,
          pointerEvents: view === 'topics' ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          paddingInline: 8,
        }}>
          <TopicGraphView
            topics={drill.currentTopics}
            edges={drill.currentEdges}
            onSelectTopic={(topic) => selectNode({ kind: 'topic', data: topic })}
            onClear={() => setSel({ kind: 'none' })}
            active={view === 'topics'}
            breadcrumb={drill.breadcrumb}
            onBreadcrumbNavigate={drill.navigateTo}
            isLoadingChildren={drill.isLoading}
          />
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          opacity: view === 'timeline' ? 1 : 0,
          pointerEvents: view === 'timeline' ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          paddingInline: 8,
        }}>
          <TimelineView />
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          opacity: view === 'papers' ? 1 : 0,
          pointerEvents: view === 'papers' ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          paddingInline: 8,
        }}>
          <PapersView />
        </div>

        <DetailPanel
          selected={sel}
          onClose={() => setSel({ kind: 'none' })}
          onDeepAnalysis={handleDeepAnalysis}
          onDrillDown={(topic) => {
            drill.drillInto(topic)
            setSel({ kind: 'none' })
          }}
        />
      </div>

      <PaperListPanel target={deepTarget} onClose={() => setDeepTarget(null)} />
    </div>
  )
}
