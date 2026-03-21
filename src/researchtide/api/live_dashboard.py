"""Live dashboard pipeline — fetches real data from OpenAlex and generates hubs."""

from __future__ import annotations

import json
import logging
import math
import os
import random
import time
from pathlib import Path

from researchtide.api.schemas import DemoResponse, GraphEdge, Hub, TopicNode
from researchtide.ingestion.openalex import extract_institutions, fetch_works, works_to_papers
from researchtide.analysis.hub_generator import generate_hubs
from researchtide.analysis.citation_velocity import compute_acceleration as _compute_accel
from researchtide.analysis.ethics_lag import compute_ethics_lag

logger = logging.getLogger(__name__)


def build_live_payload(
    email: str = "",
    cache_ttl: int = 21600,
    cache_dir: str = "data",
) -> DemoResponse:
    """Build a live dashboard payload from OpenAlex data.

    1. Check JSON cache (return immediately if within TTL)
    2. Fetch works from OpenAlex
    3. Extract institutions and generate hubs
    4. Build topic graph from OpenAlex concepts
    5. Cache and return DemoResponse

    Args:
        email: Email for OpenAlex polite pool.
        cache_ttl: Cache time-to-live in seconds (default 6 hours).
        cache_dir: Directory for cache files.
    """
    cache_path = Path(cache_dir) / "live_dashboard.json"

    # Check cache
    if cache_ttl > 0 and cache_path.exists():
        try:
            cache_data = json.loads(cache_path.read_text())
            cached_at = cache_data.get("_cached_at", 0)
            if time.time() - cached_at < cache_ttl:
                logger.info("Returning cached live dashboard (age: %.0fs)", time.time() - cached_at)
                cache_data.pop("_cached_at", None)
                return DemoResponse(**cache_data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning("Cache read failed, rebuilding: %s", e)

    # Fetch from OpenAlex
    logger.info("Fetching works from OpenAlex...")
    works = fetch_works(max_results=2000, email=email)
    if not works:
        logger.warning("No works fetched from OpenAlex, falling back to demo data")
        from researchtide.api.demo import build_demo_payload
        return build_demo_payload()

    logger.info("Fetched %d works, extracting institutions...", len(works))
    institutions = extract_institutions(works, email=email)
    papers = works_to_papers(works)

    # Generate hubs
    logger.info("Generating hubs from %d institutions...", len(institutions))
    hubs, hub_paper_map = generate_hubs(institutions, papers)
    logger.info("Generated %d hubs", len(hubs))

    # Build topics from OpenAlex concepts/topics
    topics, edges = _build_topics_from_works(works)

    response = DemoResponse(hubs=hubs, topics=topics, edges=edges)

    # Cache result
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        payload = response.model_dump()
        payload["_cached_at"] = time.time()
        cache_path.write_text(json.dumps(payload, default=str))
        logger.info("Cached live dashboard to %s", cache_path)

        # Cache papers + hub_paper_map separately for /live/papers endpoint
        papers_cache = {
            "papers": [p.model_dump() for p in papers],
            "hub_paper_map": hub_paper_map,
            "_cached_at": time.time(),
        }
        papers_cache_path = Path(cache_dir) / "live_papers.json"
        papers_cache_path.write_text(json.dumps(papers_cache, default=str))
        logger.info("Cached %d papers to %s", len(papers), papers_cache_path)

        # Cache hierarchy tree for drill-down after server restart
        if _hierarchy_tree:
            tree_cache_path = Path(cache_dir) / "live_hierarchy.json"
            tree_cache_path.write_text(json.dumps(_hierarchy_tree, default=str))
            logger.info("Cached hierarchy tree to %s", tree_cache_path)
    except OSError as e:
        logger.warning("Failed to write cache: %s", e)

    return response


def get_cached_papers(
    cache_dir: str = "data",
) -> tuple[list[dict], dict[str, list[str]]]:
    """Load cached papers and hub_paper_map from disk.

    Returns:
        Tuple of (papers as dicts, hub_paper_map).
    """
    cache_path = Path(cache_dir) / "live_papers.json"
    if not cache_path.exists():
        return [], {}
    try:
        data = json.loads(cache_path.read_text())
        papers = data.get("papers", [])
        hub_paper_map = data.get("hub_paper_map", {})
        return papers, hub_paper_map
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to read papers cache: %s", e)
        return [], {}


def append_papers(
    new_papers: list,
    cache_dir: str = "data",
) -> int:
    """Append new papers to the papers cache, deduplicating by DOI/title.

    Args:
        new_papers: List of Paper model instances to add.
        cache_dir: Directory for cache files.

    Returns:
        Number of genuinely new papers added.
    """
    import re

    cache_path = Path(cache_dir) / "live_papers.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Load existing data
    existing_papers: list[dict] = []
    hub_paper_map: dict[str, list[str]] = {}
    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text())
            existing_papers = data.get("papers", [])
            hub_paper_map = data.get("hub_paper_map", {})
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    # Build dedup index from existing papers
    seen_doi: set[str] = set()
    seen_title_author: set[str] = set()
    for p in existing_papers:
        doi = p.get("doi")
        if doi:
            seen_doi.add(doi.lower().strip())
        title = p.get("title", "")
        first_author = (p.get("authors") or [""])[0].lower() if p.get("authors") else ""
        norm_title = re.sub(r"[^a-z0-9]", "", title.lower())
        seen_title_author.add(f"{norm_title}|{first_author}")

    # Filter truly new papers
    added = 0
    for paper in new_papers:
        p_dict = paper.model_dump() if hasattr(paper, "model_dump") else paper

        doi = p_dict.get("doi")
        if doi and doi.lower().strip() in seen_doi:
            continue

        title = p_dict.get("title", "")
        first_author = (p_dict.get("authors") or [""])[0].lower() if p_dict.get("authors") else ""
        norm_title = re.sub(r"[^a-z0-9]", "", title.lower())
        key = f"{norm_title}|{first_author}"
        if key in seen_title_author:
            continue

        existing_papers.append(p_dict)
        if doi:
            seen_doi.add(doi.lower().strip())
        seen_title_author.add(key)
        added += 1

    # Write back
    payload = {
        "papers": existing_papers,
        "hub_paper_map": hub_paper_map,
        "_cached_at": time.time(),
    }
    cache_path.write_text(json.dumps(payload, default=str))
    logger.info("Appended %d papers (total: %d)", added, len(existing_papers))
    return added


