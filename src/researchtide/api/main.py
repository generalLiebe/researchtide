"""FastAPI entrypoint for ResearchTide."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from researchtide import __version__
from researchtide.api.demo import build_demo_payload
from researchtide.api.schemas import (
    CacheStatus,
    ArxivIngestRequest,
    ArxivIngestResponse,
    EnrichRequest,
    EnrichResponse,
    ForecastPoint,
    HealthResponse,
    HorizonAlert,
    HorizonResponse,
    InfluenceGraphRequest,
    InfluenceGraphResponse,
    KeywordMetricOut,
    KeywordTrendsResponse,
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

logger = logging.getLogger(__name__)

_start_time = time.time()

# ---------------------------------------------------------------------------
# Background scheduler
# ---------------------------------------------------------------------------
_INCREMENTAL_INTERVAL = 4 * 3600  # 4 hours
_FULL_REBUILD_EVERY = 6  # every 6th incremental run → ~24h


async def _scheduled_refresh() -> None:
    """Background loop: incremental every 4 h, full rebuild every ~24 h."""
    # Wait before first run so the service can start accepting requests
    await asyncio.sleep(120)
    # First run: always do a full rebuild to populate all caches
    try:
        logger.info("Initial full rebuild starting…")
        await asyncio.to_thread(_run_full_refresh)
        logger.info("Initial full rebuild done.")
    except Exception:
        logger.exception("Initial full rebuild failed")
    counter = 0
    while True:
        try:
            counter += 1
            if counter % _FULL_REBUILD_EVERY == 0:
                logger.info("Scheduled full rebuild starting…")
                await asyncio.to_thread(_run_full_refresh)
                logger.info("Scheduled full rebuild done.")
            else:
                logger.info("Scheduled incremental refresh starting…")
                await asyncio.to_thread(_run_incremental_refresh)
                logger.info("Scheduled incremental refresh done.")
        except Exception:
            logger.exception("Scheduled refresh failed")
        await asyncio.sleep(_INCREMENTAL_INTERVAL)


def _run_incremental_refresh() -> None:
    from researchtide.api.live_dashboard import append_papers, get_cached_papers
    from researchtide.ingestion.openalex import fetch_works, works_to_papers
    from researchtide.ingestion.semantic_scholar import enrich_papers as s2_enrich

    email = os.getenv("OPENALEX_EMAIL", "")
    s2_key = os.getenv("S2_API_KEY")

    # Determine from_date from cached papers
    papers_raw, _ = get_cached_papers()
    from_date = None
    if papers_raw:
        dates = [str(p.get("published", ""))[:10] for p in papers_raw if p.get("published")]
        if dates:
            from_date = max(dates)

    if not from_date:
        from datetime import date, timedelta

        from_date = (date.today() - timedelta(days=30)).isoformat()

    works = fetch_works(max_results=500, email=email, from_date=from_date)
    if not works:
        return

    papers = works_to_papers(works)

    enrichable = [p for p in papers if p.arxiv_id or p.doi]
    if enrichable and s2_key:
        s2_enrich(enrichable, api_key=s2_key, delay=1.1)

    append_papers(papers)


def _run_full_refresh() -> None:
    from researchtide.api.live_dashboard import build_live_payload

    email = os.getenv("OPENALEX_EMAIL", "")
    build_live_payload(email=email, cache_ttl=0)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Start the background scheduler on app startup."""
    task = asyncio.create_task(_scheduled_refresh())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="ResearchTide API", version=__version__, lifespan=lifespan)

