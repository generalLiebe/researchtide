# Good First Issues

Below are issue templates ready to create on GitHub.
Create them with `gh issue create` or via the GitHub web UI.

---

## Issue 1: Add PubMed data connector

**Labels:** `good first issue`, `enhancement`, `data`

**Title:** Add PubMed/MEDLINE data connector

**Body:**

Currently ResearchTide fetches papers from OpenAlex and arXiv. Adding a PubMed connector would greatly expand coverage for biomedical and life science research.

### What needs to happen
- Create `src/researchtide/ingestion/pubmed.py`
- Use the [NCBI E-utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25501/) (free, no key required for <3 req/sec)
- Implement `fetch_papers()` that returns a list of `Paper` models (see `src/researchtide/models/paper.py`)
- Add basic tests in `tests/`

### Reference
- Existing OpenAlex connector: `src/researchtide/ingestion/openalex.py`
- Paper model: `src/researchtide/models/paper.py`

---

## Issue 2: Add loading states to dashboard

**Labels:** `good first issue`, `enhancement`, `frontend`

**Title:** Show loading/empty states when API data hasn't arrived yet

**Body:**

When the backend is still fetching data (first ~2 minutes after startup), dashboard tabs show blank content. We should display informative loading or "data arriving soon" states instead.

### What needs to happen
- In each tab component, detect when the API returns empty data
- Show a loading spinner or "Data is being fetched. Please wait a moment..." message
- Style consistently with the existing dashboard theme

### Reference
- Dashboard source: `dashboard/src/`
- API returns empty arrays when cache hasn't been built yet

---

## Issue 3: Add pagination to Papers tab

**Labels:** `good first issue`, `enhancement`, `frontend`

**Title:** Add pagination controls to the Papers tab

**Body:**

The `/live/papers` endpoint supports `offset` and `limit` parameters, but the frontend currently only shows the first 50 results with no way to navigate to more.

### What needs to happen
- Add prev/next page buttons (or infinite scroll) to the Papers tab
- Use `total` from the API response to show page count
- Maintain filter state across page changes

### Reference
- API: `GET /live/papers?offset=0&limit=50` returns `{ papers: [...], total: N }`
- Papers component in `dashboard/src/`

---

## Issue 4: Add test coverage for keyword extraction

**Labels:** `good first issue`, `testing`

**Title:** Add unit tests for keyword trend analysis

**Body:**

`src/researchtide/analysis/keyword_trends.py` has no dedicated test file. Adding tests would improve confidence when modifying the keyword extraction pipeline.

### What needs to happen
- Create `tests/test_keyword_trends.py`
- Test `build_keyword_metrics()` with a small set of mock papers
- Test that future publication dates are filtered out
- Test edge cases: empty abstracts, too few papers, no valid dates

### Reference
- Module: `src/researchtide/analysis/keyword_trends.py`
- Existing test patterns: `tests/`

---

## Issue 5: Add Japanese README translation

**Labels:** `good first issue`, `documentation`, `translation`

**Title:** Add Japanese translation of README (README_ja.md)

**Body:**

The project author and white paper are in Japanese, but the README is English-only. A Japanese README would make the project more accessible to Japanese-speaking researchers.

### What needs to happen
- Create `README_ja.md` in the repo root
- Translate the main README content
- Add a language switcher link at the top of both READMEs: `[English](README.md) | [日本語](README_ja.md)`

---

## How to create these on GitHub

```bash
# First authenticate:
gh auth login

# Then create each issue:
gh issue create --title "Add PubMed/MEDLINE data connector" \
  --body "..." \
  --label "good first issue" --label "enhancement"
```

Or use the GitHub web UI at https://github.com/generalLiebe/researchtide/issues/new
