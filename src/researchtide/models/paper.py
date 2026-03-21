"""Core data models for academic papers and topics."""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class ResearchStatus(str, Enum):
    WEAK_SIGNAL = "weak_signal"
    RISING = "rising"
    MAINSTREAM = "mainstream"
    DISPLACED = "displaced"


class Paper(BaseModel):
    """Normalized paper representation across data sources."""

    paper_id: str
    title: str
    abstract: str = ""
    authors: list[str] = Field(default_factory=list)
    published: date | None = None
    source: str = ""  # "arxiv", "semantic_scholar", "openalex"
    arxiv_id: str | None = None
    doi: str | None = None
    categories: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    citation_count: int | None = None
    references: list[str] = Field(default_factory=list)  # paper_ids


class TopicSnapshot(BaseModel):
    """A topic at a specific point in time."""

    topic_id: int
    label: str
    keywords: list[str] = Field(default_factory=list)
    paper_count: int = 0
    citation_velocity: float = 0.0  # citations per month, rolling window
    status: ResearchStatus = ResearchStatus.WEAK_SIGNAL
    timestamp: date | None = None
