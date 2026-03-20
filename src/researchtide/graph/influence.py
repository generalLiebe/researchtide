"""Cross-field influence propagation graph."""

from __future__ import annotations

import logging
from collections import defaultdict

import networkx as nx

from researchtide.models.paper import Paper

logger = logging.getLogger(__name__)


def build_influence_graph(
    papers: list[Paper],
    topic_assignments: dict[str, int],
    topic_labels: dict[int, str] | None = None,
) -> nx.DiGraph:
    """Build a directed influence graph between topics based on citation flow.

    An edge from topic A to topic B means papers in topic A cite papers in topic B.
    Edge weight = number of such cross-topic citations.
    """
    paper_topic = topic_assignments
    paper_by_id: dict[str, Paper] = {p.paper_id: p for p in papers}

    edge_weights: dict[tuple[int, int], int] = defaultdict(int)

    for paper in papers:
        src_topic = paper_topic.get(paper.paper_id)
        if src_topic is None:
            continue

        for ref_id in paper.references:
            ref_topic = paper_topic.get(ref_id)
            if ref_topic is not None and ref_topic != src_topic:
                edge_weights[(src_topic, ref_topic)] += 1

    G = nx.DiGraph()

    # Add all topics as nodes
    all_topics = set(topic_assignments.values())
    for tid in all_topics:
        label = (topic_labels or {}).get(tid, f"Topic_{tid}")
        G.add_node(tid, label=label)

    # Add weighted edges
    for (src, tgt), weight in edge_weights.items():
        G.add_edge(src, tgt, weight=weight)

    logger.info(
        "Influence graph: %d nodes, %d edges",
        G.number_of_nodes(),
        G.number_of_edges(),
    )
    return G
