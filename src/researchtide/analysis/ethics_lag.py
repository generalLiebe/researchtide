"""Ethics Lag computation — measures the delay between tech breakthroughs and ethics research."""

from __future__ import annotations

import logging
from datetime import date

import numpy as np

logger = logging.getLogger(__name__)

ETHICS_KEYWORDS = frozenset({
    "ethics", "ethical", "fairness", "bias", "safety",
    "regulation", "policy", "governance", "accountability",
    "transparency", "privacy", "consent", "responsible",
    "trustworthy", "explainability", "interpretability",
    "discrimination", "surveillance", "audit", "compliance",
})

# High default when no ethics papers are found (signals data gap)
_DEFAULT_LAG = 18.0


def _is_ethics_work(work: dict) -> bool:
    """Check if a work relates to ethics/safety/regulation.

    Checks title words and abstract inverted index keys for keyword overlap.
    """
    # Check title
    title = (work.get("title") or "").lower()
    title_words = set(title.split())
    if title_words & ETHICS_KEYWORDS:
        return True

    # Check abstract inverted index keys (OpenAlex format)
    abstract_inv = work.get("abstract_inverted_index")
    if abstract_inv and isinstance(abstract_inv, dict):
        abstract_words = {k.lower() for k in abstract_inv.keys()}
        if abstract_words & ETHICS_KEYWORDS:
            return True

    return False


def compute_ethics_lag(works: list[dict]) -> float:
    """Compute ethics lag in months for a set of works.

    Splits works into "tech papers" and "ethics papers" by keyword matching,
    then compares the median publication dates.

    Returns:
        Lag in months (ethics_median - tech_median).
        Returns _DEFAULT_LAG (18.0) if no ethics papers found.
        Returns 0.0 if ethics papers precede tech papers.
    """
    tech_dates: list[date] = []
    ethics_dates: list[date] = []

    for w in works:
        pub_str = w.get("publication_date")
        if not pub_str:
            continue
        try:
            pub_date = date.fromisoformat(str(pub_str)[:10])
        except ValueError:
            continue

        if _is_ethics_work(w):
            ethics_dates.append(pub_date)
        else:
            tech_dates.append(pub_date)

    if not tech_dates:
        return 0.0

    if not ethics_dates:
        return _DEFAULT_LAG

    tech_ordinals = np.array([d.toordinal() for d in tech_dates])
    ethics_ordinals = np.array([d.toordinal() for d in ethics_dates])

    tech_median = float(np.median(tech_ordinals))
    ethics_median = float(np.median(ethics_ordinals))

    lag_days = ethics_median - tech_median
    lag_months = lag_days / 30.44

    # If ethics research precedes tech, lag is 0 (no delay)
    return max(0.0, lag_months)