# Module-level hierarchy cache
_hierarchy_tree: dict[str, dict] = {}


def _collect_descendant_labels(node: dict) -> set[str]:
    """Recursively collect all descendant labels from a hierarchy node."""
    labels: set[str] = set()
    for name, child in node.get("children", {}).items():
        labels.add(name.lower())
        labels |= _collect_descendant_labels(child)
    return labels


def get_topic_family_labels(topic_label: str) -> set[str]:
    """Return a set of lowercase labels for the topic and all its descendants.

    Searches the hierarchy tree for the given label at any level.
    If the label is a parent node (domain/field/subfield), returns
    all descendant labels so that papers under child topics also match.
    """
    target = topic_label.lower()
    result = {target}

    def _search(tree: dict[str, dict]) -> bool:
        for name, node in tree.items():
            if name.lower() == target:
                result.update(_collect_descendant_labels(node))
                return True
            if _search(node.get("children", {})):
                return True
        return False

    _search(_hierarchy_tree)
    return result


def _layout_nodes(
    positions: list[tuple[float, float]],
    radii: list[float],
    cx: float = 0.5,
    cy: float = 0.48,
    iterations: int = 60,
) -> list[tuple[float, float]]:
    """Apply force-directed repulsion to resolve node overlaps.

    positions: list of (x, y) in normalized [0,1] space
    radii: visual radius of each node (used for overlap detection)
    Returns adjusted positions.
    """
    n = len(positions)
    if n <= 1:
        return list(positions)

    # Convert radii to normalized space (approx: radius/canvas_width)
    # Nodes have radius 6-24; canvas is ~1000px wide → normalize
    norm_radii = [r / 400.0 for r in radii]

    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]

    for _ in range(iterations):
        # Repulsion between overlapping pairs
        for i in range(n):
            for j in range(i + 1, n):
                dx = xs[i] - xs[j]
                dy = ys[i] - ys[j]
                dist = math.sqrt(dx * dx + dy * dy) + 1e-6
                min_dist = (norm_radii[i] + norm_radii[j]) * 1.8
                if dist < min_dist:
                    force = (min_dist - dist) * 0.3
                    fx = (dx / dist) * force
                    fy = (dy / dist) * force
                    xs[i] += fx
                    ys[i] += fy
                    xs[j] -= fx
                    ys[j] -= fy

        # Gentle pull toward center to prevent scattering
        for i in range(n):
            xs[i] += (cx - xs[i]) * 0.01
            ys[i] += (cy - ys[i]) * 0.01

        # Clamp to bounds
        for i in range(n):
            xs[i] = max(0.05, min(0.95, xs[i]))
            ys[i] = max(0.08, min(0.92, ys[i]))

    return [(xs[i], ys[i]) for i in range(n)]


