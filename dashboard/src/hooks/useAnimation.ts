import { useEffect, useRef } from 'react'

export function useAnimationFrame(cb: (t: number) => void, enabled = true) {
  const raf = useRef<number | null>(null)
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    if (!enabled) return

    const loop = (t: number) => {
      cbRef.current(t)
      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [enabled])
}

