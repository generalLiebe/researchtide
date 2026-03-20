import { useCallback, useEffect, useState } from 'react'
import type { Paper } from '../types/hub'

const DEFAULT_API_BASE = 'http://localhost:8000'

function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_API_BASE
}

export interface UsePaperRankingResult {
  recent: Paper[]
  rising: Paper[]
  loading: boolean
  error: string | null
}

export function usePaperRanking(): UsePaperRankingResult {
  const [recent, setRecent] = useState<Paper[]>([])
  const [rising, setRising] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const base = apiBase()
      const [recentResp, risingResp] = await Promise.all([
        fetch(`${base}/live/papers?sort=date&limit=50`),
        fetch(`${base}/live/papers?sort=velocity&limit=50`),
      ])

      if (!recentResp.ok || !risingResp.ok) {
        throw new Error(`HTTP ${recentResp.status}/${risingResp.status}`)
      }

      const [recentData, risingData] = await Promise.all([
        recentResp.json(),
        risingResp.json(),
      ])

      setRecent(recentData.papers ?? [])
      setRising(risingData.papers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRecent([])
      setRising([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRankings()
  }, [fetchRankings])

  return { recent, rising, loading, error }
}
