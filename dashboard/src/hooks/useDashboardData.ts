import { useCallback, useEffect, useState } from 'react'
import type { DashboardData } from '../types/hub'

const DEFAULT_API_BASE = 'http://localhost:8000'

function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_API_BASE
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      // Try live endpoint first, fall back to demo data
      const liveUrl = new URL(`${apiBase()}/live/dashboard`)
      liveUrl.searchParams.set('_ts', String(Date.now()))
      let resp = await fetch(liveUrl.toString(), { cache: 'no-store' })
      if (!resp.ok) {
        // Fallback to demo dashboard
        const demoUrl = new URL(`${apiBase()}/demo/dashboard`)
        demoUrl.searchParams.set('_ts', String(Date.now()))
        resp = await fetch(demoUrl.toString(), { cache: 'no-store' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as DashboardData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, refresh }
}