def _apply_weak_signal_detection(topics: list[TopicNode]) -> None:
    """Apply weak signal detection to update topic statuses in-place.

    Tries IsolationForest via detect_weak_signals(); falls back to
    percentile-based heuristic if sklearn is unavailable.
    """
    if len(topics) < 5:
        return

    try:
        from researchtide.models.paper import TopicSnapshot, ResearchStatus
        from researchtide.detection.weak_signal import detect_weak_signals

        snapshots = [
            TopicSnapshot(
                topic_id=t.id,
                label=t.label,
                paper_count=int(t.radius),  # proxy for paper count
                citation_velocity=t.citationVelocity,
            )
            for t in topics
        ]
        detected = detect_weak_signals(snapshots)

        status_map = {
            ResearchStatus.WEAK_SIGNAL: "weak",
            ResearchStatus.RISING: "rising",
        }
        for snap, topic in zip(detected, topics):
            mapped = status_map.get(snap.status)
            if mapped:
                topic.status = mapped  # type: ignore[assignment]
    except Exception as e:
        logger.warning("IsolationForest weak signal detection failed, using fallback: %s", e)
        # Percentile-based fallback
        import numpy as np
        cvs = [t.citationVelocity for t in topics]
        if not any(cv > 0 for cv in cvs):
            return
        median_cv = float(np.median(cvs))
        p90_cv = float(np.percentile(cvs, 90))
        for t in topics:
            if t.citationVelocity >= p90_cv and t.acceleration > 0:
                t.status = "rising"  # type: ignore[assignment]
            elif t.citationVelocity > median_cv and t.acceleration > 0 and t.status not in ("mainstream", "rising"):
                t.status = "weak"  # type: ignore[assignment]


