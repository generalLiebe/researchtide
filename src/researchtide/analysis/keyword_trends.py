"""Keyword-level trend analysis.

Extracts fine-grained technical terms from paper abstracts using
embedding-based keyphrase extraction (KeyBERT-style), then computes
per-keyword metrics: monthly frequency, velocity, acceleration,
horizon score, and forecast.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from researchtide.analysis.citation_velocity import compute_acceleration
from researchtide.analysis.forecasting import ForecastPoint, forecast_series
from researchtide.detection.horizon_score import compute_horizon_score

logger = logging.getLogger(__name__)

# Boilerplate phrases that are semantically close to any research abstract
# but carry zero information about the specific research topic.
# These are PHRASE-level stops (not single words) — kept deliberately tight.
_STOP_PHRASES = frozenset({
    # Meta-academic boilerplate
    "recent advancements", "recent advances", "recent developments",
    "recent years", "recent studies", "recent research", "recent work",
    "future research", "future directions", "future work", "future studies",
    "great potential", "significant impact", "growing interest",
    "wide range", "various applications", "real world",
    "state art", "state the art",
    "comprehensive review", "comprehensive survey", "comprehensive analysis",
    "systematic review", "literature review",
    "proposed method", "proposed approach", "proposed model", "proposed framework",
    "experimental results", "numerical results", "simulation results",
    "results show", "results demonstrate", "results indicate",
    "paper proposes", "paper presents", "paper introduces",
    "existing methods", "existing approaches", "previous studies",
    "main contributions", "key contributions",
    "performance improvement", "significant improvement",
    "novel approach", "novel method", "novel framework",
    # Umbrella categories too broad to be actionable
    "artificial intelligence", "machine learning", "deep learning",
    "neural network", "neural networks",
    "deep neural", "artificial neural",
    "large language", "large language model", "large language models",
    "language model", "language models",
    "natural language", "computer vision", "data driven",
    "data analysis", "big data", "data science",
    "decision making", "problem solving",
    "transfer learning", "supervised learning", "unsupervised learning",
    "feature extraction", "model performance",
    "training data", "training process",
    "research community", "research field", "research area",
    "high performance", "high quality", "high accuracy",
    # Partial umbrella fragments
    "generative artificial", "convolutional neural",
    "recurrent neural", "artificial neural network",
    "artificial neural networks", "deep neural network",
    "deep neural networks",
    # Generic filler phrases
    "widely used", "new insights",
})

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Lazy-load sentence-transformers model (same as BERTopic uses)."""
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _mmr_select(
    doc_embedding: np.ndarray,
    candidate_embeddings: np.ndarray,
    candidates: list[str],
    similarities: np.ndarray,
    top_k: int = 5,
    diversity: float = 0.5,
) -> list[str]:
    """Select diverse, relevant keyphrases using Maximal Marginal Relevance."""
    selected_indices: list[int] = []
    candidate_indices = list(range(len(candidates)))

    for _ in range(min(top_k, len(candidates))):
        if not candidate_indices:
            break

        if not selected_indices:
            # First: pick most similar to document
            best = max(candidate_indices, key=lambda i: similarities[i])
        else:
            # MMR: balance relevance and diversity
            best = None
            best_score = -float("inf")
            sel_embs = candidate_embeddings[selected_indices]

            for idx in candidate_indices:
                relevance = similarities[idx]
                redundancy = float(
                    cosine_similarity(
                        [candidate_embeddings[idx]], sel_embs
                    )[0].max()
                )
                mmr = (1 - diversity) * relevance - diversity * redundancy
                if mmr > best_score:
                    best_score = mmr
                    best = idx

        if best is not None:
            selected_indices.append(best)
            candidate_indices.remove(best)

    return [candidates[i] for i in selected_indices]


