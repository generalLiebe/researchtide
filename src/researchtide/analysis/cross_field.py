"""Cross-field emergence detection.

Detects when a topic that originated in one field starts appearing
in works belonging to other fields — a strong horizon scanning signal.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class CrossFieldEvent:
    topic: str           # e.g. "Diffusion Models"
    origin_field: str    # e.g. "Computer Vision"
    new_fields: list[str] = field(default_factory=list)  # e.g. ["Biology", "Chemistry"]
    first_seen: str = ""  # e.g. "2026-01"
    momentum: float = 0.0  # acceleration of cross-field appearances


def detect_cross_field_emergence(
    works: list[dict],
    lookback_months: int = 6,
) -> list[CrossFieldEvent]:
    """Detect topics appearing across multiple fields.

    Scans works for leaf topics (from primary_topic) and tracks which
    field each topic originally belonged to vs. where it now appears.

    Args:
        works: Raw OpenAlex work dicts.
        lookback_months: How far back to consider for "recent" emergence.

    Returns:
        List of CrossFieldEvent sorted by number of new fields (descending).
    """
    # Map each topic to its fields and publication dates
    topic_fields: dict[str, Counter[str]] = defaultdict(Counter)
    topic_first_field: dict[str, str] = {}
    topic_monthly: dict[str, Counter[str]] = defaultdict(Counter)  # topic -> {YYYY-MM: count}

    for work in works:
        pt = work.get("primary_topic") or {}
        topic_name = pt.get("display_name")
        field_info = pt.get("field") or {}
        field_name = field_info.get("display_name")

        if not topic_name or not field_name:
            continue

        topic_fields[topic_name][field_name] += 1

        # Track the "origin" field = the field where topic appeared most
        # (we'll finalize after scanning all works)

        pub_date = work.get("publication_date", "")
        month_key = pub_date[:7] if pub_date and len(pub_date) >= 7 else ""
        if month_key:
            topic_monthly[topic_name][month_key] += 1

    # Determine origin field for each topic (field with most occurrences)
    for topic, field_counts in topic_fields.items():
        origin = field_counts.most_common(1)[0][0]
        topic_first_field[topic] = origin

    # Build cross-field events
    events: list[CrossFieldEvent] = []
    for topic, field_counts in topic_fields.items():
        if len(field_counts) < 2:
            continue

        origin = topic_first_field[topic]
        new_fields = [f for f in field_counts if f != origin]

        if not new_fields:
            continue

        # Find first month topic appeared in a non-origin field
        # (approximate: earliest month overall)
        months = sorted(topic_monthly.get(topic, {}).keys())
        first_seen = months[0] if months else ""

        # Compute momentum: recent cross-field count vs older
        recent_count = 0
        older_count = 0
        if months:
            cutoff_idx = max(0, len(months) - lookback_months)
            recent_months = set(months[cutoff_idx:])
            for m, c in topic_monthly[topic].items():
                if m in recent_months:
                    recent_count += c
                else:
                    older_count += c

        momentum = (recent_count / max(older_count, 1)) - 1.0

        events.append(CrossFieldEvent(
            topic=topic,
            origin_field=origin,
            new_fields=sorted(new_fields),
            first_seen=first_seen,
            momentum=round(momentum, 2),
        ))

    events.sort(key=lambda e: len(e.new_fields), reverse=True)
    return events
