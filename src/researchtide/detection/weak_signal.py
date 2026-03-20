"""Weak signal detection using anomaly detection on citation velocity."""

from __future__ import annotations

import logging

import numpy as np
from sklearn.ensemble import IsolationForest

from researchtide.models.paper import ResearchStatus, TopicSnapshot

logger = logging.getLogger(__name__)


def detect_weak_signals(
    snapshots: list[TopicSnapshot],
    contamination: float = 0.1,
) -> list[TopicSnapshot]:
    """Identify topics with anomalously high citation velocity.

    Uses Isolation Forest to detect topics whose growth pattern deviates
    from the norm — candidates for Weak Signal or Rising status.
    """
    if len(snapshots) < 5:
        logger.warning("Too few topics (%d) for anomaly detection", len(snapshots))
        return snapshots

    features = np.array(
        [[s.citation_velocity, s.paper_count] for s in snapshots]
    )

    clf = IsolationForest(contamination=contamination, random_state=42)
    labels = clf.fit_predict(features)

    for snapshot, label in zip(snapshots, labels):
        if label == -1:  # anomaly
            if snapshot.citation_velocity > np.median(features[:, 0]):
                snapshot.status = ResearchStatus.RISING
            else:
                snapshot.status = ResearchStatus.WEAK_SIGNAL

    anomaly_count = sum(1 for l in labels if l == -1)
    logger.info("Detected %d anomalous topics out of %d", anomaly_count, len(snapshots))
    return snapshots