def _extract_keyphrases_embedding(
    docs: list[str],
    top_k_per_doc: int = 5,
    top_n_global: int = 300,
) -> list[str]:
    """KeyBERT-style keyphrase extraction using document embeddings.

    For each document, extracts candidate 2-3 word n-grams, embeds them,
    computes cosine similarity to the document embedding, and selects
    the top keyphrases using MMR for diversity. Aggregates across all
    documents and returns phrases ranked by document frequency.
    """
    if len(docs) < 3:
        return []

    model = _get_model()

    # 1. Embed all documents
    logger.info("Embedding %d documents...", len(docs))
    doc_embeddings = model.encode(docs, show_progress_bar=False, batch_size=64)

    # 2. Extract candidate n-grams across the whole corpus at once
    logger.info("Extracting candidate n-grams from corpus...")
    corpus_cv = CountVectorizer(
        ngram_range=(2, 3),
        stop_words="english",
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{1,}[a-zA-Z]\b",
        min_df=3,       # appear in at least 3 docs — filters out noise
        max_df=0.3,     # skip very common phrases
    )
    try:
        dtm = corpus_cv.fit_transform(docs)
    except ValueError:
        logger.warning("CountVectorizer failed (too few valid documents)")
        return []

    all_features = list(corpus_cv.get_feature_names_out())

    # Filter: skip n-grams with any word shorter than 3 chars
    # and skip boilerplate / umbrella-category phrases
    keep_mask = [
        all(len(w) >= 3 for w in feat.split())
        and feat not in _STOP_PHRASES
        for feat in all_features
    ]
    kept_indices = [i for i, keep in enumerate(keep_mask) if keep]
    all_unique = [all_features[i] for i in kept_indices]

    if not all_unique:
        return []

    # Build per-document candidate lists from the sparse DTM
    dtm_filtered = dtm[:, kept_indices]
    doc_candidates: list[list[str]] = []
    for row_idx in range(dtm_filtered.shape[0]):
        row = dtm_filtered[row_idx]
        nonzero = row.nonzero()[1]
        doc_candidates.append([all_unique[j] for j in nonzero])

    logger.info("Embedding %d unique candidate phrases (filtered from corpus)...", len(all_unique))
    phrase_to_idx = {p: i for i, p in enumerate(all_unique)}
    all_candidate_embeddings = model.encode(
        all_unique, show_progress_bar=False, batch_size=256,
    )

    # 4. For each document, score its candidates and select via MMR
    global_counts: Counter[str] = Counter()

    for i, candidates in enumerate(doc_candidates):
        if not candidates:
            continue

        # Gather pre-computed embeddings for this doc's candidates
        indices = [phrase_to_idx[c] for c in candidates]
        cand_embs = all_candidate_embeddings[indices]

        # Cosine similarity: doc embedding vs candidate embeddings
        sims = cosine_similarity([doc_embeddings[i]], cand_embs)[0]

        # MMR selection for diversity
        selected = _mmr_select(
            doc_embedding=doc_embeddings[i],
            candidate_embeddings=cand_embs,
            candidates=candidates,
            similarities=sims,
            top_k=top_k_per_doc,
            diversity=0.5,
        )

        for phrase in selected:
            global_counts[phrase] += 1

    # Deduplicate near-duplicates before returning
    ranked = [phrase for phrase, _ in global_counts.most_common(top_n_global * 2)]
    deduped: list[str] = []
    seen_stems: set[str] = set()

    for phrase in ranked:
        if len(deduped) >= top_n_global:
            break
        # Normalize: strip trailing 's' for plural dedup
        stem = re.sub(r"s$", "", phrase.lower())
        if stem in seen_stems:
            continue
        # Skip if a longer phrase already contains this one (or vice versa)
        is_substr = False
        for existing in deduped:
            if stem in existing.lower() or existing.lower() in stem:
                is_substr = True
                break
        if is_substr:
            continue
        seen_stems.add(stem)
        deduped.append(phrase)

    return deduped


@dataclass
class KeywordMetric:
    keyword: str
    total_count: int
    monthly: list[tuple[date, int]]
    velocity: float
    acceleration: float
    horizon_score: float
    horizon_alert_level: str
    horizon_factors: dict[str, float] = field(default_factory=dict)
    forecast: list[ForecastPoint] = field(default_factory=list)
    is_emerging: bool = False
    fields: list[str] = field(default_factory=list)
    paper_count: int = 0
    first_seen: str = ""
    last_seen: str = ""


