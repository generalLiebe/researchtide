import { useCallback, useEffect, useState } from 'react'
import type { HorizonData } from '../types/hub'

const DEFAULT_API_BASE = 'http://localhost:8000'

function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_API_BASE
}

export function useHorizonAlerts() {
  const [data, setData] = useState<HorizonData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const url = new URL(`${apiBase()}/live/horizon`)
      url.searchParams.set('_ts', String(Date.now()))
      const resp = await fetch(url.toString(), { cache: 'no-store' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as HorizonData
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
