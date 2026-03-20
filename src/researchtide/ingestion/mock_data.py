"""Mock citation data for development and demos.

Provides realistic citation relationships based on well-known AI/NLP papers.
Replace with real Semantic Scholar data once an API key is available.
"""

from __future__ import annotations

from datetime import date

from researchtide.models.paper import Paper

# Topic IDs (aligned with typical BERTopic output for AI/NLP)
TOPIC_TRANSFORMER = 0
TOPIC_DIFFUSION = 1
TOPIC_REASONING = 2
TOPIC_AGENTS = 3
TOPIC_MULTIMODAL = 4
TOPIC_MEDICAL = 5
TOPIC_SPEECH = 6
TOPIC_ROBUSTNESS = 7

MOCK_PAPERS: list[Paper] = [
    # --- Transformer lineage ---
    Paper(
        paper_id="s2:vaswani2017",
        title="Attention Is All You Need",
        authors=["Vaswani", "Shazeer", "Parmar"],
        published=date(2017, 6, 12),
        source="semantic_scholar",
        categories=["cs.CL"],
        citation_count=120000,
        references=[],
    ),
    Paper(
        paper_id="s2:devlin2019",
        title="BERT: Pre-training of Deep Bidirectional Transformers",
        authors=["Devlin", "Chang", "Lee", "Toutanova"],
        published=date(2018, 10, 11),
        source="semantic_scholar",
        categories=["cs.CL"],
        citation_count=85000,
        references=["s2:vaswani2017"],
    ),
    Paper(
        paper_id="s2:brown2020",
        title="Language Models are Few-Shot Learners (GPT-3)",
        authors=["Brown", "Mann", "Ryder"],
        published=date(2020, 5, 28),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=32000,
        references=["s2:vaswani2017", "s2:devlin2019"],
    ),
    Paper(
        paper_id="s2:touvron2023",
        title="LLaMA: Open and Efficient Foundation Language Models",
        authors=["Touvron", "Lavril", "Izacard"],
        published=date(2023, 2, 27),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=8500,
        references=["s2:vaswani2017", "s2:brown2020"],
    ),
    # --- Reasoning / CoT ---
    Paper(
        paper_id="s2:wei2022",
        title="Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
        authors=["Wei", "Wang", "Schuurmans"],
        published=date(2022, 1, 28),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=5200,
        references=["s2:brown2020"],
    ),
    Paper(
        paper_id="s2:yao2023",
        title="Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
        authors=["Yao", "Yu", "Zhao"],
        published=date(2023, 5, 17),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=1800,
        references=["s2:wei2022", "s2:brown2020"],
    ),
    # --- Agents ---
    Paper(
        paper_id="s2:schick2023",
        title="Toolformer: Language Models Can Teach Themselves to Use Tools",
        authors=["Schick", "Dwivedi-Yu", "Dessì"],
        published=date(2023, 2, 9),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=2100,
        references=["s2:brown2020", "s2:wei2022"],
    ),
    Paper(
        paper_id="s2:wang2024",
        title="A Survey on LLM-based Autonomous Agents",
        authors=["Wang", "Lei", "Dai"],
        published=date(2024, 1, 5),
        source="semantic_scholar",
        categories=["cs.AI", "cs.MA"],
        citation_count=950,
        references=["s2:schick2023", "s2:wei2022", "s2:yao2023"],
    ),
    # --- Diffusion (CV, displacing GAN) ---
    Paper(
        paper_id="s2:goodfellow2014",
        title="Generative Adversarial Networks",
        authors=["Goodfellow", "Pouget-Abadie", "Mirza"],
        published=date(2014, 6, 10),
        source="semantic_scholar",
        categories=["cs.LG", "cs.CV"],
        citation_count=65000,
        references=[],
    ),
    Paper(
        paper_id="s2:ho2020",
        title="Denoising Diffusion Probabilistic Models",
        authors=["Ho", "Jain", "Abbeel"],
        published=date(2020, 6, 19),
        source="semantic_scholar",
        categories=["cs.LG", "cs.CV"],
        citation_count=12000,
        references=["s2:goodfellow2014"],
    ),
    Paper(
        paper_id="s2:rombach2022",
        title="High-Resolution Image Synthesis with Latent Diffusion Models",
        authors=["Rombach", "Blattmann", "Lorenz"],
        published=date(2021, 12, 20),
        source="semantic_scholar",
        categories=["cs.CV"],
        citation_count=9500,
        references=["s2:ho2020", "s2:goodfellow2014", "s2:vaswani2017"],
    ),
    # --- Multimodal (CV + CL crossover) ---
    Paper(
        paper_id="s2:radford2021",
        title="Learning Transferable Visual Models From Natural Language Supervision (CLIP)",
        authors=["Radford", "Kim", "Hallacy"],
        published=date(2021, 2, 26),
        source="semantic_scholar",
        categories=["cs.CV", "cs.CL"],
        citation_count=18000,
        references=["s2:vaswani2017", "s2:devlin2019"],
    ),
    Paper(
        paper_id="s2:liu2023",
        title="Visual Instruction Tuning (LLaVA)",
        authors=["Liu", "Li", "Wu"],
        published=date(2023, 4, 17),
        source="semantic_scholar",
        categories=["cs.CV", "cs.CL", "cs.AI"],
        citation_count=3200,
        references=["s2:radford2021", "s2:touvron2023", "s2:brown2020"],
    ),
    # --- Medical NLP ---
    Paper(
        paper_id="s2:singhal2023",
        title="Large Language Models Encode Clinical Knowledge (Med-PaLM)",
        authors=["Singhal", "Azizi", "Tu"],
        published=date(2023, 1, 10),
        source="semantic_scholar",
        categories=["cs.CL", "cs.AI"],
        citation_count=1400,
        references=["s2:brown2020", "s2:devlin2019"],
    ),
    # --- Speech (CL → Audio crossover) ---
    Paper(
        paper_id="s2:radford2023",
        title="Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)",
        authors=["Radford", "Kim", "Xu"],
        published=date(2022, 12, 6),
        source="semantic_scholar",
        categories=["cs.CL", "cs.SD"],
        citation_count=4800,
        references=["s2:vaswani2017"],
    ),
    # --- Robustness / Safety ---
    Paper(
        paper_id="s2:zou2023",
        title="Universal and Transferable Adversarial Attacks on Aligned Language Models",
        authors=["Zou", "Wang", "Carlini"],
        published=date(2023, 7, 27),
        source="semantic_scholar",
        categories=["cs.CL", "cs.CR"],
        citation_count=1100,
        references=["s2:brown2020", "s2:touvron2023"],
    ),
]

