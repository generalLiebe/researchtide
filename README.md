# researchtide
Predict the future of science from within — a multi-agent research trend analysis system
<div align="center">

# 🌊 ResearchTide

### Predict the future of science from within.

*A multi-agent system that maps research trends, detects weak signals, and forecasts where science is heading — by analyzing the living dynamics of academic literature.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/generalLiebe/researchtide?style=social)](https://github.com/generalLiebe/researchtide)

**[ホワイトペーパー（日本語）](docs/whitepaper_ja.md)** · **[White Paper (English)](docs/whitepaper_en.md)** · **[UI Spec](docs/UI_SPEC.md)**

</div>

---

## What is ResearchTide?

Existing tools like VOSviewer and Semantic Scholar are excellent at visualizing the *past* — citation networks, keyword co-occurrence, author collaboration. But none of them answer the question researchers actually care about:

> **"Where is this field going, and how fast?"**

ResearchTide is built to answer exactly that. It monitors the living dynamics of academic literature — growth rates, cross-disciplinary propagation, ethics lag, and technology displacement — through a system of AI agents that simulate the research community itself.

Think of it as **Horizon Scanning, made computational.** Or: *Chaldeas for the research world.*

---

## Core Features

| Feature | Description |
|---|---|
| 🔭 **Weak Signal Detection** | Identifies topics whose citation velocity is accelerating before they go mainstream |
| 🌐 **Cross-field Propagation Graph** | Maps how concepts travel across disciplines (e.g. NLP → CV → Biology) |
| ⚖️ **Ethics Lag Metric** | Measures the delay between technological breakthroughs and ethics research |
| 📈 **Adoption / Displacement Model** | Classifies topics as Weak Signal / Rising / Mainstream / Displaced |
| 🏙️ **Social Penetration Index** | Tracks GitHub stars, Stack Overflow, patents, and news mentions |
| 🔄 **Self-correcting Feedback Loop** | Compares predictions against reality and recalibrates the model monthly |

---

## How It Works

ResearchTide runs a **6-layer pipeline**:

```
Layer 0  Data Ingestion      arXiv · Semantic Scholar · OpenAlex · GitHub · Patents
Layer 1  Topic Analysis      BERTopic · Citation graph · Keyword time-series
Layer 2  Weak Signal         Anomaly detection on citation velocity · Displacement detector
Layer 3  Social Tracking     GitHub stars · Stack Overflow · News mentions
Layer 4  Multi-Agent Sim     Field Expert · Horizon Scanner · Ethics Monitor · Adoption Predictor
Layer 5  Feedback Loop       Divergence measurement · Model recalibration · Prediction log
```

The **multi-agent layer** is where predictions are generated. Four specialized agents collaborate:

- **Field Expert Agent** — persona built from the top-cited papers in each discipline
- **Horizon Scanner Agent** — monitors all agents, surfaces emerging cross-field patterns
- **Ethics Monitor Agent** — tracks Ethics Lag in real time, fires alerts when lag is growing
- **Adoption Predictor Agent** — classifies each topic's trajectory using historical adoption patterns

---

## Research Questions

ResearchTide is simultaneously an OSS engineering project and a research project. The five core questions driving its development:

- **RQ1** — Can citation dynamics at time *t* predict high-impact topics at *t+2*?
- **RQ2** — Is the Ethics Lag for AI research shrinking or growing over 2010–2025?
- **RQ3** — Are technology displacement events (GAN→Diffusion, LSTM→Transformer) predictable from citation signals?
- **RQ4** — Does the self-correcting feedback loop measurably improve prediction accuracy over time?
- **RQ5** — How faithfully do literature-grounded agent personas represent real researcher perspectives?

---

## Roadmap

| Phase | Timeline | Milestones |
|---|---|---|
| **v0.1 — Foundation** | Apr–Jun 2026 | arXiv pipeline · BERTopic · Static influence graph · Public release · arXiv preprint |
| **v0.2 — Agents** | Jul–Sep 2026 | 4 agents · LLM Forum · Social tracking · Basic dashboard |
| **v0.3 — Feedback** | Oct–Dec 2026 | Feedback loop · Divergence measurement · Retrospective validation (2010–2022) |
| **v1.0 — Paper** | 2027 Q1 | WSDM / WWW / SIGIR submission · Interactive public demo |

---

## Tech Stack

```
Backend      Python · FastAPI · Railway
NLP          BERTopic · sentence-transformers · spaCy
Agents       LangGraph · Anthropic Claude API · OpenAI API
Graphs       NetworkX · PyVis
Anomaly      Isolation Forest · CUSUM
Frontend     React · D3.js · Tailwind CSS
Storage      PostgreSQL · Redis
CI/CD        GitHub Actions
```

One API key is all you need. Supports Claude, GPT, DeepSeek, and local models via Ollama.

---

## Local Development (v0.1)

### Backend API

1) Install (editable) dependencies:

```bash
python -m pip install -e ".[dev,viz]"
```

2) Run API:

```bash
uvicorn researchtide.api.main:app --reload --port 8000
```

Environment:

- `S2_API_KEY`: Semantic Scholar API key (optional; see `.env.example`)
- `RESEARCHTIDE_CORS_ORIGIN`: dashboard origin (default `http://localhost:5173`)

### Dashboard (React)

```bash
cd dashboard
npm install
npm run dev
```

Optional:

- `dashboard/.env.example` → set `VITE_API_BASE` (default is `http://localhost:8000`)

---

## Contributing

ResearchTide is designed as a community project from day one. Contributions welcome in:

- 📡 **Data connectors** — PubMed, IEEE Xplore, ACL Anthology
- 🤖 **Agent personas** — domain-specific tuning for your research community
- 📊 **Visualization components** — new dashboard views
- 🗂️ **Evaluation benchmarks** — historical datasets for retrospective validation
- 🌍 **Translations** — making the project accessible beyond English-speaking communities
- 📝 **Divergence reports** — "this prediction was wrong/right" reports directly improve the feedback loop

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Papers & Docs

- 📄 [White Paper — Japanese](docs/whitepaper_ja.md)
- 📄 [White Paper — English](docs/whitepaper_en.md) *(coming soon)*
- 🎨 [UI Design Specification](docs/UI_SPEC.md)

---

## Author

**Sosui Moribe**  
Graduate School of Design, Kyushu University  
moribe.sosui.695@s.kyushu-u.ac.jp  
[Researchmap](https://researchmap.jp) *(coming soon)*

Research interests: Recommendation systems · Multi-agent dialogue · Computational linguistics · Educational AI

---

<div align="center">

*If this project resonates with you, a ⭐ star means a lot.*

</div>