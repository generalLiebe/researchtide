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

export interface ForecastPoint {
  month: string
  predicted: number
  lower_80: number
  upper_80: number
}

export interface TimelineSeries {
  category: string
  monthly: MonthlyCount[]
  acceleration: number
  forecast?: ForecastPoint[]
}

export interface TimelineData {
  series: TimelineSeries[]
}

export interface HorizonAlert {
  topic: string
  score: number
  alert_level: 'watch' | 'emerging' | 'breakthrough'
  factors: Record<string, number>
  cross_field: string[]
}

export interface HorizonData {
  alerts: HorizonAlert[]
}

export interface KeywordMetric {
  keyword: string
  total_count: number
  monthly: MonthlyCount[]
  velocity: number
  acceleration: number
  horizon_score: number
  horizon_alert_level: 'watch' | 'emerging' | 'breakthrough'
  horizon_factors: Record<string, number>
  forecast: ForecastPoint[]
  is_emerging: boolean
  fields: string[]
  paper_count: number
  first_seen: string
  last_seen: string
}

export interface KeywordTrendsData {
  keywords: KeywordMetric[]
  top_emerging: string[]
  field_groups: Record<string, string[]>
}

export interface CacheStatusInfo {
  exists: boolean
  age_seconds: number | null
  size_bytes: number | null
}

export interface HealthData {
  status: 'ok' | 'degraded'
  version: string
  paper_count: number
  keyword_count: number
  topic_count: number
  caches: Record<string, CacheStatusInfo>
  uptime_seconds: number
}