# Topic assignments for mock papers
MOCK_TOPIC_ASSIGNMENTS: dict[str, int] = {
    "s2:vaswani2017": TOPIC_TRANSFORMER,
    "s2:devlin2019": TOPIC_TRANSFORMER,
    "s2:brown2020": TOPIC_TRANSFORMER,
    "s2:touvron2023": TOPIC_TRANSFORMER,
    "s2:wei2022": TOPIC_REASONING,
    "s2:yao2023": TOPIC_REASONING,
    "s2:schick2023": TOPIC_AGENTS,
    "s2:wang2024": TOPIC_AGENTS,
    "s2:goodfellow2014": TOPIC_DIFFUSION,
    "s2:ho2020": TOPIC_DIFFUSION,
    "s2:rombach2022": TOPIC_DIFFUSION,
    "s2:radford2021": TOPIC_MULTIMODAL,
    "s2:liu2023": TOPIC_MULTIMODAL,
    "s2:singhal2023": TOPIC_MEDICAL,
    "s2:radford2023": TOPIC_SPEECH,
    "s2:zou2023": TOPIC_ROBUSTNESS,
}

MOCK_TOPIC_LABELS: dict[int, str] = {
    TOPIC_TRANSFORMER: "Transformer / LLM",
    TOPIC_DIFFUSION: "Diffusion Models",
    TOPIC_REASONING: "Reasoning / CoT",
    TOPIC_AGENTS: "LLM Agents",
    TOPIC_MULTIMODAL: "Multimodal (CLIP/LLaVA)",
    TOPIC_MEDICAL: "Medical NLP",
    TOPIC_SPEECH: "Speech / Audio",
    TOPIC_ROBUSTNESS: "Adversarial / Safety",
}
