# Contributing to ResearchTide

Thank you for your interest in contributing! ResearchTide is both an OSS engineering project and a research project, so contributions of all kinds are welcome.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ (for the dashboard)
- Git

### Local Setup

1. **Clone the repository**

```bash
git clone https://github.com/generalLiebe/researchtide.git
cd researchtide
```

2. **Backend setup**

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev,viz]"
```

3. **Environment variables**

```bash
cp .env.example .env
# Edit .env — S2_API_KEY and OPENALEX_EMAIL are optional but recommended
```

4. **Start the API server**

```bash
uvicorn researchtide.api.main:app --reload --port 8000
```

5. **Dashboard setup** (separate terminal)

```bash
cd dashboard
npm install
npm run dev
```

6. Open http://localhost:5173 in your browser.

### Running Tests

```bash
pytest
```

### Linting

```bash
ruff check src/ tests/
ruff format src/ tests/
```

## How to Contribute

### Reporting Bugs

- Open a [GitHub Issue](https://github.com/generalLiebe/researchtide/issues) with a clear title
- Include steps to reproduce, expected behavior, and actual behavior
- Screenshots are helpful for UI-related bugs

### Suggesting Features

- Open an issue with the `enhancement` label
- Describe the use case and why it would benefit the project

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests: `pytest`
5. Run linter: `ruff check src/ tests/`
6. Commit with a clear message describing the change
7. Push and open a Pull Request

### Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a brief description of what changed and why
- Add tests for new functionality where applicable
- Ensure all existing tests pass

## Areas Where Help is Needed

| Area | Examples |
|------|----------|
| Data connectors | PubMed, IEEE Xplore, ACL Anthology, DBLP |
| Dashboard components | New visualization views, UX improvements |
| Evaluation benchmarks | Historical datasets for retrospective validation |
| Translations | Making the project accessible beyond English |
| Documentation | Tutorials, architecture guides, API documentation |
| Testing | Expanding test coverage |

## Project Structure

```
researchtide/
  src/researchtide/
    api/            # FastAPI endpoints and live dashboard logic
    analysis/       # Citation velocity, keyword trends, forecasting
    detection/      # Weak signal and horizon score detection
    graph/          # Influence graph construction
    ingestion/      # arXiv, OpenAlex, Semantic Scholar data fetching
    models/         # Pydantic data models
  dashboard/        # React + TypeScript frontend
  tests/            # pytest test suite
  scripts/          # Data refresh and utility scripts
  docs/             # White paper, UI spec
```

## Code Style

- Python: Follow [Ruff](https://github.com/astral-sh/ruff) defaults
- TypeScript/React: Follow ESLint config in `dashboard/`
- Prefer clarity over cleverness
- Comments only where the logic isn't self-evident

## Communication

- Questions and discussions: [GitHub Issues](https://github.com/generalLiebe/researchtide/issues)
- Author: Sosui Moribe (moribe.sosui.695@s.kyushu-u.ac.jp)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
