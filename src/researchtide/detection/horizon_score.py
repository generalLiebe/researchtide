"""Horizon score — composite signal strength for emerging topics.

Combines multiple signals into a single 0-100 score:
- Jerk (acceleration of acceleration): 30%
- Cross-field emergence: 30%
- Novelty (how recently the topic first appeared): 20%
- Citation density change rate: 20%
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class HorizonSignal:
    label: str
    score: float  # 0-100
    alert_level: str  # 'watch' | 'emerging' | 'breakthrough'
    factors: dict[str, float] = field(default_factory=dict)
    cross_fields: list[str] = field(default_factory=list)


def compute_horizon_score(
    label: str,
    monthly_counts: list[tuple[date, int]],
    field_appearances: list[str],
    citation_velocity: float,
    paper_count: int,
    first_appearance: date | None = None,
) -> HorizonSignal:
    """Compute a composite horizon scanning score for a topic.

    Args:
        label: Topic name.
        monthly_counts: Sorted (date, count) pairs.
        field_appearances: Fields where this topic has appeared.
        citation_velocity: Current citation velocity.
        paper_count: Total papers for this topic.
        first_appearance: When this topic first appeared.

    Returns:
        HorizonSignal with score 0-100, alert level, and factor breakdown.
    """
    factors: dict[str, float] = {}

    # 1. Jerk — acceleration of acceleration (30%)
    jerk_score = _compute_jerk_score(monthly_counts)
    factors["jerk"] = round(jerk_score, 1)

    # 2. Cross-field emergence (30%)
    cross_field_score = _compute_cross_field_score(field_appearances)
    factors["cross_field"] = round(cross_field_score, 1)

    # 3. Novelty (20%)
    novelty_score = _compute_novelty_score(monthly_counts, first_appearance)
    factors["novelty"] = round(novelty_score, 1)

    # 4. Citation density change (20%)
    density_score = _compute_density_change_score(monthly_counts, citation_velocity, paper_count)
    factors["citation_density_change"] = round(density_score, 1)

    # Weighted composite
    score = (
        jerk_score * 0.30
        + cross_field_score * 0.30
        + novelty_score * 0.20
        + density_score * 0.20
    )
    score = max(0.0, min(100.0, score))

    # Determine alert level
    if score >= 70:
        alert_level = "breakthrough"
    elif score >= 40:
        alert_level = "emerging"
    else:
        alert_level = "watch"

    return HorizonSignal(
        label=label,
        score=round(score, 1),
        alert_level=alert_level,
        factors=factors,
        cross_fields=field_appearances[1:] if len(field_appearances) > 1 else [],
    )


def _compute_jerk_score(monthly_counts: list[tuple[date, int]]) -> float:
    """Score based on the rate of change of acceleration (jerk).

    High jerk means the topic is accelerating faster and faster.
    """
    if len(monthly_counts) < 4:
        return 0.0

    counts = np.array([c for _, c in monthly_counts], dtype=float)
    velocity = np.diff(counts)
    acceleration = np.diff(velocity)
    jerk = np.diff(acceleration)

    if len(jerk) == 0:
        return 0.0

    # Use recent jerk (last 3 values or fewer)
    recent_jerk = float(np.mean(jerk[-3:]))

    # Normalize: positive jerk → high score, negative → low
    # Scale so that jerk of ~5 maps to ~80
    if recent_jerk <= 0:
        return max(0.0, 10.0 + recent_jerk * 2)

    return min(100.0, recent_jerk * 16.0)


def _compute_cross_field_score(field_appearances: list[str]) -> float:
    """Score based on how many distinct fields this topic appears in.

    1 field = 0, 2 fields = 40, 3 fields = 70, 4+ = 90+
    """
    n = len(set(field_appearances))
    if n <= 1:
        return 0.0
    if n == 2:
        return 40.0
    if n == 3:
        return 70.0
    return min(100.0, 70.0 + (n - 3) * 10.0)


def _compute_novelty_score(
    monthly_counts: list[tuple[date, int]],
    first_appearance: date | None = None,
) -> float:
    """Score based on how recently the topic first appeared.

    Topics that appeared within the last 12 months score highest.
    """
    if first_appearance is None and monthly_counts:
        first_appearance = monthly_counts[0][0]

    if first_appearance is None:
        return 50.0  # unknown → neutral

    months_since = max(0, (date.today() - first_appearance).days / 30.44)

    if months_since <= 3:
        return 100.0
    if months_since <= 6:
        return 80.0
    if months_since <= 12:
        return 60.0
    if months_since <= 24:
        return 30.0
    return 10.0


def _compute_density_change_score(
    monthly_counts: list[tuple[date, int]],
    citation_velocity: float,
    paper_count: int,
) -> float:
    """Score based on the trend of citations-per-paper over time.

    Increasing citation density suggests growing importance.
    """
    if paper_count <= 0 or len(monthly_counts) < 3:
        return 0.0

    # Compare recent half vs older half publication rate
    counts = [c for _, c in monthly_counts]
    mid = len(counts) // 2
    older_avg = np.mean(counts[:mid]) if mid > 0 else 0.0
    recent_avg = np.mean(counts[mid:])

    if older_avg <= 0:
        return min(100.0, recent_avg * 20.0) if recent_avg > 0 else 0.0

    growth_ratio = recent_avg / older_avg

    # growth_ratio 1.0 = flat, 2.0 = doubled → ~70, 3.0+ → ~90+
    if growth_ratio <= 1.0:
        return max(0.0, growth_ratio * 20.0)

    return min(100.0, 20.0 + (growth_ratio - 1.0) * 50.0)