def _build_topics_from_works(works: list[dict]) -> tuple[list[TopicNode], list[GraphEdge]]:
    """Extract topic nodes and edges from OpenAlex work concepts/topics.

    Also builds a 4-level hierarchy tree (domain→field→subfield→topic)
    and stores it in _hierarchy_tree for the children endpoint.
    """
    global _hierarchy_tree
    from collections import Counter

    # Count concept occurrences and co-occurrences
    concept_counts: Counter[str] = Counter()
    concept_pairs: Counter[tuple[str, str]] = Counter()
    concept_years: dict[str, list[int]] = {}
    # Track citations and monthly publication counts for CV/acceleration
    concept_citations: dict[str, int] = {}  # label → total citations
    concept_monthly: dict[str, Counter[str]] = {}  # label → {YYYY-MM: count}
    concept_works: dict[str, list[dict]] = {}  # label → [work dicts] for ethics lag

    # Build hierarchy tree: { label: { level, parent, children: {label: ...}, work_count, years } }
    hierarchy: dict[str, dict] = {}

    for work in works:
        work_concepts: list[str] = []

        # Extract from primary_topic — all 4 levels
        pt = work.get("primary_topic") or {}
        domain_name = (pt.get("domain") or {}).get("display_name")
        field_name = (pt.get("field") or {}).get("display_name")
        subfield_name = (pt.get("subfield") or {}).get("display_name")
        topic_name = pt.get("display_name")

        # Build hierarchy tree from this work
        if domain_name:
            if domain_name not in hierarchy:
                hierarchy[domain_name] = {"level": "domain", "parent": None, "children": {}, "work_count": 0, "years": []}
            hierarchy[domain_name]["work_count"] += 1
            if work.get("publication_year"):
                hierarchy[domain_name]["years"].append(work["publication_year"])

            if field_name:
                children = hierarchy[domain_name]["children"]
                if field_name not in children:
                    children[field_name] = {"level": "field", "parent": domain_name, "children": {}, "work_count": 0, "years": []}
                children[field_name]["work_count"] += 1
                if work.get("publication_year"):
                    children[field_name]["years"].append(work["publication_year"])

                if subfield_name:
                    sub_children = children[field_name]["children"]
                    if subfield_name not in sub_children:
                        sub_children[subfield_name] = {"level": "subfield", "parent": field_name, "children": {}, "work_count": 0, "years": []}
                    sub_children[subfield_name]["work_count"] += 1
                    if work.get("publication_year"):
                        sub_children[subfield_name]["years"].append(work["publication_year"])

                    if topic_name:
                        leaf_children = sub_children[subfield_name]["children"]
                        if topic_name not in leaf_children:
                            leaf_children[topic_name] = {"level": "topic", "parent": subfield_name, "children": {}, "work_count": 0, "years": []}
                        leaf_children[topic_name]["work_count"] += 1
                        if work.get("publication_year"):
                            leaf_children[topic_name]["years"].append(work["publication_year"])

        # Flat concept extraction (existing logic)
        if topic_name:
            work_concepts.append(topic_name)
        if subfield_name and subfield_name not in work_concepts:
            work_concepts.append(subfield_name)

        # Extract from topics list
        for t in work.get("topics", [])[:3]:
            name = t.get("display_name", "")
            if name and name not in work_concepts:
                work_concepts.append(name)

        pub_year = work.get("publication_year")
        cite_count = work.get("cited_by_count", 0) or 0
        pub_date = work.get("publication_date", "")
        month_key = pub_date[:7] if pub_date and len(pub_date) >= 7 else ""
        for c in work_concepts:
            concept_counts[c] += 1
            if pub_year:
                concept_years.setdefault(c, []).append(pub_year)
            concept_citations[c] = concept_citations.get(c, 0) + cite_count
            concept_works.setdefault(c, []).append(work)
            if month_key:
                if c not in concept_monthly:
                    concept_monthly[c] = Counter()
                concept_monthly[c][month_key] += 1

        # Track co-occurrences for edges
        for i, c1 in enumerate(work_concepts):
            for c2 in work_concepts[i + 1:]:
                pair = tuple(sorted([c1, c2]))
                concept_pairs[pair] += 1  # type: ignore[arg-type]

    _hierarchy_tree = hierarchy

    # Build a label→level lookup from hierarchy
    label_info: dict[str, dict] = {}
    for d_name, d_node in hierarchy.items():
        label_info[d_name] = {"level": "domain", "parent": None, "child_count": len(d_node["children"])}
        for f_name, f_node in d_node["children"].items():
            label_info[f_name] = {"level": "field", "parent": d_name, "child_count": len(f_node["children"])}
            for s_name, s_node in f_node["children"].items():
                label_info[s_name] = {"level": "subfield", "parent": f_name, "child_count": len(s_node["children"])}
                for t_name, t_node in s_node["children"].items():
                    label_info[t_name] = {"level": "topic", "parent": s_name, "child_count": len(t_node["children"])}

    # Select top concepts as topics
    top_concepts = concept_counts.most_common(22)
    if not top_concepts:
        return [], []

    concept_to_idx = {name: idx for idx, (name, _) in enumerate(top_concepts)}
    max_count = top_concepts[0][1] if top_concepts else 1

    rng = random.Random(42)
    cx, cy = 0.50, 0.48
    n = len(top_concepts)
    ring_map = {"mainstream": 0.12, "rising": 0.22, "weak": 0.32, "displaced": 0.40}

    # First pass: compute metadata + initial ring positions
    node_data: list[dict] = []
    init_positions: list[tuple[float, float]] = []
    node_radii: list[float] = []

    for idx, (label, count) in enumerate(top_concepts):
        ratio = count / max_count
        years = concept_years.get(label, [])
        recent_count = sum(1 for y in years if y >= 2024)
        older_count = sum(1 for y in years if y < 2024)
        growth_signal = (recent_count / max(older_count, 1)) * 50

        if ratio > 0.6:
            status = "mainstream"
        elif ratio > 0.3 or growth_signal > 60:
            status = "rising"
        elif ratio > 0.1:
            status = "weak"
        else:
            status = "displaced"

        ring_r = ring_map.get(status, 0.30) + rng.random() * 0.05
        angle = (2 * math.pi * idx) / n + rng.random() * 0.3
        x = cx + ring_r * math.cos(angle)
        y = cy + ring_r * math.sin(angle)

        radius = 6.0 + ratio * 18.0
        # Scale down radius when many nodes
        radius *= min(1.0, 20.0 / max(n, 1))

        influences: list[str] = []
        influenced_by: list[str] = []
        for (c1, c2), co_count in concept_pairs.most_common(100):
            if co_count < 3:
                break
            if c1 == label and c2 in concept_to_idx:
                influences.append(c2)
            elif c2 == label and c1 in concept_to_idx:
                influenced_by.append(c1)

        info = label_info.get(label, {})

        # Compute citation velocity and acceleration
        total_cites = concept_citations.get(label, 0)
        monthly_data = concept_monthly.get(label, Counter())
        if monthly_data:
            sorted_months = sorted(monthly_data.keys())
            months_span = max(len(sorted_months), 1)
            cv = total_cites / months_span
            # Build series for compute_acceleration: [(date, count), ...]
            from datetime import date as _date
            series = [(_date.fromisoformat(f"{m}-01"), monthly_data[m]) for m in sorted_months]
            accel = _compute_accel(series)
        else:
            cv = 0.0
            accel = 0.0

        node_data.append({
            "idx": idx, "label": label, "status": status, "ratio": ratio,
            "radius": radius, "growth_signal": growth_signal,
            "ethic_lag": compute_ethics_lag(concept_works.get(label, [])),
            "social": ratio * 80 + rng.uniform(-5, 5),
            "influences": influences[:5], "influenced_by": influenced_by[:5],
            "info": info,
            "citation_velocity": cv,
            "acceleration": accel,
        })
        init_positions.append((x, y))
        node_radii.append(radius)

    # Force-directed overlap resolution
    adjusted = _layout_nodes(init_positions, node_radii, cx, cy)

    # Second pass: create TopicNode objects with adjusted positions
    topics: list[TopicNode] = []
    for i, nd in enumerate(node_data):
        ax, ay = adjusted[i]
        topics.append(TopicNode(
            id=nd["idx"],
            label=nd["label"],
            status=nd["status"],  # type: ignore[arg-type]
            x=float(ax),
            y=float(ay),
            radius=float(nd["radius"]),
            growth=float(max(0, min(100, nd["growth_signal"] + rng.uniform(-3, 3)))),
            ethicLag=float(nd["ethic_lag"]),
            socialPenetration=float(max(0, min(100, nd["social"]))),
            influences=nd["influences"],
            influencedBy=nd["influenced_by"],
            citationVelocity=float(nd["citation_velocity"]),
            acceleration=float(nd["acceleration"]),
            hierarchyLevel=nd["info"].get("level"),
            parentLabel=nd["info"].get("parent"),
            childCount=nd["info"].get("child_count", 0),
        ))

    # Weak signal detection — update statuses based on anomaly detection
    _apply_weak_signal_detection(topics)

    # Build edges from co-occurrences
    edges: list[GraphEdge] = []
    for (c1, c2), co_count in concept_pairs.most_common(50):
        if c1 in concept_to_idx and c2 in concept_to_idx and co_count >= 3:
            weight = min(1.0, co_count / max_count)
            edges.append(GraphEdge(
                source=concept_to_idx[c1],
                target=concept_to_idx[c2],
                weight=weight,
            ))

    return topics, edges


