import type { Edge, TopicNode } from '../types/hub'

export type TopicSignal = 'trending' | 'underrated' | 'normal'

function percentileThreshold(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * percentile)
  return sorted[Math.min(idx, sorted.length - 1)]
}

export function classifyAllTopics(
  topics: TopicNode[],
  edges: Edge[],
): Map<number, TopicSignal> {
  const result = new Map<number, TopicSignal>()
  if (topics.length === 0) return result

  // Compute connectivity (in-degree + out-degree) for each topic
  const connectivity = new Map<number, number>()
  for (const t of topics) connectivity.set(t.id, 0)
  for (const e of edges) {
    connectivity.set(e.source, (connectivity.get(e.source) ?? 0) + 1)
    connectivity.set(e.target, (connectivity.get(e.target) ?? 0) + 1)
  }

  // Compute percentile thresholds for socialPenetration and citationVelocity
  const spValues = topics.map((t) => t.socialPenetration)
  const spTop30 = percentileThreshold(spValues, 0.7)
  const spBottom40 = percentileThreshold(spValues, 0.4)
  const cvValues = topics.map((t) => t.citationVelocity ?? 0)
  const cvMedian = percentileThreshold(cvValues, 0.5)

  for (const topic of topics) {
    const conn = connectivity.get(topic.id) ?? 0
    const accel = topic.acceleration ?? 0

    // Trending: mainstream with high social penetration, highly connected, or positive acceleration
    if (
      (topic.status === 'mainstream' && topic.socialPenetration >= spTop30) ||
      conn >= 3 ||
      accel > 0
    ) {
      result.set(topic.id, 'trending')
      continue
    }

    // Underrated: high citation velocity but low social penetration
    if (
      (conn >= 2 && topic.socialPenetration <= spBottom40) ||
      ((topic.citationVelocity ?? 0) > cvMedian && topic.socialPenetration <= spBottom40)
    ) {
      result.set(topic.id, 'underrated')
      continue
    }

    result.set(topic.id, 'normal')
  }

  return result
}
