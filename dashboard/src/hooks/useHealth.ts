import { useEffect, useState } from 'react'
import type { HealthData } from '../types/hub'

const DEFAULT_API_BASE = 'http://localhost:8000'

function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_API_BASE
}

export function useHealth(intervalMs: number = 30_000) {
  const [data, setData] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const fetchHealth = async () => {
      try {
        const resp = await fetch(`${apiBase()}/health`, { cache: 'no-store' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = (await resp.json()) as HealthData
        if (active) {
          setData(json)
          setError(null)
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      }
    }

    void fetchHealth()
    const timer = setInterval(fetchHealth, intervalMs)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [intervalMs])

  return { data, error }
}
