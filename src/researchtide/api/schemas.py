"""API request/response schemas."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field

from researchtide.models.paper import Paper


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class ArxivIngestRequest(BaseModel):
    query: str = Field(default="cat:cs.CL")
    max_results: int = Field(default=200, ge=1, le=5000)


class ArxivIngestResponse(BaseModel):
    papers: list[Paper]


class EnrichRequest(BaseModel):
    papers: list[Paper]
    api_key: str | None = None
    delay_seconds: float | None = None


class EnrichResponse(BaseModel):
    papers: list[Paper]


class TopicExtractRequest(BaseModel):
    papers: list[Paper]
    min_topic_size: int = Field(default=10, ge=2, le=200)


class TopicSnapshotOut(BaseModel):
    topic_id: int
    label: str
    keywords: list[str] = Field(default_factory=list)
    paper_count: int = 0
    citation_velocity: float = 0.0
    status: str
    timestamp: date | None = None


class TopicExtractResponse(BaseModel):
    snapshots: list[TopicSnapshotOut]
    topic_assignments: dict[str, int]


class WeakSignalDetectRequest(BaseModel):
    snapshots: list[TopicSnapshotOut]
    contamination: float = Field(default=0.1, gt=0.0, lt=0.5)


class WeakSignalDetectResponse(BaseModel):
    snapshots: list[TopicSnapshotOut]


class InfluenceGraphRequest(BaseModel):
    papers: list[Paper]
    topic_assignments: dict[str, int]
    topic_labels: dict[int, str] | None = None


class GraphNode(BaseModel):
    id: int
    label: str
    meta: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: int
    target: int
    weight: float


class InfluenceGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


ResearchStatus = Literal["weak", "rising", "mainstream", "displaced"]


class Hub(BaseModel):
    id: int
    name: str
    subtitle: str
    region: str
    lon: float | None = None
    lat: float | None = None
    x: float | None = None
    y: float | None = None
    intensity: int
    topics: list[str]
    papersK: float
    yoyGrowth: float


class TopicNode(BaseModel):
    id: int
    label: str
    status: ResearchStatus
    x: float
    y: float
    radius: float
    growth: float
    ethicLag: float
    socialPenetration: float
    influencedBy: list[str] = Field(default_factory=list)
    influences: list[str] = Field(default_factory=list)
    citationVelocity: float = 0.0  # citations per month
    acceleration: float = 0.0  # 2nd derivative of publication count
    hierarchyLevel: Literal["domain", "field", "subfield", "topic"] | None = None
    parentLabel: str | None = None
    childCount: int = 0


class PaperOut(BaseModel):
    paper_id: str
    title: str
    authors: list[str]
    published: date | None = None
    arxiv_id: str | None = None
    doi: str | None = None
    categories: list[str] = Field(default_factory=list)
    citation_count: int | None = None
    abstract: str = ""
    reference_count: int = 0
    citation_velocity: float | None = None  # citations per month (set when sort=velocity)


class PaperListResponse(BaseModel):
    papers: list[PaperOut]
    total: int


class MonthlyCount(BaseModel):
    month: str
    count: int


class TimelineSeriesItem(BaseModel):
    category: str
    monthly: list[MonthlyCount]
    acceleration: float


class TimelineResponse(BaseModel):
    series: list[TimelineSeriesItem]


class TopicChildrenResponse(BaseModel):
    parentLabel: str
    parentLevel: str
    children: list[TopicNode]
    edges: list[GraphEdge]


class DemoResponse(BaseModel):
    hubs: list[Hub]
    topics: list[TopicNode]
    edges: list[GraphEdge]

