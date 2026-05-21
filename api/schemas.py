"""Pydantic schemas for Phase 3 query validation and responses"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Literal
from datetime import date
import numpy as np


class MarketState(BaseModel):
    """Market state input - all fields validated against real data ranges"""
    spy_price: float = Field(gt=0, description="SPY price (> 0)")
    vix: Optional[float] = Field(None, ge=0, le=100, description="VIX volatility index (0-100)")
    cpi: Optional[float] = Field(None, ge=-10, le=50, description="CPI inflation (% annual)")
    fed_rate: Optional[float] = Field(None, ge=0, le=20, description="Federal funds rate (% annual)")
    yield_spread: Optional[float] = Field(None, ge=-5, le=5, description="Yield curve 10Y-2Y spread (%)")
    unemployment: Optional[float] = Field(None, ge=0, le=20, description="Unemployment rate (%)")


class QueryRequest(BaseModel):
    """Phase 3 query input with optional filters"""
    query: str = Field(..., min_length=1, description="Natural language query about markets")

    # Optional filters
    regime_filter: Optional[Literal["BULL", "RECOVERY", "STAGNATION", "BEAR", "RECESSION"]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    # Search parameters
    top_k: int = Field(5, ge=1, le=20, description="Number of similar episodes to return")
    min_confidence: float = Field(0.5, ge=0, le=1, description="Minimum confidence threshold (0-1)")

    @field_validator('date_from', 'date_to')
    @classmethod
    def validate_dates(cls, v):
        if v and v.year < 2000:
            raise ValueError("Date must be after 2000")
        return v


class MarketStateQuery(BaseModel):
    """Structured market state query (alternative to natural language)"""
    market_state: MarketState
    regime_filter: Optional[Literal["BULL", "RECOVERY", "STAGNATION", "BEAR", "RECESSION"]] = None
    top_k: int = Field(5, ge=1, le=20)
    min_confidence: float = Field(0.5, ge=0, le=1)


class EpisodeOutcome(BaseModel):
    """Historical episode outcome data"""
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_1y: Optional[float] = None
    max_gain: float
    max_loss: float
    sharpe_ratio_6m: float


class SimilarEpisode(BaseModel):
    """Single similar episode with metadata and outcomes"""
    episode_id: int
    regime: str
    start_date: str
    end_date: str
    duration_days: int

    # Market conditions
    avg_vix: Optional[float] = None
    avg_cpi: Optional[float] = None
    avg_fed_rate: Optional[float] = None

    # Similarity metrics
    similarity_score: float = Field(ge=0, le=100, description="Confidence score 0-100")
    l2_distance: float = Field(ge=0, description="L2 (Euclidean) distance from query")

    # Outcomes
    outcomes: EpisodeOutcome


class ReasoningInsight(BaseModel):
    """Aggregated reasoning from similar episodes"""
    similar_episodes_count: int
    search_space_total: int
    representation: float = Field(description="% of total episodes (similar/total)")

    # Outcome statistics
    avg_return_6m: float
    median_return_6m: float
    win_rate_pct: float = Field(ge=0, le=100, description="% of episodes with positive return")
    max_gain: float
    max_loss: float
    sharpe_ratio_avg: float

    # Reliability metrics
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"] = Field(description="Based on episode count and similarity")
    statistical_significance: float = Field(ge=0, le=1, description="p-value equivalent (rough estimate)")


class QueryResponse(BaseModel):
    """Phase 3 complete response"""
    query: str

    # Results
    similar_episodes: List[SimilarEpisode]
    reasoning: ReasoningInsight

    # Insights
    insight_text: str = Field(description="Natural language reasoning about market implications")
    warning: Optional[str] = Field(None, description="Warning if confidence is low or data incomplete")


class RegimeQuery(BaseModel):
    """Query by regime only"""
    regime: Literal["BULL", "RECOVERY", "STAGNATION", "BEAR", "RECESSION"]
    top_k: int = Field(10, ge=1, le=61)


class HealthCheck(BaseModel):
    """System health status"""
    status: str
    episodes_total: int
    episodes_with_embeddings: int
    lancedb_connected: bool
    phase3_ready: bool
