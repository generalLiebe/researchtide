import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimationFrame } from '../hooks/useAnimation'
import { useViewTransform } from '../hooks/useViewTransform'
import { BreadcrumbNav } from '../components/BreadcrumbNav'
import { TopicNodeOverlay } from '../components/TopicNodeOverlay'
import type { BreadcrumbEntry, Edge, TopicNode } from '../types/hub'
import { drawFlowingEdges, resizeCanvasToParent } from './canvas'
import { classifyAllTopics } from '../utils/topicClassification'

export function TopicGraphView({
  topics,
  edges,
  onSelectTopic,
  onClear,
  active = true,
  breadcrumb = [],
  onBreadcrumbNavigate,
  isLoadingChildren = false,
}: {
  topics: TopicNode[]
  edges: Edge[]
  onSelectTopic: (t: TopicNode) => void
  onClear: () => void
  active?: boolean
  breadcrumb?: BreadcrumbEntry[]
  onBreadcrumbNavigate?: (index: number) => void
  isLoadingChildren?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const layoutRef = useRef<{ w: number; h: number; dpr: number } | null>(null)
  const [layoutDims, setLayoutDims] = useState<{ w: number; h: number } | null>(null)

  const vt = useViewTransform()
  const { transform } = vt

  const signals = useMemo(() => classifyAllTopics(topics, edges), [topics, edges])

  const positions = useMemo(() => {
    const dims = layoutRef.current
    const w = dims?.w ?? 1000
    const h = dims?.h ?? 520
    const map = new Map<number, { x: number; y: number }>()
    for (const t of topics) {
      map.set(t.id, { x: t.x * w, y: t.y * h })
    }
    return map
  }, [topics])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onResize = () => {
      const dims = resizeCanvasToParent(c)
      if (dims) {
        layoutRef.current = dims
        setLayoutDims({ w: dims.w, h: dims.h })
      }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Reset transform when topics change (drill-down/up)
  useEffect(() => {
    vt.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics])

  // Escape key to go up
  useEffect(() => {
    if (!onBreadcrumbNavigate || breadcrumb.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && breadcrumb.length > 0) {
        onBreadcrumbNavigate(Math.max(0, breadcrumb.length - 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [breadcrumb, onBreadcrumbNavigate])

  useAnimationFrame((tMs) => {
    const c = canvasRef.current
    const dims = layoutRef.current
    if (!c || !dims) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const { w, h, dpr } = dims
    const t = tMs / 16.0

    // Clear with identity transform first
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0d1f3c'
    ctx.fillRect(0, 0, w, h)

    // Faint stars (screen space)
    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 80; i++) {
      const sx = (w * ((i * 97) % 100)) / 100
      const sy = (h * ((i * 53 + 17) % 100)) / 100
      ctx.fillRect(sx, sy, 1, 1)
    }
    ctx.restore()

    // Apply zoom/pan transform for world-space content
    ctx.setTransform(
      dpr * transform.scale, 0, 0,
      dpr * transform.scale,
      transform.offsetX * dpr,
      transform.offsetY * dpr,
    )

    // concentric ring guidelines
    ctx.save()
    const ringCx = w * 0.5
    const ringCy = h * 0.48
    const ringRadii = [w * 0.12, w * 0.22, w * 0.32, w * 0.40]
    ctx.strokeStyle = 'rgba(100, 150, 220, 0.08)'
    ctx.lineWidth = 0.5
    for (const r of ringRadii) {
      ctx.beginPath()
      ctx.arc(ringCx, ringCy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()

    // edges
    drawFlowingEdges(ctx, edges, positions, t)

    // Trending topic pulse rings
    ctx.save()
    for (const topic of topics) {
      const sig = signals.get(topic.id)
      if (sig !== 'trending') continue
      const pos = positions.get(topic.id)
      if (!pos) continue
      const baseR = Math.max(28, topic.radius * 2.2) * 1.15
      const pulseR = baseR + 8 + 6 * Math.sin(tMs * 0.002 + topic.id)
      const color = topic.status === 'mainstream' ? '#2ab8a0' : topic.status === 'rising' ? '#3a7ad4' : '#e8a020'
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.08 + 0.07 * Math.sin(tMs * 0.002 + topic.id)
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 0.05 + 0.05 * Math.sin(tMs * 0.003 + topic.id + 1)
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, pulseR + 12, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()

    // Reset to screen space for legend
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // legend
    ctx.save()
    const legendX = 16
    let legendY = h - 86
    ctx.font = "400 10px 'JetBrains Mono', ui-monospace, monospace"
    const legendItems: Array<[string, string]> = [
      ['#e8a020', 'WEAK SIGNAL'],
      ['#3a7ad4', 'RISING'],
      ['#2ab8a0', 'MAINSTREAM'],
      ['#888780', 'DISPLACED'],
    ]
    for (const [c, label] of legendItems) {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(legendX, legendY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(200,220,240,0.6)'
      ctx.textAlign = 'left'
      ctx.fillText(label, legendX + 8, legendY + 3)
      legendY += 13
    }
    legendY += 4
    ctx.fillStyle = '#2ab8a0'
    ctx.fillText('▲', legendX - 1, legendY + 3)
    ctx.fillStyle = 'rgba(200,220,240,0.6)'
    ctx.fillText('TRENDING', legendX + 8, legendY + 3)
    legendY += 13
    ctx.fillStyle = '#e8a020'
    ctx.fillText('◆', legendX - 1, legendY + 3)
    ctx.fillStyle = 'rgba(200,220,240,0.6)'
    ctx.fillText('UNDERRATED', legendX + 8, legendY + 3)
    ctx.restore()
  }, active)

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        border: '1px solid rgba(100, 150, 220, 0.35)',
        overflow: 'hidden',
        height: '100%',
        touchAction: 'none',
      }}
      onWheel={vt.onWheel}
      onPointerDown={vt.onPointerDown}
      onPointerMove={vt.onPointerMove}
      onPointerUp={vt.onPointerUp}
    >
      <canvas
        ref={canvasRef}
        onClick={onClear}
        style={{ display: 'block' }}
      />
      {layoutDims && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: layoutDims.w,
            height: layoutDims.h,
            transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <TopicNodeOverlay
            topics={topics}
            edges={edges}
            layoutDims={layoutDims}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}

      {onBreadcrumbNavigate && (
        <BreadcrumbNav
          breadcrumb={breadcrumb}
          onNavigate={onBreadcrumbNavigate}
          isLoading={isLoadingChildren}
        />
      )}
    </div>
  )
}
