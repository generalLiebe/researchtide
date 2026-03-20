import { useCallback, useEffect, useRef, useState } from 'react'
import type { BreadcrumbEntry, Edge, TopicChildrenResponse, TopicNode } from '../types/hub'

const API_BASE = () => {
  const v = import.meta.env.VITE_API_BASE as string | undefined
  return v?.trim() ? v.trim().replace(/\/+$/, '') : 'http://localhost:8000'
}

export function useDrillDown(rootTopics: TopicNode[], rootEdges: Edge[]) {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([])
  const [currentTopics, setCurrentTopics] = useState<TopicNode[]>(rootTopics)
  const [currentEdges, setCurrentEdges] = useState<Edge[]>(rootEdges)
  const [isLoading, setIsLoading] = useState(false)
  const rootRef = useRef({ topics: rootTopics, edges: rootEdges })

  // Keep root in sync with data changes
  useEffect(() => {
    rootRef.current = { topics: rootTopics, edges: rootEdges }
    if (breadcrumb.length === 0) {
      setCurrentTopics(rootTopics)
      setCurrentEdges(rootEdges)
    }
  }, [rootTopics, rootEdges, breadcrumb.length])

  const drillInto = useCallback(async (topic: TopicNode) => {
    if (!topic.childCount || topic.childCount <= 0) return
    if (!topic.hierarchyLevel) return

    setIsLoading(true)
    try {
      const url = new URL(`${API_BASE()}/live/topics/children`)
      url.searchParams.set('parent', topic.label)
      url.searchParams.set('level', topic.hierarchyLevel)
      const resp = await fetch(url.toString())
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as TopicChildrenResponse

      setBreadcrumb((prev) => [...prev, { label: topic.label, level: topic.hierarchyLevel! }])
      setCurrentTopics(data.children)
      setCurrentEdges(data.edges)
    } catch (err) {
      console.error('Drill-down failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const navigateTo = useCallback(async (index: number) => {
    if (index < 0) return

    if (index === 0) {
      // Back to root
      setBreadcrumb([])
      setCurrentTopics(rootRef.current.topics)
      setCurrentEdges(rootRef.current.edges)
      return
    }

    // Navigate to a mid-level breadcrumb
    const target = breadcrumb[index - 1] // breadcrumb[0] is first drill-down level
    if (!target) return

    setIsLoading(true)
    try {
      const url = new URL(`${API_BASE()}/live/topics/children`)
      url.searchParams.set('parent', target.label)
      url.searchParams.set('level', target.level)
      const resp = await fetch(url.toString())
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as TopicChildrenResponse

      setBreadcrumb((prev) => prev.slice(0, index))
      setCurrentTopics(data.children)
      setCurrentEdges(data.edges)
    } catch (err) {
      console.error('Navigate failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [breadcrumb])

  const goUp = useCallback(() => {
    if (breadcrumb.length === 0) return
    if (breadcrumb.length === 1) {
      navigateTo(0)
    } else {
      navigateTo(breadcrumb.length - 1)
    }
  }, [breadcrumb, navigateTo])

  return {
    breadcrumb,
    currentTopics,
    currentEdges,
    isLoading,
    isAtRoot: breadcrumb.length === 0,
    drillInto,
    navigateTo,
    goUp,
  }
}
