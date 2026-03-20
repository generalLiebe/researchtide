"""Demo data endpoints for dashboard prototyping.

Generates a rich, realistic dataset for the dashboard without requiring
any external API calls. Replace with live pipeline data as layers mature.
"""

from __future__ import annotations

import math
import random

from researchtide.api.schemas import DemoResponse, GraphEdge, Hub, TopicNode


# ── Topic catalogue ──────────────────────────────────────────────────────────
# Each entry: (label, status, base_growth, ethic_lag_months, social_penetration)
TOPIC_CATALOGUE: list[tuple[str, str, float, float, float]] = [
    # NLP / LLM core
    ("Transformer / LLM",       "mainstream", 92, 6.0,  88),
    ("Reasoning / CoT",         "rising",     81, 4.5,  62),
    ("LLM Agents",              "rising",     78, 8.2,  55),
    ("RLHF / Alignment",        "rising",     74, 5.0,  48),
    ("Multilingual NLP",        "mainstream", 65, 3.0,  42),
    ("RAG / Retrieval",         "rising",     72, 3.5,  58),
    # Vision
    ("Diffusion Models",        "mainstream", 85, 7.5,  80),
    ("3D Generation",           "weak",       58, 12.0, 25),
    ("Vision-Language (CLIP)",  "mainstream", 70, 5.5,  72),
    # Multimodal
    ("Multimodal LLM (LLaVA)",  "rising",    76, 9.0,  45),
    ("Video Understanding",      "weak",      52, 14.0, 18),
    # Audio
    ("Speech / Whisper",         "mainstream", 68, 4.0,  65),
    ("Music Generation",         "weak",       45, 16.0, 22),
    # Science
    ("Medical NLP",              "rising",     63, 10.5, 35),
    ("Scientific Discovery",     "weak",       48, 11.0, 15),
    ("Protein / Bio LLM",        "weak",       55, 13.0, 28),
    # Safety / Ethics
    ("Adversarial / Safety",     "rising",     60, 2.0,  40),
    ("AI Governance",            "weak",       42, 1.5,  30),
    # Efficiency
    ("Model Compression",        "mainstream", 62, 3.0,  55),
    ("Mixture of Experts",       "rising",     70, 6.0,  38),
    # Legacy / displaced
    ("GAN",                      "displaced",  20, 5.0,  70),
    ("LSTM / RNN",               "displaced",  12, 3.0,  60),
]

# ── Influence edges (source_idx → target_idx, weight) ────────────────────────
TOPIC_EDGES: list[tuple[int, int, float]] = [
    # Transformer → everything
    (0, 1, 0.95),  (0, 2, 0.90),  (0, 3, 0.85),  (0, 4, 0.70),
    (0, 5, 0.80),  (0, 6, 0.60),  (0, 8, 0.75),  (0, 9, 0.80),
    (0, 11, 0.65), (0, 13, 0.55), (0, 18, 0.50),
    # Reasoning → Agents
    (1, 2, 0.85),
    # Agents → Safety
    (2, 16, 0.70), (2, 17, 0.40),
    # Diffusion → 3D, Video, displaces GAN
    (6, 7, 0.80),  (6, 10, 0.65), (6, 20, 0.30),
    # CLIP → Multimodal LLM
    (8, 9, 0.85),  (8, 10, 0.55),
    # RAG → Medical, Scientific
    (5, 13, 0.60), (5, 14, 0.50),
    # RLHF → Safety, Governance
    (3, 16, 0.75), (3, 17, 0.55),
    # Medical → Bio
    (13, 15, 0.45),
    # MoE → Compression
    (19, 18, 0.60),
    # Transformer displaces LSTM
    (0, 21, 0.25),
]