def build_keyword_metrics(
    papers_raw: list[dict],
    top_n: int = 100,
) -> list[KeywordMetric]:
    """Build keyword-level trend metrics from paper abstracts.

    Extracts fine-grained technical terms (e.g. "chain of thought",
    "diffusion model", "graph neural network") using embedding-based
    keyphrase extraction, then computes trend metrics for each.

    Args:
        papers_raw: List of paper dicts (from cache).
        top_n: Number of top keywords to return.

    Returns:
        Sorted list of KeywordMetric (by horizon_score descending).
    """
    # Build document list from abstracts
    valid_papers: list[dict] = []
    docs: list[str] = []
    for p in papers_raw:
        abstract = p.get("abstract", "").strip()
        title = p.get("title", "").strip()
        if not abstract or len(abstract) < 50:
            continue
        # Combine title + abstract for richer term extraction
        docs.append(f"{title}. {abstract}")
        valid_papers.append(p)

    if len(docs) < 10:
        logger.warning("Too few abstracts (%d) for keyword extraction", len(docs))
        return []

    # Extract technical terms via embedding-based keyphrase extraction
    logger.info(
        "Extracting keywords from %d abstracts via embedding-based extraction...",
        len(docs),
    )
    terms = _extract_keyphrases_embedding(docs, top_n_global=top_n * 3)
    if not terms:
        return []

    logger.info("Extracted %d candidate terms, building metrics...", len(terms))

    # For each term, scan papers for occurrences and build stats
    term_set = set(t.lower() for t in terms)
    term_canonical: dict[str, str] = {t.lower(): t for t in terms}

    kw_monthly: dict[str, dict[str, int]] = {}
    kw_citations: dict[str, int] = {}
    kw_fields: dict[str, set[str]] = {}
    kw_paper_ids: dict[str, set[str]] = {}
    kw_count: Counter[str] = Counter()

    today = date.today()

    for p in valid_papers:
        pub = p.get("published")
        if not pub:
            continue
        try:
            pub_date = date.fromisoformat(str(pub)[:10])
        except ValueError:
            continue
        if pub_date > today:
            continue

        month_key = pub_date.strftime("%Y-%m")
        cites = p.get("citation_count") or 0
        paper_id = p.get("paper_id", "")

        cats = p.get("categories", [])
        paper_field = cats[2] if len(cats) >= 3 else (cats[0] if cats else "")

        text = f"{p.get('title', '')} {p.get('abstract', '')}".lower()

        # Check which terms appear in this paper
        for term_lower in term_set:
            if term_lower in text:
                kw = term_canonical[term_lower]

                kw_count[kw] += 1
                kw_citations[kw] = kw_citations.get(kw, 0) + cites

                if kw not in kw_monthly:
                    kw_monthly[kw] = {}
                kw_monthly[kw][month_key] = kw_monthly[kw].get(month_key, 0) + 1

                if paper_field:
                    kw_fields.setdefault(kw, set()).add(paper_field)

                kw_paper_ids.setdefault(kw, set()).add(paper_id)

    # Filter to top_n by document frequency
    top_keywords = kw_count.most_common(top_n)
    if not top_keywords:
        return []

    six_months_ago = today.replace(
        year=today.year if today.month > 6 else today.year - 1,
        month=today.month - 6 if today.month > 6 else today.month + 6,
    )

    results: list[KeywordMetric] = []
    for kw, count in top_keywords:
        monthly_dict = kw_monthly.get(kw, {})
        if not monthly_dict:
            continue

        sorted_months = sorted(monthly_dict.items())
        monthly_series = [
            (date.fromisoformat(f"{m}-01"), c) for m, c in sorted_months
        ]

        first_seen = sorted_months[0][0]
        last_seen = sorted_months[-1][0]

        accel = compute_acceleration(monthly_series)

        counts_arr = [c for _, c in monthly_series]
        if len(counts_arr) >= 2:
            recent = counts_arr[-3:] if len(counts_arr) >= 3 else counts_arr
            velocity = float(np.mean(np.diff(recent)))
        else:
            velocity = 0.0

        fields_list = sorted(kw_fields.get(kw, set()))
        signal = compute_horizon_score(
            label=kw,
            monthly_counts=monthly_series,
            field_appearances=fields_list,
            citation_velocity=kw_citations.get(kw, 0) / max(count, 1),
            paper_count=count,
        )

        fc = forecast_series(monthly_series, horizon=6)

        first_date = date.fromisoformat(f"{first_seen}-01")
        is_emerging = first_date >= six_months_ago and velocity > 0

        results.append(KeywordMetric(
            keyword=kw,
            total_count=count,
            monthly=monthly_series,
            velocity=round(velocity, 2),
            acceleration=round(accel, 2),
            horizon_score=signal.score,
            horizon_alert_level=signal.alert_level,
            horizon_factors=signal.factors,
            forecast=fc,
            is_emerging=is_emerging,
            fields=fields_list,
            paper_count=len(kw_paper_ids.get(kw, set())),
            first_seen=first_seen,
            last_seen=last_seen,
        ))

    results.sort(key=lambda m: m.horizon_score, reverse=True)
    return results