def get_horizon_data(papers_raw: list[dict]) -> list[dict]:
    """Compute horizon scanning alerts from raw paper data.

    Combines cross-field emergence detection with horizon scoring
    to produce ranked alerts.

    Returns:
        List of alert dicts sorted by score (descending), top 20.
    """
    from collections import Counter
    from datetime import date as _date

    from researchtide.detection.horizon_score import compute_horizon_score

    # Rebuild minimal works from papers_raw for cross-field detection
    # papers_raw may not have primary_topic — use categories as proxy
    # But we can also use the cached works if available
    # For now, build topic data from papers_raw categories
    topic_monthly: dict[str, dict[str, int]] = {}
    topic_citations: dict[str, float] = {}
    topic_paper_count: dict[str, int] = Counter()
    for p in papers_raw:
        cats = p.get("categories", [])
        pub = p.get("published")
        cites = p.get("citation_count") or 0

        if not pub:
            continue
        try:
            pub_date = _date.fromisoformat(str(pub)[:10])
        except ValueError:
            continue

        month_key = pub_date.strftime("%Y-%m")

        for cat in cats:
            topic_paper_count[cat] += 1
            topic_citations[cat] = topic_citations.get(cat, 0.0) + cites

            if cat not in topic_monthly:
                topic_monthly[cat] = {}
            topic_monthly[cat][month_key] = topic_monthly[cat].get(month_key, 0) + 1

    # Convert monthly dicts to sorted lists
    topic_monthly_sorted: dict[str, list[tuple[_date, int]]] = {}
    for cat, monthly in topic_monthly.items():
        sorted_items = sorted(monthly.items())
        topic_monthly_sorted[cat] = [
            (_date.fromisoformat(f"{m}-01"), c) for m, c in sorted_items
        ]

    # Cross-field detection from hierarchy data
    cross_field_map: dict[str, list[str]] = {}
    if _hierarchy_tree:
        # Build topic → fields mapping from hierarchy
        for d_name, d_node in _hierarchy_tree.items():
            for f_name, f_node in d_node.get("children", {}).items():
                for s_name, s_node in f_node.get("children", {}).items():
                    for t_name in s_node.get("children", {}).keys():
                        cross_field_map.setdefault(t_name, []).append(f_name)
                    cross_field_map.setdefault(s_name, []).append(f_name)

    # Compute horizon scores for all topics with enough data
    alerts: list[dict] = []
    for cat in topic_paper_count:
        monthly = topic_monthly_sorted.get(cat, [])
        if len(monthly) < 2:
            continue

        pc = topic_paper_count[cat]
        cv = topic_citations.get(cat, 0.0) / max(pc, 1)
        fields = list(set(cross_field_map.get(cat, [])))

        signal = compute_horizon_score(
            label=cat,
            monthly_counts=monthly,
            field_appearances=fields,
            citation_velocity=cv,
            paper_count=pc,
        )

        alerts.append({
            "topic": signal.label,
            "score": signal.score,
            "alert_level": signal.alert_level,
            "factors": signal.factors,
            "cross_fields": signal.cross_fields,
        })

    alerts.sort(key=lambda a: a["score"], reverse=True)
    return alerts[:20]


