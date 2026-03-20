"""Semantic Scholar API client for citation data enrichment."""

from __future__ import annotations

import logging
import time

import httpx

from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)

S2_API_BASE = "https://api.semanticscholar.org/graph/v1"
S2_FIELDS = "title,abstract,year,citationCount,references.paperId,externalIds"

# Semantic Scholar public API: 1 req/sec without API key
RATE_LIMIT_INTERVAL = 1.1


def enrich_paper(paper: Paper, api_key: str | None = None) -> Paper:
    """Enrich a paper with citation data from Semantic Scholar.

    Looks up by arXiv ID or DOI and fills in citation_count and references.
    """
    headers: dict[str, str] = {}
    if api_key:
        headers["x-api-key"] = api_key

    paper_identifier = None
    if paper.arxiv_id:
        # Extract bare arXiv ID from full URL and strip version suffix (e.g. v1)
        bare_id = paper.arxiv_id.split("/abs/")[-1]
        import re
        bare_id = re.sub(r"v\d+$", "", bare_id)
        paper_identifier = f"ArXiv:{bare_id}"
    elif paper.doi:
        paper_identifier = f"DOI:{paper.doi}"

    if not paper_identifier:
        logger.debug("No identifier for enrichment: %s", paper.paper_id)
        return paper

    url = f"{S2_API_BASE}/paper/{paper_identifier}"
    try:
        resp = httpx.get(url, params={"fields": S2_FIELDS}, headers=headers, timeout=30)
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.warning("S2 API error for %s: %s", paper_identifier, e)
        return paper
    except httpx.RequestError as e:
        logger.warning("S2 request failed for %s: %s", paper_identifier, e)
        return paper

    data = resp.json()
    paper.citation_count = data.get("citationCount")

    refs = data.get("references") or []
    paper.references = [r["paperId"] for r in refs if r.get("paperId")]

    return paper


def enrich_papers(
    papers: list[Paper],
    api_key: str | None = None,
    delay: float = RATE_LIMIT_INTERVAL,
) -> list[Paper]:
    """Enrich multiple papers with Semantic Scholar data, respecting rate limits."""
    enriched: list[Paper] = []
    for i, paper in enumerate(papers):
        enriched.append(enrich_paper(paper, api_key=api_key))
        if i < len(papers) - 1:
            time.sleep(delay)
        if (i + 1) % 50 == 0:
            logger.info("Enriched %d / %d papers", i + 1, len(papers))

    logger.info("Enrichment complete: %d papers", len(enriched))
    return enriched
