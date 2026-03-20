"""arXiv paper ingestion via the arXiv API."""

from __future__ import annotations

import logging
from datetime import date

import arxiv

from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)

DEFAULT_CATEGORIES = [
    "cs.CL",  # Computation and Language
    "cs.AI",  # Artificial Intelligence
    "cs.LG",  # Machine Learning
    "cs.CV",  # Computer Vision
]


def fetch_papers(
    query: str = "cat:cs.CL",
    max_results: int = 500,
    sort_by: arxiv.SortCriterion = arxiv.SortCriterion.SubmittedDate,
) -> list[Paper]:
    """Fetch papers from arXiv and normalize to Paper model."""
    client = arxiv.Client()
    search = arxiv.Search(query=query, max_results=max_results, sort_by=sort_by)

    papers: list[Paper] = []
    for result in client.results(search):
        paper = Paper(
            paper_id=f"arxiv:{result.entry_id}",
            title=result.title,
            abstract=result.summary,
            authors=[a.name for a in result.authors],
            published=result.published.date() if result.published else None,
            source="arxiv",
            arxiv_id=result.entry_id,
            categories=list(result.categories),
        )
        papers.append(paper)

    logger.info("Fetched %d papers from arXiv (query=%s)", len(papers), query)
    return papers


def fetch_by_category(
    categories: list[str] | None = None,
    date_from: date | None = None,
    max_per_category: int = 500,
) -> list[Paper]:
    """Fetch papers for multiple arXiv categories."""
    categories = categories or DEFAULT_CATEGORIES
    all_papers: list[Paper] = []

    for cat in categories:
        query = f"cat:{cat}"
        if date_from:
            query += f" AND submittedDate:[{date_from.strftime('%Y%m%d')}0000 TO 99991231]"
        papers = fetch_papers(query=query, max_results=max_per_category)
        all_papers.extend(papers)

    # Deduplicate by paper_id
    seen: set[str] = set()
    unique: list[Paper] = []
    for p in all_papers:
        if p.paper_id not in seen:
            seen.add(p.paper_id)
            unique.append(p)

    logger.info("Total unique papers: %d (from %d categories)", len(unique), len(categories))
    return unique