def get_topic_children(parent_label: str, parent_level: str) -> tuple[list[TopicNode], list[GraphEdge]]:
    """Return child topics for a given parent from the hierarchy cache."""
    global _hierarchy_tree
    from collections import Counter

    # Rebuild hierarchy if empty (e.g. after server restart with cached JSON)
    if not _hierarchy_tree:
        tree_cache_path = Path("data") / "live_hierarchy.json"
        if tree_cache_path.exists():
            try:
                _hierarchy_tree = json.loads(tree_cache_path.read_text())
                logger.info("Loaded hierarchy tree from cache (%d domains)", len(_hierarchy_tree))
            except Exception as e:
                logger.warning("Failed to load hierarchy cache: %s", e)

    # Find the parent node in the hierarchy tree
    children_dict: dict[str, dict] | None = None

    if parent_level == "domain":
        node = _hierarchy_tree.get(parent_label)
        if node:
            children_dict = node["children"]
    elif parent_level == "field":
        for d_node in _hierarchy_tree.values():
            if parent_label in d_node["children"]:
                children_dict = d_node["children"][parent_label]["children"]
                break
    elif parent_level == "subfield":
        for d_node in _hierarchy_tree.values():
            for f_node in d_node["children"].values():
                if parent_label in f_node["children"]:
                    children_dict = f_node["children"][parent_label]["children"]
                    break
            if children_dict is not None:
                break

    if not children_dict:
        return [], []

    # Build TopicNode list from children with concentric ring layout
    items = sorted(children_dict.items(), key=lambda x: x[1]["work_count"], reverse=True)
    if not items:
        return [], []

    max_count = items[0][1]["work_count"]
    rng = random.Random(42)
    cx, cy = 0.50, 0.48
    n = len(items)

    concept_to_idx: dict[str, int] = {}
    ring_map = {"mainstream": 0.12, "rising": 0.22, "weak": 0.32, "displaced": 0.40}
    level_map = {"domain": "field", "field": "subfield", "subfield": "topic", "topic": "topic"}
    child_level = level_map.get(parent_level, "topic")

    # First pass: compute metadata + initial positions
    child_data: list[dict] = []
    init_positions: list[tuple[float, float]] = []
    node_radii: list[float] = []

    for idx, (label, node) in enumerate(items):
        concept_to_idx[label] = idx
        count = node["work_count"]
        ratio = count / max(max_count, 1)

        years = node.get("years", [])
        recent_count = sum(1 for y in years if y >= 2024)
        older_count = sum(1 for y in years if y < 2024)
        growth_signal = (recent_count / max(older_count, 1)) * 50

        if ratio > 0.6:
            status = "mainstream"
        elif ratio > 0.3 or growth_signal > 60:
            status = "rising"
        elif ratio > 0.1:
            status = "weak"
        else:
            status = "displaced"

        ring_r = ring_map.get(status, 0.30) + rng.random() * 0.05
        angle = (2 * math.pi * idx) / max(n, 1) + rng.random() * 0.3
        x = cx + ring_r * math.cos(angle)
        y = cy + ring_r * math.sin(angle)

        radius = 6.0 + ratio * 18.0
        radius *= min(1.0, 20.0 / max(n, 1))

        child_data.append({
            "idx": idx, "label": label, "status": status, "ratio": ratio,
            "radius": radius, "growth_signal": growth_signal,
            "child_count": len(node.get("children", {})),
        })
        init_positions.append((x, y))
        node_radii.append(radius)

    # Force-directed overlap resolution
    adjusted = _layout_nodes(init_positions, node_radii, cx, cy)

    # Second pass: create TopicNode objects
    topics: list[TopicNode] = []
    for i, cd in enumerate(child_data):
        ax, ay = adjusted[i]
        topics.append(TopicNode(
            id=cd["idx"],
            label=cd["label"],
            status=cd["status"],  # type: ignore[arg-type]
            x=float(ax),
            y=float(ay),
            radius=float(cd["radius"]),
            growth=float(max(0, min(100, cd["growth_signal"] + rng.uniform(-3, 3)))),
            ethicLag=0.0,  # Works data not available at child level
            socialPenetration=float(max(0, min(100, cd["ratio"] * 80 + rng.uniform(-5, 5)))),
            influences=[],
            influencedBy=[],
            hierarchyLevel=child_level,
            parentLabel=parent_label,
            childCount=cd["child_count"],
        ))

    # Build edges from sibling co-occurrence (simple: connect items with shared parent)
    edges: list[GraphEdge] = []
    child_labels = list(concept_to_idx.keys())
    for i in range(len(child_labels)):
        for j in range(i + 1, min(len(child_labels), i + 4)):
            edges.append(GraphEdge(
                source=concept_to_idx[child_labels[i]],
                target=concept_to_idx[child_labels[j]],
                weight=0.3,
            ))

    return topics, edges
