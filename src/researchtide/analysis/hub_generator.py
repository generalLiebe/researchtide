"""Automatic hub generation from institution data."""

from __future__ import annotations

import logging
import math
from collections import Counter
from datetime import date

from researchtide.api.schemas import Hub
from researchtide.ingestion.openalex import InstitutionRecord
from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)

# Pre-defined hub regions — institutions are matched to the nearest hub within radius.
HUB_REGIONS: list[dict] = [
    # North America
    {"name": "Bay Area AI", "lat": 37.77, "lon": -122.42, "radius_km": 120, "region": "North America"},
    {"name": "East Coast NLP", "lat": 40.71, "lon": -74.01, "radius_km": 150, "region": "North America"},
    {"name": "Montreal AI", "lat": 45.50, "lon": -73.57, "radius_km": 80, "region": "North America"},
    {"name": "Seattle / PNW", "lat": 47.61, "lon": -122.33, "radius_km": 100, "region": "North America"},
    {"name": "Southern California", "lat": 34.05, "lon": -118.24, "radius_km": 120, "region": "North America"},
    # Europe
    {"name": "London AI", "lat": 51.51, "lon": -0.13, "radius_km": 80, "region": "Europe"},
    {"name": "Europe NLP", "lat": 47.38, "lon": 8.54, "radius_km": 200, "region": "Europe"},
    {"name": "Paris AI", "lat": 48.86, "lon": 2.35, "radius_km": 100, "region": "Europe"},
    {"name": "Nordics AI", "lat": 59.33, "lon": 18.07, "radius_km": 250, "region": "Europe"},
    # Asia
    {"name": "Beijing AI", "lat": 39.90, "lon": 116.41, "radius_km": 120, "region": "Asia"},
    {"name": "Shanghai / Hangzhou", "lat": 31.23, "lon": 121.47, "radius_km": 200, "region": "Asia"},
    {"name": "Tokyo / Kyoto", "lat": 35.69, "lon": 139.69, "radius_km": 250, "region": "Asia"},
    {"name": "Seoul AI", "lat": 37.57, "lon": 126.98, "radius_km": 100, "region": "Asia"},
    {"name": "Singapore AI", "lat": 1.35, "lon": 103.82, "radius_km": 80, "region": "Asia"},
    {"name": "Bangalore AI", "lat": 12.97, "lon": 77.59, "radius_km": 150, "region": "Asia"},
    # Middle East
    {"name": "Tel Aviv AI", "lat": 32.09, "lon": 34.78, "radius_km": 100, "region": "Middle East"},
    # Southern Hemisphere
    {"name": "São Paulo AI", "lat": -23.55, "lon": -46.63, "radius_km": 150, "region": "South America"},
    {"name": "Sydney AI", "lat": -33.87, "lon": 151.21, "radius_km": 150, "region": "Oceania"},
    {"name": "Melbourne AI", "lat": -37.81, "lon": 144.96, "radius_km": 100, "region": "Oceania"},
    {"name": "Cape Town AI", "lat": -33.93, "lon": 18.42, "radius_km": 150, "region": "Africa"},
]