# CORS — support comma-separated origins via env var
_cors_raw = os.getenv("RESEARCHTIDE_CORS_ORIGIN", "http://localhost:5173")
_cors_origins = [o.strip() for o in _cors_raw.split(",")]
_allow_all = "*" in _cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _allow_all,  # credentials cannot be used with "*"
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    from researchtide.api.live_dashboard import get_cached_papers

    # Check cache files
    cache_files = {
        "dashboard": "data/live_dashboard.json",
        "papers": "data/live_papers.json",
        "keywords": "data/live_keywords.json",
        "hierarchy": "data/live_hierarchy.json",
    }
    caches: dict[str, CacheStatus] = {}
    for name, filepath in cache_files.items():
        p = Path(filepath)
        if p.exists():
            stat = p.stat()
            caches[name] = CacheStatus(
                exists=True,
                age_seconds=round(time.time() - stat.st_mtime, 1),
                size_bytes=stat.st_size,
            )
        else:
            caches[name] = CacheStatus(exists=False)

    # Count data
    papers_raw, _ = get_cached_papers()
    paper_count = len(papers_raw)

    # Determine status
    has_papers = caches.get("papers", CacheStatus(exists=False)).exists
    status = "ok" if has_papers else "degraded"

    return HealthResponse(
        status=status,
        version=__version__,
        paper_count=paper_count,
        caches=caches,
        uptime_seconds=round(time.time() - _start_time, 1),
    )


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
        from researchtide.api.live_dashboard import get_topic_family_labels

        family = get_topic_family_labels(topic)
        papers_raw = [
            p for p in papers_raw
            if any(cat.lower() in family for cat in p.get("categories", []))
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
    """Return monthly publication series + acceleration + forecast per category."""
    from researchtide.api.live_dashboard import get_cached_papers
    from researchtide.analysis.citation_velocity import build_monthly_series, compute_acceleration
    from researchtide.analysis.forecasting import forecast_series
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

    # Build series items with acceleration + forecast, pick top 10 by total count
    items: list[tuple[int, TimelineSeriesItem]] = []
    for cat, series in monthly.items():
        acc = compute_acceleration(series)
        total = sum(c for _, c in series)
        monthly_counts = [
            MonthlyCount(month=d.strftime("%Y-%m"), count=c)
            for d, c in series
        ]

        # Forecast next 6 months
        fc_points = forecast_series(series, horizon=6)
        forecast_out = [
            ForecastPoint(
                month=fp.month,
                predicted=fp.predicted,
                lower_80=fp.lower_80,
                upper_80=fp.upper_80,
            )
            for fp in fc_points
        ]

        items.append((total, TimelineSeriesItem(
            category=cat,
            monthly=monthly_counts,
            acceleration=round(acc, 2),
            forecast=forecast_out,
        )))

    items.sort(key=lambda x: x[0], reverse=True)
    top = [item for _, item in items[:10]]

    return TimelineResponse(series=top)


@app.get("/live/horizon", response_model=HorizonResponse)
def live_horizon() -> HorizonResponse:
    """Return horizon scanning alerts for emerging topics."""
    from researchtide.api.live_dashboard import get_cached_papers, get_horizon_data

    papers_raw, _ = get_cached_papers()

    if not papers_raw:
        from researchtide.api.live_dashboard import build_live_payload

        email = os.getenv("OPENALEX_EMAIL", "")
        build_live_payload(email=email, cache_ttl=0)
        papers_raw, _ = get_cached_papers()

    alerts_data = get_horizon_data(papers_raw)
    alerts = [
        HorizonAlert(
            topic=a["topic"],
            score=a["score"],
            alert_level=a["alert_level"],
            factors=a["factors"],
            cross_field=a["cross_fields"],
        )
        for a in alerts_data
    ]
    return HorizonResponse(alerts=alerts)


def _build_keywords_response() -> KeywordTrendsResponse:
    """Compute keyword metrics and build response (heavy operation)."""
    from researchtide.api.live_dashboard import get_cached_papers
    from researchtide.analysis.keyword_trends import build_keyword_metrics

    papers_raw, _ = get_cached_papers()

    if not papers_raw:
        from researchtide.api.live_dashboard import build_live_payload

        email = os.getenv("OPENALEX_EMAIL", "")
        build_live_payload(email=email, cache_ttl=0)
        papers_raw, _ = get_cached_papers()

    metrics = build_keyword_metrics(papers_raw, top_n=100)

    keywords_out = [
        KeywordMetricOut(
            keyword=m.keyword,
            total_count=m.total_count,
            monthly=[MonthlyCount(month=d.strftime("%Y-%m"), count=c) for d, c in m.monthly],
            velocity=m.velocity,
            acceleration=m.acceleration,
            horizon_score=m.horizon_score,
            horizon_alert_level=m.horizon_alert_level,
            horizon_factors=m.horizon_factors,
            forecast=[
                ForecastPoint(
                    month=fp.month,
                    predicted=fp.predicted,
                    lower_80=fp.lower_80,
                    upper_80=fp.upper_80,
                )
                for fp in m.forecast
            ],
            is_emerging=m.is_emerging,
            fields=m.fields,
            paper_count=m.paper_count,
            first_seen=m.first_seen,
            last_seen=m.last_seen,
        )
        for m in metrics
    ]

    top_emerging = [m.keyword for m in metrics if m.is_emerging][:10]

    field_groups: dict[str, list[str]] = {}
    for m in metrics:
        for f in m.fields:
            field_groups.setdefault(f, []).append(m.keyword)

    return KeywordTrendsResponse(
        keywords=keywords_out,
        top_emerging=top_emerging,
        field_groups=field_groups,
    )


@app.get("/live/keywords", response_model=KeywordTrendsResponse)
def live_keywords(refresh: bool = False) -> KeywordTrendsResponse:
    """Return keyword-level trend metrics (cached to disk)."""
    import json
    import time
    from pathlib import Path

    cache_path = Path("data") / "live_keywords.json"
    cache_ttl = int(os.getenv("DASHBOARD_CACHE_TTL", "21600"))

    # Return from cache if fresh
    if not refresh and cache_path.exists():
        try:
            data = json.loads(cache_path.read_text())
            cached_at = data.pop("_cached_at", 0)
            if time.time() - cached_at < cache_ttl:
                return KeywordTrendsResponse(**data)
        except Exception:
            pass

    # Compute fresh
    response = _build_keywords_response()

    # Write cache
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        payload = response.model_dump()
        payload["_cached_at"] = time.time()
        cache_path.write_text(json.dumps(payload, default=str))
    except Exception:
        pass

    return response


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

