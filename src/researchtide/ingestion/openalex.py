"""OpenAlex API client for fetching works and institution data."""

from __future__ import annotations

import logging
import time
from datetime import date

import httpx
from pydantic import BaseModel, Field

from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)

OPENALEX_API_BASE = "https://api.openalex.org"

# OpenAlex field IDs for AI-related fields
FIELD_IDS = {
    "ai": "C154945302",
    "nlp": "C204321447",
    "cv": "C31972630",
    "ml": "C119857082",
}

# Polite pool: 10 req/sec with mailto header
RATE_LIMIT_INTERVAL = 0.11


class InstitutionRecord(BaseModel):
    """Aggregated institution info extracted from OpenAlex works."""

    openalex_id: str
    name: str
    lat: float
    lon: float
    country_code: str = ""
    paper_count: int = 0
    paper_ids: list[str] = Field(default_factory=list)


def fetch_works(
    categories: list[str] | None = None,
    max_results: int = 500,
    email: str = "",
) -> list[dict]:
    """Fetch works from OpenAlex API using cursor pagination.

    Fetches per-year to ensure balanced year distribution for YoY calculation.
    Covers the two most recent full years plus the current year.

    Args:
        categories: OpenAlex concept/field IDs to filter on.
            Defaults to AI and NLP fields.
        max_results: Maximum number of works to retrieve (total across all years).
        email: Email for polite pool (higher rate limits).

    Returns:
        List of raw OpenAlex work dicts.
    """
    if categories is None:
        categories = [FIELD_IDS["ai"], FIELD_IDS["nlp"]]

    current_year = time.localtime().tm_year
    # Fetch balanced across: current year, last year, year before
    years = [current_year, current_year - 1, current_year - 2]
    per_year = max_results // len(years)

    all_works: list[dict] = []
    for year in years:
        year_works = _fetch_works_for_year(
            categories=categories,
            year=year,
            max_results=per_year,
            email=email,
        )
        all_works.extend(year_works)
        logger.info("Year %d: fetched %d works", year, len(year_works))

    return all_works


def _fetch_works_for_year(
    categories: list[str],
    year: int,
    max_results: int,
    email: str = "",
) -> list[dict]:
    """Fetch works for a single year from OpenAlex."""
    filter_parts = "|".join(categories)
    filter_str = f"concepts.id:{filter_parts},publication_year:{year}"

    headers: dict[str, str] = {}
    if email:
        headers["User-Agent"] = f"mailto:{email}"

    params: dict[str, str | int] = {
        "filter": filter_str,
        "per_page": min(200, max_results),
        "cursor": "*",
    }
    if email:
        params["mailto"] = email

    works: list[dict] = []
    with httpx.Client(base_url=OPENALEX_API_BASE, headers=headers, timeout=30) as client:
        while len(works) < max_results:
            try:
                resp = client.get("/works", params=params)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                logger.warning("OpenAlex API error for year %d: %s", year, e)
                break
            except httpx.RequestError as e:
                logger.warning("OpenAlex request failed for year %d: %s", year, e)
                break

            data = resp.json()
            results = data.get("results", [])
            if not results:
                break

            works.extend(results)

            next_cursor = data.get("meta", {}).get("next_cursor")
            if not next_cursor:
                break
            params["cursor"] = next_cursor

            time.sleep(RATE_LIMIT_INTERVAL)

    return works[:max_results]


def extract_institutions(works: list[dict], email: str = "") -> list[InstitutionRecord]:
    """Extract and aggregate institution data from OpenAlex works.

    Two-phase approach:
    1. Collect institution IDs and paper counts from works authorships.
    2. Fetch geo coordinates from the OpenAlex institutions API.
    """
    # Phase 1: collect institution IDs and their paper associations
    inst_papers: dict[str, dict] = {}  # inst_id -> {name, paper_ids}

    for work in works:
        work_id = work.get("id", "")
        for authorship in work.get("authorships", []):
            for inst in authorship.get("institutions", []):
                inst_id = inst.get("id", "")
                if not inst_id:
                    continue

                if inst_id not in inst_papers:
                    inst_papers[inst_id] = {
                        "name": inst.get("display_name", "Unknown"),
                        "country_code": inst.get("country_code", ""),
                        "paper_ids": set(),
                    }
                inst_papers[inst_id]["paper_ids"].add(work_id)

    if not inst_papers:
        return []

    # Phase 2: fetch geo data from institutions API in batches
    logger.info("Fetching geo data for %d institutions...", len(inst_papers))
    inst_geo = _fetch_institution_geo(list(inst_papers.keys()), email=email)

    # Build InstitutionRecord list
    records: list[InstitutionRecord] = []
    for inst_id, info in inst_papers.items():
        geo = inst_geo.get(inst_id)
        if not geo:
            continue
        paper_ids = list(info["paper_ids"])
        records.append(InstitutionRecord(
            openalex_id=inst_id,
            name=info["name"],
            lat=geo["lat"],
            lon=geo["lon"],
            country_code=info.get("country_code") or geo.get("country_code") or "",
            paper_count=len(paper_ids),
            paper_ids=paper_ids,
        ))

    logger.info("Got geo data for %d / %d institutions", len(records), len(inst_papers))
    return records


