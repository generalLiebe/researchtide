"""Incremental and full data refresh for ResearchTide.

Usage:
    python scripts/refresh_data.py --incremental   # Light: fetch new papers only
    python scripts/refresh_data.py --full           # Heavy: rebuild all caches
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

# Ensure the package is importable when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("refresh_data")


def _last_publication_date(cache_dir: str = "data") -> str | None:
    """Return the most recent publication date from cached papers, or None."""
    papers_path = Path(cache_dir) / "live_papers.json"
    if not papers_path.exists():
        return None
    try:
        data = json.loads(papers_path.read_text())
        papers = data.get("papers", [])
    except (json.JSONDecodeError, KeyError):
        return None

    latest: str | None = None
    for p in papers:
        pub = p.get("published")
        if pub:
            pub_str = str(pub)[:10]
            if latest is None or pub_str > latest:
                latest = pub_str
    return latest


def refresh_incremental(cache_dir: str = "data") -> int:
    """Fetch only new papers since last run and append to cache.

    Returns the number of new papers added.
    """
    from researchtide.api.live_dashboard import append_papers
    from researchtide.ingestion.openalex import fetch_works, works_to_papers
    from researchtide.ingestion.semantic_scholar import enrich_papers

    email = os.getenv("OPENALEX_EMAIL", "")
    s2_key = os.getenv("S2_API_KEY")

    # Determine from_date: last known publication date, or 30 days ago
    last_date = _last_publication_date(cache_dir)
    if last_date:
        from_date = last_date
        logger.info("Incremental fetch from %s", from_date)
    else:
        from_date = (date.today() - timedelta(days=30)).isoformat()
        logger.info("No existing cache, fetching last 30 days from %s", from_date)

    # Fetch new works from OpenAlex
    works = fetch_works(max_results=500, email=email, from_date=from_date)
    if not works:
        logger.info("No new works found.")
        return 0

    papers = works_to_papers(works)
    logger.info("Fetched %d papers from OpenAlex", len(papers))

    # S2 enrichment for new papers (only those with identifiers)
    enrichable = [p for p in papers if p.arxiv_id or p.doi]
    if enrichable and s2_key:
        logger.info("Enriching %d papers via Semantic Scholar...", len(enrichable))
        enrich_papers(enrichable, api_key=s2_key, delay=1.1)

    # Append to cache (deduplicating)
    added = append_papers(papers, cache_dir=cache_dir)
    logger.info("Added %d new papers (total fetch: %d)", added, len(papers))
    return added


def refresh_full(cache_dir: str = "data") -> None:
    """Rebuild all caches from the accumulated papers.

    Skips OpenAlex re-fetch — works from the existing papers cache.
    Rebuilds: dashboard, keywords, hierarchy.
    """
    from researchtide.api.live_dashboard import (
        build_live_payload,
        get_cached_papers,
    )

    papers_raw, _ = get_cached_papers(cache_dir=cache_dir)

    if not papers_raw:
        logger.warning("No cached papers found. Running incremental first...")
        refresh_incremental(cache_dir=cache_dir)
        papers_raw, _ = get_cached_papers(cache_dir=cache_dir)
        if not papers_raw:
            logger.error("Still no papers after incremental fetch. Aborting full rebuild.")
            return

    logger.info("Full rebuild with %d papers...", len(papers_raw))

    # Rebuild dashboard payload (this re-fetches from OpenAlex for hubs/topics)
    email = os.getenv("OPENALEX_EMAIL", "")
    build_live_payload(email=email, cache_ttl=0, cache_dir=cache_dir)
    logger.info("Dashboard cache rebuilt.")

    # Rebuild keywords cache
    _rebuild_keywords_cache(cache_dir)
    logger.info("Keywords cache rebuilt.")

    logger.info("Full rebuild complete.")


def _rebuild_keywords_cache(cache_dir: str = "data") -> None:
    """Rebuild the keywords cache from current papers."""
    from researchtide.api.live_dashboard import get_cached_papers
    from researchtide.analysis.keyword_trends import build_keyword_metrics

    papers_raw, _ = get_cached_papers(cache_dir=cache_dir)
    if not papers_raw:
        return

    metrics = build_keyword_metrics(papers_raw, top_n=100)

    # Serialize to cache
    keywords_out = []
    for m in metrics:
        keywords_out.append({
            "keyword": m.keyword,
            "total_count": m.total_count,
            "monthly": [{"month": d.strftime("%Y-%m"), "count": c} for d, c in m.monthly],
            "velocity": m.velocity,
            "acceleration": m.acceleration,
            "horizon_score": m.horizon_score,
            "horizon_alert_level": m.horizon_alert_level,
            "horizon_factors": m.horizon_factors,
            "forecast": [
                {
                    "month": fp.month,
                    "predicted": fp.predicted,
                    "lower_80": fp.lower_80,
                    "upper_80": fp.upper_80,
                }
                for fp in m.forecast
            ],
            "is_emerging": m.is_emerging,
            "fields": m.fields,
            "paper_count": m.paper_count,
            "first_seen": m.first_seen,
            "last_seen": m.last_seen,
        })

    top_emerging = [m.keyword for m in metrics if m.is_emerging][:10]
    field_groups: dict[str, list[str]] = {}
    for m in metrics:
        for f in m.fields:
            field_groups.setdefault(f, []).append(m.keyword)

    payload = {
        "keywords": keywords_out,
        "top_emerging": top_emerging,
        "field_groups": field_groups,
        "_cached_at": time.time(),
    }

    cache_path = Path(cache_dir) / "live_keywords.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description="ResearchTide data refresh")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--incremental",
        action="store_true",
        help="Fetch new papers only (light, run frequently)",
    )
    group.add_argument(
        "--full",
        action="store_true",
        help="Rebuild all caches from accumulated papers (heavy, run daily)",
    )
    parser.add_argument(
        "--cache-dir",
        default="data",
        help="Directory for cache files (default: data)",
    )
    args = parser.parse_args()

    if args.incremental:
        refresh_incremental(cache_dir=args.cache_dir)
    else:
        refresh_full(cache_dir=args.cache_dir)


if __name__ == "__main__":
    main()
