"""Topic extraction and tracking using BERTopic."""

from __future__ import annotations

import logging
from datetime import date

from researchtide.models.paper import Paper, TopicSnapshot

logger = logging.getLogger(__name__)


def extract_topics(
    papers: list[Paper],
    min_topic_size: int = 10,
) -> tuple[object, list[TopicSnapshot]]:
    """Run BERTopic on paper abstracts and return topic snapshots.

    Returns:
        (bertopic_model, list of TopicSnapshot)
    """
    from bertopic import BERTopic

    docs = [p.abstract for p in papers if p.abstract]
    if not docs:
        logger.warning("No abstracts to process")
        return None, []

    model = BERTopic(min_topic_size=min_topic_size, verbose=True)
    topics, _probs = model.fit_transform(docs)

    topic_info = model.get_topic_info()
    snapshots: list[TopicSnapshot] = []

    for _, row in topic_info.iterrows():
        tid = row["Topic"]
        if tid == -1:  # outlier topic
            continue

        keywords = [w for w, _ in model.get_topic(tid)]
        snapshot = TopicSnapshot(
            topic_id=tid,
            label=row.get("Name", f"Topic_{tid}"),
            keywords=keywords[:10],
            paper_count=row["Count"],
            timestamp=date.today(),
        )
        snapshots.append(snapshot)

    logger.info("Extracted %d topics from %d papers", len(snapshots), len(docs))
    return model, snapshots


def compute_citation_velocity(
    papers: list[Paper],
    topic_assignments: dict[str, int],
    window_months: int = 6,
) -> dict[int, float]:
    """Compute citation velocity per topic (citations/month in rolling window).

    Args:
        papers: Papers with citation_count populated.
        topic_assignments: Mapping of paper_id -> topic_id.
        window_months: Rolling window size in months.

    Returns:
        Mapping of topic_id -> citation velocity.
    """
    from collections import defaultdict

    topic_citations: dict[int, list[int]] = defaultdict(list)

    for paper in papers:
        tid = topic_assignments.get(paper.paper_id)
        if tid is not None and paper.citation_count is not None:
            topic_citations[tid].append(paper.citation_count)

    velocities: dict[int, float] = {}
    for tid, counts in topic_citations.items():
        total = sum(counts)
        velocities[tid] = total / max(window_months, 1)

    return velocities
