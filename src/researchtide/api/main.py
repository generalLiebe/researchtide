"""FastAPI entrypoint for ResearchTide."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from researchtide import __version__
from researchtide.api.demo import build_demo_payload
from researchtide.api.schemas import (
    ArxivIngestRequest,
    ArxivIngestResponse,
    EnrichRequest,
    EnrichResponse,
    HealthResponse,
    InfluenceGraphRequest,
    InfluenceGraphResponse,
    MonthlyCount,
    PaperListResponse,
    PaperOut,
    TimelineResponse,
    TimelineSeriesItem,
    TopicChildrenResponse,
    TopicExtractRequest,
    TopicExtractResponse,
    WeakSignalDetectRequest,
    WeakSignalDetectResponse,
)
from researchtide.analysis.topics import extract_topics
from researchtide.detection.weak_signal import detect_weak_signals
from researchtide.graph.influence import build_influence_graph
from researchtide.ingestion.arxiv import fetch_papers
from researchtide.ingestion.semantic_scholar import RATE_LIMIT_INTERVAL, enrich_papers

load_dotenv()

app = FastAPI(title="ResearchTide API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("RESEARCHTIDE_CORS_ORIGIN", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=__version__)


@app.get("/demo/dashboard")
def demo_dashboard(seed: int = 42):
    return build_demo_payload(seed=seed)


@app.get("/live/dashboard")
def live_dashboard(refresh: bool = False):
    from researchtide.api.live_dashboard import build_live_payload

    email = os.getenv("OPENALEX_EMAIL", "")
    cache_ttl = int(os.getenv("DASHBOARD_CACHE_TTL", "21600"))
    return build_live_payload(
        email=email,
        cache_ttl=0 if refresh else cache_ttl,
    )


@app.get("/live/papers", response_model=PaperListResponse)
def live_papers(
    hub: str | None = None,
    topic: str | None = None,
    keyword: str | None = None,
    author: str | None = None,
    min_citations: int | None = None,
    sort: str = "relevance",
    limit: int = 50,
    offset: int = 0,
) -> PaperListResponse:
    """Return papers, optionally filtered by hub, topic, keyword, or author."""
    from researchtide.api.live_dashboard import get_cached_papers

    papers_raw, hub_paper_map = get_cached_papers()

    # If papers cache doesn't exist yet, trigger a live dashboard rebuild
    if not papers_raw:
        from researchtide.api.live_dashboard import build_live_payload

        email = os.getenv("OPENALEX_EMAIL", "")
        build_live_payload(email=email, cache_ttl=0)
        papers_raw, hub_paper_map = get_cached_papers()

    # Determine which paper IDs to include
    if hub:
        allowed_ids = set(hub_paper_map.get(hub, []))
        papers_raw = [p for p in papers_raw if p.get("paper_id") in allowed_ids]

    if topic:
        topic_lower = topic.lower()
        papers_raw = [
            p for p in papers_raw
            if any(topic_lower in cat.lower() for cat in p.get("categories", []))
        ]

    if keyword:
        kw = keyword.lower()
        papers_raw = [
            p for p in papers_raw
            if kw in p.get("title", "").lower() or kw in p.get("abstract", "").lower()
        ]

    if author:
        au = author.lower()
        papers_raw = [
            p for p in papers_raw
            if any(au in a.lower() for a in p.get("authors", []))
        ]

    if min_citations is not None:
        papers_raw = [p for p in papers_raw if (p.get("citation_count") or 0) >= min_citations]

    from datetime import date as _date
    _today = _date.today()

    def _velocity(p: dict) -> float:
        pub = p.get("published")
        if not pub:
            return 0.0
        try:
            pub_date = _date.fromisoformat(str(pub)[:10])
        except ValueError:
            return 0.0
        months = max((_today - pub_date).days / 30.44, 1)
        return (p.get("citation_count") or 0) / months

    if sort == "citations":
        papers_raw.sort(key=lambda p: p.get("citation_count") or 0, reverse=True)
    elif sort == "date":
        papers_raw.sort(key=lambda p: p.get("published") or "", reverse=True)
    elif sort == "velocity":
        papers_raw.sort(key=_velocity, reverse=True)

    total = len(papers_raw)
    page = papers_raw[offset : offset + limit]

    papers_out = [
        PaperOut(
            paper_id=p.get("paper_id", ""),
            title=p.get("title", ""),
            authors=p.get("authors", []),
            published=p.get("published"),
            arxiv_id=p.get("arxiv_id"),
            doi=p.get("doi"),
            categories=p.get("categories", []),
            citation_count=p.get("citation_count"),
            abstract=p.get("abstract", ""),
            reference_count=len(p.get("references", [])) if isinstance(p.get("references"), list) else p.get("reference_count", 0),
            citation_velocity=_velocity(p) if sort == "velocity" else None,
        )
        for p in page
    ]
    return PaperListResponse(papers=papers_out, total=total)


@app.get("/live/timeline", response_model=TimelineResponse)
def live_timeline() -> TimelineResponse:
    """Return monthly publication series + acceleration per category."""
    from researchtide.api.live_dashboard import get_cached_papers
    from researchtide.analysis.citation_velocity import build_monthly_series, compute_acceleration
    from researchtide.models.paper import Paper as PaperModel

    papers_raw, _ = get_cached_papers()

    if not papers_raw:
        from researchtide.api.live_dashboard import build_live_payload

        email = os.getenv("OPENALEX_EMAIL", "")
        build_live_payload(email=email, cache_ttl=0)
        papers_raw, _ = get_cached_papers()

    # Convert raw dicts to Paper models for build_monthly_series
    paper_models = []
    for p in papers_raw:
        try:
            paper_models.append(PaperModel(**p))
        except Exception:
            continue

    monthly = build_monthly_series(paper_models)

    # Build series items with acceleration, pick top 10 by total count
    items: list[tuple[int, TimelineSeriesItem]] = []
    for cat, series in monthly.items():
        acc = compute_acceleration(series)
        total = sum(c for _, c in series)
        monthly_counts = [
            MonthlyCount(month=d.strftime("%Y-%m"), count=c)
            for d, c in series
        ]
        items.append((total, TimelineSeriesItem(
            category=cat,
            monthly=monthly_counts,
            acceleration=round(acc, 2),
        )))

    items.sort(key=lambda x: x[0], reverse=True)
    top = [item for _, item in items[:10]]

    return TimelineResponse(series=top)


@app.get("/live/topics/children", response_model=TopicChildrenResponse)
def live_topic_children(parent: str, level: str) -> TopicChildrenResponse:
    """Return child topics for a given parent at a given hierarchy level."""
    from researchtide.api.live_dashboard import get_topic_children

    children, edges = get_topic_children(parent, level)
    return TopicChildrenResponse(
        parentLabel=parent,
        parentLevel=level,
        children=children,
        edges=edges,
    )


@app.post("/ingest/arxiv", response_model=ArxivIngestResponse)
def ingest_arxiv(req: ArxivIngestRequest) -> ArxivIngestResponse:
    papers = fetch_papers(query=req.query, max_results=req.max_results)
    return ArxivIngestResponse(papers=papers)


@app.post("/enrich/semantic-scholar", response_model=EnrichResponse)
def enrich_semantic_scholar(req: EnrichRequest) -> EnrichResponse:
    api_key = req.api_key or os.getenv("S2_API_KEY")
    delay = req.delay_seconds if req.delay_seconds is not None else RATE_LIMIT_INTERVAL
    papers = enrich_papers(req.papers, api_key=api_key, delay=delay)
    return EnrichResponse(papers=papers)


@app.post("/analysis/topics/extract", response_model=TopicExtractResponse)
def analysis_extract_topics(req: TopicExtractRequest) -> TopicExtractResponse:
    # We need assignments (paper_id -> topic_id) for downstream graph.
    papers_with_abs = [p for p in req.papers if p.abstract]
    if not papers_with_abs:
        return TopicExtractResponse(snapshots=[], topic_assignments={})

    docs = [p.abstract for p in papers_with_abs]
    model, snapshots = extract_topics(papers_with_abs, min_topic_size=req.min_topic_size)
    topic_assignments: dict[str, int] = {}

    if model is not None:
        topics, _probs = model.transform(docs)
        for p, t in zip(papers_with_abs, topics):
            if t != -1:
                topic_assignments[p.paper_id] = int(t)

    # Convert snapshots to API-friendly shape
    snap_out = [
        {
            "topic_id": s.topic_id,
            "label": s.label,
            "keywords": s.keywords,
            "paper_count": s.paper_count,
            "citation_velocity": s.citation_velocity,
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "timestamp": s.timestamp,
        }
        for s in snapshots
    ]

    return TopicExtractResponse(snapshots=snap_out, topic_assignments=topic_assignments)


@app.post("/detection/weak-signal", response_model=WeakSignalDetectResponse)
def detection_weak_signal(req: WeakSignalDetectRequest) -> WeakSignalDetectResponse:
    # Rehydrate minimal TopicSnapshot for the detector
    from researchtide.models.paper import ResearchStatus, TopicSnapshot

    snaps = [
        TopicSnapshot(
            topic_id=s.topic_id,
            label=s.label,
            keywords=s.keywords,
            paper_count=s.paper_count,
            citation_velocity=s.citation_velocity,
            status=ResearchStatus(s.status) if s.status in ResearchStatus._value2member_map_ else ResearchStatus.WEAK_SIGNAL,
            timestamp=s.timestamp,
        )
        for s in req.snapshots
    ]
    detected = detect_weak_signals(snaps, contamination=req.contamination)

    out = [
        {
            "topic_id": s.topic_id,
            "label": s.label,
            "keywords": s.keywords,
            "paper_count": s.paper_count,
            "citation_velocity": s.citation_velocity,
            "status": s.status.value,
            "timestamp": s.timestamp,
        }
        for s in detected
    ]
    return WeakSignalDetectResponse(snapshots=out)


@app.post("/graph/influence", response_model=InfluenceGraphResponse)
def graph_influence(req: InfluenceGraphRequest) -> InfluenceGraphResponse:
    G = build_influence_graph(req.papers, req.topic_assignments, req.topic_labels)

    nodes = [{"id": int(n), "label": G.nodes[n].get("label", str(n)), "meta": {}} for n in G.nodes]

    # normalize weights to 0..1 for UI opacity/width control
    weights = [float(G.edges[e].get("weight", 0.0)) for e in G.edges]
    max_w = max(weights, default=1.0)
    edges = [
        {
            "source": int(u),
            "target": int(v),
            "weight": float(G.edges[(u, v)].get("weight", 0.0)) / max_w,
        }
        for (u, v) in G.edges
    ]
    return InfluenceGraphResponse(nodes=nodes, edges=edges)

