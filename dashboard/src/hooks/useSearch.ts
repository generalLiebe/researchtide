import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardData, Paper, TopicNode } from '../types/hub'

export type SearchMode = 'topics' | 'papers' | 'all'
export type SortBy = 'relevance' | 'citations' | 'date'

const API_BASE = () => {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : 'http://localhost:8000'
}

export function useSearch(data: DashboardData | null) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('all')
  const [minCitations, setMinCitations] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
  const [topicResults, setTopicResults] = useState<TopicNode[]>([])
  const [paperResults, setPaperResults] = useState<Paper[]>([])
  const [paperTotal, setPaperTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Client-side topic search
  useEffect(() => {
    if (!data || !query.trim() || mode === 'papers') {
      setTopicResults([])
      return
    }
    const q = query.toLowerCase()
    setTopicResults(
      data.topics.filter((t) => t.label.toLowerCase().includes(q)),
    )
  }, [query, data, mode])

  // Debounced API paper search
  const fetchPapers = useCallback(async (q: string, citations: number | null, sort: SortBy) => {
    if (!q.trim()) {
      setPaperResults([])
      setPaperTotal(0)
      return
    }
    setLoading(true)
    try {
      const url = new URL(`${API_BASE()}/live/papers`)
      url.searchParams.set('keyword', q)
      url.searchParams.set('author', q)
      if (citations != null) url.searchParams.set('min_citations', String(citations))
      if (sort !== 'relevance') url.searchParams.set('sort', sort)
      url.searchParams.set('limit', '20')

      const resp = await fetch(url.toString())
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json() as { papers: Paper[]; total: number }
      setPaperResults(json.papers)
      setPaperTotal(json.total)
    } catch {
      setPaperResults([])
      setPaperTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'topics') {
      setPaperResults([])
      setPaperTotal(0)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPapers(query, minCitations, sortBy)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, mode, minCitations, sortBy, fetchPapers])

  return {
    query, setQuery,
    mode, setMode,
    minCitations, setMinCitations,
    sortBy, setSortBy,
    topicResults,
    paperResults,
    paperTotal,
    loading,
  }
}
