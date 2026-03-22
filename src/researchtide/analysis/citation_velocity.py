"""Citation velocity time-series analysis."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date

import numpy as np

from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)


def build_monthly_series(
    papers: list[Paper],
) -> dict[str, list[tuple[date, int]]]:
    """Build monthly publication count time-series per arXiv category.

    Returns:
        Mapping of category -> [(month_start, paper_count), ...] sorted by date.
    """
    monthly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    today = date.today()

    for paper in papers:
        if not paper.published:
            continue
        if paper.published > today:
            continue
        month_key = paper.published.strftime("%Y-%m")
        for cat in paper.categories:
            monthly[cat][month_key] += 1

    result: dict[str, list[tuple[date, int]]] = {}
    for cat, months in monthly.items():
        sorted_months = sorted(months.items())
        result[cat] = [
            (date.fromisoformat(f"{m}-01"), count) for m, count in sorted_months
        ]

    return result


def compute_acceleration(series: list[tuple[date, int]], window: int = 3) -> float:
    """Compute year-over-year acceleration of a time-series.

    Uses YoY (same-month comparison) to filter out seasonal cycles.
    For series shorter than 13 months, falls back to raw 2nd derivative.

    Positive acceleration means YoY growth rate itself is increasing — a key
    weak signal indicator.

    Args:
        series: Monthly (date, count) pairs, sorted by date.
        window: Number of months for smoothing.

    Returns:
        Average acceleration over the most recent window.
    """
    if len(series) < window + 2:
        return 0.0

    # Build a month-keyed lookup for YoY comparison
    month_map: dict[str, int] = {}
    for d, count in series:
        month_map[d.strftime("%Y-%m")] = count

    dates = [d for d, _ in series]

    # If we have >= 13 months of data, use YoY deltas to remove seasonality
    if len(series) >= 13:
        yoy_deltas: list[float] = []
        for d, count in series:
            prev_year_key = d.replace(year=d.year - 1).strftime("%Y-%m")
            prev_count = month_map.get(prev_year_key)
            if prev_count is not None:
                yoy_deltas.append(float(count - prev_count))

        if len(yoy_deltas) >= window + 1:
            arr = np.array(yoy_deltas)
            accel = np.diff(arr)
            recent = accel[-window:]
            return float(np.mean(recent))

    # Fallback: raw 2nd derivative for short series
    counts = np.array([c for _, c in series], dtype=float)
    velocity = np.diff(counts)
    acceleration = np.diff(velocity)
    recent = acceleration[-window:]
    return float(np.mean(recent))