# ── World map hubs ───────────────────────────────────────────────────────────
HUB_DATA: list[dict] = [
    # North America
    dict(name="Bay Area AI", subtitle="Stanford · Google · OpenAI · Anthropic",
         region="North America", lon=-122.4194, lat=37.7749, intensity=95,
         topics=["Transformer / LLM", "Reasoning / CoT", "LLM Agents", "RLHF / Alignment"],
         papersK=18.5, yoyGrowth=28.0),
    dict(name="East Coast NLP", subtitle="MIT · CMU · NYU",
         region="North America", lon=-74.0060, lat=40.7128, intensity=88,
         topics=["Multilingual NLP", "RAG / Retrieval", "Adversarial / Safety"],
         papersK=9.2, yoyGrowth=22.0),
    dict(name="Montreal AI", subtitle="Mila · Yoshua Bengio",
         region="North America", lon=-73.5673, lat=45.5017, intensity=78,
         topics=["AI Governance", "RLHF / Alignment", "Scientific Discovery"],
         papersK=4.1, yoyGrowth=15.0),
    # Europe
    dict(name="London AI", subtitle="DeepMind · UCL · Imperial",
         region="Europe", lon=-0.1276, lat=51.5072, intensity=86,
         topics=["Reasoning / CoT", "Protein / Bio LLM", "Model Compression"],
         papersK=7.8, yoyGrowth=20.0),
    dict(name="Europe NLP", subtitle="ETH · EPFL · TU Munich",
         region="Europe", lon=8.5417, lat=47.3769, intensity=72,
         topics=["Multilingual NLP", "Speech / Whisper", "Medical NLP"],
         papersK=5.5, yoyGrowth=18.0),
    # Asia
    dict(name="Beijing AI", subtitle="Tsinghua · Baidu · ByteDance",
         region="Asia", lon=116.4074, lat=39.9042, intensity=92,
         topics=["Transformer / LLM", "Mixture of Experts", "3D Generation"],
         papersK=15.2, yoyGrowth=32.0),
    dict(name="Shanghai / Hangzhou", subtitle="Fudan · Alibaba · Zhejiang",
         region="Asia", lon=121.4737, lat=31.2304, intensity=82,
         topics=["Multimodal LLM (LLaVA)", "Video Understanding", "RAG / Retrieval"],
         papersK=8.9, yoyGrowth=26.0),
    dict(name="Tokyo / Kyoto", subtitle="UTokyo · RIKEN · Preferred Networks",
         region="Asia", lon=139.6917, lat=35.6895, intensity=70,
         topics=["Speech / Whisper", "Medical NLP", "Multilingual NLP"],
         papersK=3.8, yoyGrowth=14.0),
    dict(name="Seoul AI", subtitle="KAIST · Naver · Samsung",
         region="Asia", lon=126.9780, lat=37.5665, intensity=75,
         topics=["Diffusion Models", "Vision-Language (CLIP)", "Music Generation"],
         papersK=4.5, yoyGrowth=24.0),
    # Middle East / Others
    dict(name="Tel Aviv AI", subtitle="Hebrew U · Technion · AI21",
         region="Middle East", lon=34.7818, lat=32.0853, intensity=74,
         topics=["Multilingual NLP", "RAG / Retrieval", "Reasoning / CoT"],
         papersK=3.2, yoyGrowth=19.0),
    dict(name="Singapore AI", subtitle="NUS · NTU · A*STAR",
         region="Asia", lon=103.8198, lat=1.3521, intensity=68,
         topics=["Adversarial / Safety", "Medical NLP", "Multimodal LLM (LLaVA)"],
         papersK=2.8, yoyGrowth=21.0),
]


def build_demo_payload(seed: int = 42) -> DemoResponse:
    rng = random.Random(seed)

    # ── Topics ────────────────────────────────────────────────────────────
    n = len(TOPIC_CATALOGUE)
    cx, cy = 0.50, 0.48
    topics: list[TopicNode] = []

    for idx, (label, status, growth, ethic_lag, social) in enumerate(TOPIC_CATALOGUE):
        # Layout: concentric rings by status
        if status == "mainstream":
            ring_r = 0.12 + rng.random() * 0.05
        elif status == "rising":
            ring_r = 0.22 + rng.random() * 0.05
        elif status == "weak":
            ring_r = 0.32 + rng.random() * 0.05
        else:  # displaced
            ring_r = 0.40 + rng.random() * 0.03

        angle = (2 * math.pi * idx) / n + rng.random() * 0.3
        x = cx + ring_r * math.cos(angle)
        y = cy + ring_r * math.sin(angle)

        radius = 6.0 + (growth / 100.0) * 18.0
        jitter_growth = growth + rng.uniform(-3, 3)
        jitter_social = social + rng.uniform(-5, 5)
        jitter_lag = max(0.5, ethic_lag + rng.uniform(-1, 1))

        # Build influence lists from edge catalogue
        influences = []
        influenced_by = []
        for src, tgt, _w in TOPIC_EDGES:
            if src == idx:
                influences.append(TOPIC_CATALOGUE[tgt][0])
            if tgt == idx:
                influenced_by.append(TOPIC_CATALOGUE[src][0])

        topics.append(TopicNode(
            id=idx,
            label=label,
            status=status,  # type: ignore[arg-type]
            x=float(max(0.05, min(0.95, x))),
            y=float(max(0.08, min(0.92, y))),
            radius=float(radius),
            growth=float(max(0, min(100, jitter_growth))),
            ethicLag=float(jitter_lag),
            socialPenetration=float(max(0, min(100, jitter_social))),
            influences=influences,
            influencedBy=influenced_by,
        ))

    # ── Edges ─────────────────────────────────────────────────────────────
    edges = [
        GraphEdge(source=src, target=tgt, weight=w)
        for src, tgt, w in TOPIC_EDGES
    ]

    # ── Hubs ──────────────────────────────────────────────────────────────
    hubs = [
        Hub(id=i + 1, **h)
        for i, h in enumerate(HUB_DATA)
    ]

    return DemoResponse(hubs=hubs, topics=topics, edges=edges)
