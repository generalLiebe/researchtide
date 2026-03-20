"""Tests for citation velocity analysis."""

from datetime import date

from researchtide.analysis.citation_velocity import build_monthly_series, compute_acceleration
from researchtide.models.paper import Paper


def test_build_monthly_series():
    papers = [
        Paper(
            paper_id="1",
            title="P1",
            published=date(2024, 1, 15),
            categories=["cs.CL"],
        ),
        Paper(
            paper_id="2",
            title="P2",
            published=date(2024, 1, 20),
            categories=["cs.CL"],
        ),
        Paper(
            paper_id="3",
            title="P3",
            published=date(2024, 2, 10),
            categories=["cs.CL", "cs.AI"],
        ),
    ]

    series = build_monthly_series(papers)
    assert "cs.CL" in series
    assert len(series["cs.CL"]) == 2  # Jan and Feb
    assert series["cs.CL"][0][1] == 2  # 2 papers in Jan


def test_compute_acceleration_increasing():
    # Exponentially increasing series -> positive acceleration
    series = [(date(2024, m, 1), m**2) for m in range(1, 10)]
    acc = compute_acceleration(series, window=3)
    assert acc > 0


def test_compute_acceleration_constant():
    # Constant series -> zero acceleration
    series = [(date(2024, m, 1), 10) for m in range(1, 10)]
    acc = compute_acceleration(series, window=3)
    assert acc == 0.0