def _fetch_institution_geo(
    inst_ids: list[str],
    email: str = "",
) -> dict[str, dict]:
    """Fetch geo coordinates for institutions using the OpenAlex institutions filter API.

    Uses batch filtering (pipe-separated IDs) to minimize API calls.
    Returns {inst_id: {"lat": float, "lon": float, "country_code": str}}.
    """
    result: dict[str, dict] = {}
    headers: dict[str, str] = {}
    if email:
        headers["User-Agent"] = f"mailto:{email}"

    # Batch by 50 IDs per request (OpenAlex filter limit)
    batch_size = 50
    with httpx.Client(base_url=OPENALEX_API_BASE, headers=headers, timeout=30) as client:
        for i in range(0, len(inst_ids), batch_size):
            batch = inst_ids[i : i + batch_size]
            filter_str = "openalex:" + "|".join(batch)
            params: dict[str, str | int] = {
                "filter": filter_str,
                "per_page": batch_size,
                "select": "id,geo,country_code",
            }
            if email:
                params["mailto"] = email

            try:
                resp = client.get("/institutions", params=params)
                resp.raise_for_status()
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning("Failed to fetch institution geo batch: %s", e)
                continue

            for inst in resp.json().get("results", []):
                geo = inst.get("geo") or {}
                lat = geo.get("latitude")
                lon = geo.get("longitude")
                if lat is not None and lon is not None:
                    result[inst["id"]] = {
                        "lat": float(lat),
                        "lon": float(lon),
                        "country_code": inst.get("country_code", ""),
                    }

            time.sleep(RATE_LIMIT_INTERVAL)

    return result


def works_to_papers(works: list[dict]) -> list[Paper]:
    """Convert OpenAlex work dicts to the existing Paper model."""
    papers: list[Paper] = []
    for w in works:
        oa_id = w.get("id", "")
        title = w.get("title") or ""
        abstract_inv = w.get("abstract_inverted_index")
        abstract = _reconstruct_abstract(abstract_inv) if abstract_inv else ""

        authors = []
        for authorship in w.get("authorships", []):
            author = authorship.get("author", {})
            name = author.get("display_name")
            if name:
                authors.append(name)

        pub_date = None
        pub_date_str = w.get("publication_date")
        if pub_date_str:
            try:
                pub_date = date.fromisoformat(pub_date_str)
            except ValueError:
                pass

        doi = w.get("doi")
        if doi and doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/"):]

        ids = w.get("ids", {})
        arxiv_id = None
        openalex_url = ids.get("openalex", "")
        if "arxiv" in (ids.get("arxiv") or ""):
            arxiv_id = ids["arxiv"]

        categories = []
        topic = w.get("primary_topic") or {}
        if topic.get("display_name"):
            categories.append(topic["display_name"])
        field = topic.get("field", {})
        if field.get("display_name"):
            categories.append(field["display_name"])

        papers.append(Paper(
            paper_id=oa_id,
            title=title,
            abstract=abstract,
            authors=authors,
            published=pub_date,
            source="openalex",
            arxiv_id=arxiv_id,
            doi=doi,
            categories=categories,
            citation_count=w.get("cited_by_count"),
        ))

    return _deduplicate_papers(papers)


def _normalize_title(title: str) -> str:
    """Normalize title for dedup comparison."""
    import re
    return re.sub(r'[^a-z0-9]', '', title.lower())


def _deduplicate_papers(papers: list[Paper]) -> list[Paper]:
    """Deduplicate papers by DOI, then by normalized title + first author.

    Two passes: (1) exact DOI match, (2) title+author match on ALL remaining
    papers (catches cases like Zenodo version DOIs where DOIs differ but
    the paper is the same).
    """
    # Pass 1: DOI-based dedup
    seen_doi: dict[str, Paper] = {}
    no_doi: list[Paper] = []

    for p in papers:
        if p.doi:
            doi = p.doi.lower().strip()
            if doi in seen_doi:
                if (p.citation_count or 0) > (seen_doi[doi].citation_count or 0):
                    seen_doi[doi] = p
            else:
                seen_doi[doi] = p
        else:
            no_doi.append(p)

    after_doi = list(seen_doi.values()) + no_doi

    # Pass 2: title + first author dedup on ALL papers
    seen_title: dict[str, Paper] = {}
    for p in after_doi:
        key = _normalize_title(p.title) + "|" + (p.authors[0].lower() if p.authors else "")
        if key in seen_title:
            if (p.citation_count or 0) > (seen_title[key].citation_count or 0):
                seen_title[key] = p
        else:
            seen_title[key] = p

    return list(seen_title.values())


def _reconstruct_abstract(inverted_index: dict[str, list[int]]) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    word_positions: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort(key=lambda x: x[0])
    return " ".join(w for _, w in word_positions)