# Minimum papers per hub to be included in output
MIN_PAPERS_THRESHOLD = 5


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance between two points in kilometers."""
    R = 6371.0
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def assign_institutions_to_hubs(
    institutions: list[InstitutionRecord],
    hub_regions: list[dict] | None = None,
) -> dict[str, list[InstitutionRecord]]:
    """Assign each institution to its nearest hub region within radius.

    Returns a dict mapping hub name to list of institutions.
    """
    if hub_regions is None:
        hub_regions = HUB_REGIONS

    assignments: dict[str, list[InstitutionRecord]] = {h["name"]: [] for h in hub_regions}

    for inst in institutions:
        best_hub: str | None = None
        best_dist = float("inf")

        for hub in hub_regions:
            dist = _haversine_km(inst.lat, inst.lon, hub["lat"], hub["lon"])
            if dist <= hub["radius_km"] and dist < best_dist:
                best_dist = dist
                best_hub = hub["name"]

        if best_hub:
            assignments[best_hub].append(inst)

    return assignments


def generate_hubs(
    institutions: list[InstitutionRecord],
    papers: list[Paper],
    topic_assignments: dict[str, int] | None = None,
) -> tuple[list[Hub], dict[str, list[str]]]:
    """Generate Hub objects from institution data and papers.

    Clusters institutions into pre-defined hub regions and computes
    metrics (papersK, intensity, yoyGrowth, topics) for each hub.

    Returns:
        Tuple of (hubs list, hub_paper_map mapping hub name -> paper IDs).
    """
    assignments = assign_institutions_to_hubs(institutions)
    hub_region_map = {h["name"]: h for h in HUB_REGIONS}

    # Build paper lookup by OpenAlex work ID
    paper_by_id: dict[str, Paper] = {p.paper_id: p for p in papers}

    # Collect paper counts per hub for intensity ranking
    hub_paper_counts: dict[str, int] = {}
    for hub_name, insts in assignments.items():
        all_paper_ids: set[str] = set()
        for inst in insts:
            all_paper_ids.update(inst.paper_ids)
        hub_paper_counts[hub_name] = len(all_paper_ids)

    max_papers = max(hub_paper_counts.values(), default=1)

    hubs: list[Hub] = []
    hub_paper_map: dict[str, list[str]] = {}
    hub_id = 1

    for hub_name, insts in assignments.items():
        if not insts:
            continue

        # Collect all unique paper IDs for this hub
        all_paper_ids: set[str] = set()
        for inst in insts:
            all_paper_ids.update(inst.paper_ids)

        total_papers = len(all_paper_ids)
        if total_papers < MIN_PAPERS_THRESHOLD:
            continue

        region_info = hub_region_map[hub_name]

        # Store hub -> paper_id mapping
        hub_paper_map[hub_name] = list(all_paper_ids)

        # papersK: paper count / 1000
        papers_k = round(total_papers / 1000, 1)

        # intensity: relative ranking scaled to 0-100
        intensity = int(round((total_papers / max_papers) * 100)) if max_papers > 0 else 0

        # yoyGrowth: compare papers from last 12 months vs prior 12 months
        yoy_growth = _compute_yoy_growth(all_paper_ids, paper_by_id)

        # topics: extract from paper categories
        topics = _extract_hub_topics(all_paper_ids, paper_by_id)

        # subtitle: top 3 institutions by paper count
        sorted_insts = sorted(insts, key=lambda i: i.paper_count, reverse=True)
        top_names = [i.name for i in sorted_insts[:3]]
        subtitle = " · ".join(top_names)

        hubs.append(Hub(
            id=hub_id,
            name=hub_name,
            subtitle=subtitle,
            region=region_info["region"],
            lon=region_info["lon"],
            lat=region_info["lat"],
            intensity=intensity,
            topics=topics,
            papersK=papers_k,
            yoyGrowth=yoy_growth,
        ))
        hub_id += 1

    # Sort by intensity descending
    hubs.sort(key=lambda h: h.intensity, reverse=True)
    # Re-assign IDs after sorting
    for i, hub in enumerate(hubs):
        hub.id = i + 1

    return hubs, hub_paper_map


def _compute_yoy_growth(
    paper_ids: set[str],
    paper_by_id: dict[str, Paper],
) -> float:
    """Compute year-over-year growth by comparing the two most recent full years.

    Uses publication_year (e.g., 2025 vs 2024) rather than rolling 12-month
    windows, since OpenAlex data for the current year may be incomplete.
    """
    current_year = date.today().year
    # Compare the two most recent full years
    recent_year = current_year - 1   # e.g., 2025
    previous_year = current_year - 2  # e.g., 2024

    recent = 0
    previous = 0
    for pid in paper_ids:
        paper = paper_by_id.get(pid)
        if not paper or not paper.published:
            continue
        y = paper.published.year
        if y == recent_year:
            recent += 1
        elif y == previous_year:
            previous += 1

    if previous == 0:
        return round(min(recent * 10.0, 100.0), 1) if recent > 0 else 0.0
    return round(((recent - previous) / previous) * 100, 1)


def _extract_hub_topics(
    paper_ids: set[str],
    paper_by_id: dict[str, Paper],
    max_topics: int = 4,
) -> list[str]:
    """Extract top topics for a hub from paper categories."""
    counter: Counter[str] = Counter()
    for pid in paper_ids:
        paper = paper_by_id.get(pid)
        if not paper:
            continue
        for cat in paper.categories:
            counter[cat] += 1

    return [cat for cat, _ in counter.most_common(max_topics)]
