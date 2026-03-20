import { useEffect, useRef, useState } from 'react'

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
const DEFAULT_DURATION = 500

export function useScrambleText(
  target: string,
  options?: {
    duration?: number
    charset?: string
    enabled?: boolean
  },
): string {
  const duration = options?.duration ?? DEFAULT_DURATION
  const charset = options?.charset ?? DEFAULT_CHARSET
  const enabled = options?.enabled ?? true

  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number | null>(null)
  const thresholdsRef = useRef<number[]>([])

  useEffect(() => {
    if (!enabled) {
      setDisplay(target)
      return
    }

    // Pre-compute per-character lock thresholds (left-to-right with jitter)
    const len = target.length
    const thresholds: number[] = []
    for (let i = 0; i < len; i++) {
      const base = len > 1 ? i / (len - 1) : 0
      const jitter = (Math.random() - 0.5) * 0.2
      thresholds.push(Math.max(0, Math.min(1, base + jitter)))
    }
    // Sort to keep monotonic-ish ordering (ensures left chars lock before right)
    const indexed = thresholds.map((t, i) => ({ t, i }))
    indexed.sort((a, b) => a.t - b.t)
    const sorted: number[] = new Array(len)
    for (let rank = 0; rank < indexed.length; rank++) {
      sorted[indexed[rank].i] = rank / (len - 1 || 1)
    }
    thresholdsRef.current = sorted

    const start = performance.now()

    const loop = () => {
      const elapsed = performance.now() - start
      const progress = Math.min(1, elapsed / duration)

      if (progress >= 1) {
        setDisplay(target)
        rafRef.current = null
        return
      }

      let result = ''
      for (let i = 0; i < target.length; i++) {
        const ch = target[i]
        if (ch === ' ') {
          result += ' '
        } else if (progress >= sorted[i]) {
          result += ch
        } else {
          result += charset[Math.floor(Math.random() * charset.length)]
        }
      }
      setDisplay(result)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, duration, charset, enabled])

  return display
}

/** Wrapper component for conditional scramble (avoids hook-in-conditional issues) */
export function ScrambleText({
  text,
  duration,
  enabled = true,
}: {
  text: string
  duration?: number
  enabled?: boolean
}) {
  const display = useScrambleText(text, { duration, enabled })
  return <>{display}</>
}
