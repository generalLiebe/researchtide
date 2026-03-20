"""Basic tests for data models."""

from datetime import date

from researchtide.models.paper import Paper, ResearchStatus, TopicSnapshot


def test_paper_creation():
    paper = Paper(
        paper_id="arxiv:2401.00001",
        title="Test Paper",
        abstract="This is a test.",
        authors=["Author A"],
        published=date(2024, 1, 1),
        source="arxiv",
    )
    assert paper.paper_id == "arxiv:2401.00001"
    assert paper.citation_count is None
    assert paper.references == []


def test_topic_snapshot_defaults():
    snapshot = TopicSnapshot(topic_id=0, label="Test Topic")
    assert snapshot.status == ResearchStatus.WEAK_SIGNAL
    assert snapshot.citation_velocity == 0.0
    assert snapshot.paper_count == 0
