import { useCallback, useEffect, useState } from 'react'
import type { Paper } from '../types/hub'

const DEFAULT_API_BASE = 'http://localhost:8000'

function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_API_BASE
}

interface UsePapersParams {
  hub?: string
  topic?: string
}

export function usePapers(params: UsePapersParams | null) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!params) {
      setPapers([])
      setTotal(0)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const url = new URL(`${apiBase()}/live/papers`)
      if (params.hub) url.searchParams.set('hub', params.hub)
      if (params.topic) url.searchParams.set('topic', params.topic)
      url.searchParams.set('limit', '50')

      const resp = await fetch(url.toString())
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const data = await resp.json()
      setPapers(data.papers ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPapers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [params?.hub, params?.topic])

  useEffect(() => {
    void fetch_()
  }, [fetch_])

  return { papers, total, loading, error }
}
