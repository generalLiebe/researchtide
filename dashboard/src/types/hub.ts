export type ResearchStatus = 'weak' | 'rising' | 'mainstream' | 'displaced'

export interface Hub {
  id: number
  name: string
  subtitle: string
  region: string
  // Preferred for world map plotting.
  lon?: number
  lat?: number
  // Backward-compatible fallback (normalized 0-1)
  x?: number
  y?: number
  intensity: number
  topics: string[]
  papersK: number
  yoyGrowth: number
}

export interface TopicNode {
  id: number
  label: string
  status: ResearchStatus
  x: number
  y: number
  radius: number
  growth: number
  ethicLag: number
  socialPenetration: number
  influencedBy: string[]
  influences: string[]
  citationVelocity?: number
  acceleration?: number
  hierarchyLevel?: 'domain' | 'field' | 'subfield' | 'topic'
  parentLabel?: string
  childCount?: number
}

export interface TopicChildrenResponse {
  parentLabel: string
  parentLevel: string
  children: TopicNode[]
  edges: Edge[]
}

export interface BreadcrumbEntry {
  label: string
  level: string
}

export interface Edge {
  source: number
  target: number
  weight: number
}

export interface Paper {
  paper_id: string
  title: string
  authors: string[]
  published: string | null
  arxiv_id: string | null
  doi: string | null
  categories: string[]
  citation_count: number | null
  abstract: string
  reference_count: number
  citation_velocity?: number | null
}

export interface DashboardData {
  hubs: Hub[]
  topics: TopicNode[]
  edges: Edge[]
}

export interface MonthlyCount {
  month: string
  count: number
}

export interface TimelineSeries {
  category: string
  monthly: MonthlyCount[]
  acceleration: number
}

export interface TimelineData {
  series: TimelineSeries[]
}

